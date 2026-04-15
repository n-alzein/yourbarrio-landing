import { describe, expect, it, vi } from "vitest";

import { classifyTwilioError } from "@/lib/integrations/twilio";
import {
  getDueReminderChannels,
  isValidTwilioStatusTransition,
  markOrderAcknowledged,
  sendNewOrderNotifications,
  sendReminderNotifications,
  updateOrderNotificationFromTwilioCallback,
} from "@/lib/notifications/orders";

class MockQuery {
  private readonly client: MockSupabaseClient;
  private readonly table: string;
  private readonly filters: Array<(row: any) => boolean> = [];
  private updateValues: Record<string, any> | null = null;
  private sortField: string | null = null;
  private sortAscending = true;
  private maxRows: number | null = null;

  constructor(client: MockSupabaseClient, table: string) {
    this.client = client;
    this.table = table;
  }

  select() {
    return this;
  }

  insert(payload: any) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const tableRows = this.client.getTable(this.table);

    if (this.table === "order_notifications") {
      for (const row of rows) {
        const duplicate = tableRows.some(
          (existing) => existing.idempotency_key === row.idempotency_key
        );
        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate idempotency key" },
          });
        }
      }
    }

    for (const row of rows) {
      tableRows.push({
        id: row.id || `row-${tableRows.length + 1}`,
        created_at: row.created_at || new Date().toISOString(),
        meta: row.meta || {},
        ...row,
      });
    }

    return Promise.resolve({ data: rows, error: null });
  }

  update(values: Record<string, any>) {
    this.updateValues = values;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((row) => row?.[field] === value);
    if (this.updateValues) {
      return Promise.resolve(this.runUpdate());
    }
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push((row) => values.includes(row?.[field]));
    return this;
  }

  is(field: string, value: any) {
    if (value === null) {
      this.filters.push((row) => row?.[field] == null);
      return this;
    }
    return this.eq(field, value);
  }

  lte(field: string, value: any) {
    this.filters.push((row) => {
      const rowValue = row?.[field];
      if (rowValue == null) return false;
      return String(rowValue) <= String(value);
    });
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.sortField = field;
    this.sortAscending = options.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  maybeSingle() {
    const rows = this.getFilteredRows();
    return Promise.resolve({
      data: rows[0] ? { ...rows[0] } : null,
      error: null,
    });
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    return Promise.resolve({
      data: this.getFilteredRows().map((row) => ({ ...row })),
      error: null,
    }).then(resolve, reject);
  }

  private getFilteredRows() {
    let rows = this.client
      .getTable(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));

    if (this.sortField) {
      rows = [...rows].sort((left, right) => {
        const leftValue = left?.[this.sortField as string];
        const rightValue = right?.[this.sortField as string];
        if (leftValue === rightValue) return 0;
        if (leftValue == null) return this.sortAscending ? -1 : 1;
        if (rightValue == null) return this.sortAscending ? 1 : -1;
        return this.sortAscending
          ? String(leftValue).localeCompare(String(rightValue))
          : String(rightValue).localeCompare(String(leftValue));
      });
    }

    if (typeof this.maxRows === "number") {
      rows = rows.slice(0, this.maxRows);
    }

    return rows;
  }

  private runUpdate() {
    const rows = this.getFilteredRows();
    for (const row of rows) {
      Object.assign(row, this.updateValues);
    }
    return { data: rows.map((row) => ({ ...row })), error: null };
  }
}

class MockSupabaseClient {
  private readonly tables: Record<string, any[]>;

  constructor(tables: Record<string, any[]>) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
    );
  }

  from(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return new MockQuery(this, table);
  }

  getTable(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return this.tables[table];
  }

  rpc(fn: string) {
    if (fn === "try_acquire_order_notification_reminders_lock") {
      return Promise.resolve({ data: true, error: null });
    }
    if (fn === "release_order_notification_reminders_lock") {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

function buildClient() {
  return new MockSupabaseClient({
    orders: [
      {
        id: "order-1",
        order_number: "YB-1001",
        vendor_id: "vendor-1",
        contact_name: "Sarah",
        total: 32.5,
        fulfillment_type: "pickup",
        pickup_time: "ASAP",
        notification_state: "pending",
        escalation_level: 0,
        first_alert_sent_at: null,
        last_alert_sent_at: null,
        acknowledged_at: null,
        order_items: [
          {
            id: "item-1",
            order_id: "order-1",
            title: "Tamales",
            quantity: 2,
            unit_price: 8.5,
          },
        ],
      },
    ],
    businesses: [
      {
        id: "business-row-1",
        owner_user_id: "vendor-1",
        business_name: "Casa Test",
        phone: "+14155550100",
        order_alert_phone: "+14155550100",
        order_alert_phone_backup: "+14155550101",
        order_alert_email: "orders@test.local",
        sms_opt_in: true,
        order_alerts_enabled: true,
      },
    ],
    users: [
      {
        id: "vendor-1",
        email: "owner@test.local",
        phone: "+14155550100",
        business_name: "Casa Test",
        full_name: "Owner",
      },
    ],
    order_notifications: [],
  });
}

describe("order notification pipeline", () => {
  it("enforces idempotency on duplicate new-order events", async () => {
    const client = buildClient();
    const smsSender = vi.fn().mockResolvedValue({
      provider: "twilio",
      providerMessageId: "SM123",
      status: "pending",
      rawStatus: "queued",
    });
    const emailSender = vi.fn().mockResolvedValue({
      provider: "resend",
      providerMessageId: "email-123",
    });

    await sendNewOrderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:00:00.000Z"),
      smsSender,
      emailSender,
    });
    await sendNewOrderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:00:01.000Z"),
      smsSender,
      emailSender,
    });

    expect(smsSender).toHaveBeenCalledTimes(1);
    expect(emailSender).toHaveBeenCalledTimes(1);
    expect(client.getTable("order_notifications")).toHaveLength(2);
    expect(client.getTable("orders")[0]?.notification_state).toBe("awaiting_ack");
    expect(client.getTable("orders")[0]?.first_alert_sent_at).toBe(
      "2026-04-13T12:00:00.000Z"
    );
  });

  it("classifies transient and permanent Twilio failures", () => {
    expect(classifyTwilioError({ status: 503, message: "upstream timeout" }).kind).toBe(
      "transient"
    );
    expect(classifyTwilioError({ code: 21610, message: "opt out" }).kind).toBe(
      "permanent"
    );
    expect(isValidTwilioStatusTransition("delivered", "sent")).toBe(false);
    expect(isValidTwilioStatusTransition("sent", "delivered")).toBe(true);
  });

  it("computes reminder timing at 5 and 15 minutes", () => {
    const order = {
      first_alert_sent_at: "2026-04-13T12:00:00.000Z",
      acknowledged_at: null,
    };

    expect(
      getDueReminderChannels({
        order,
        notifications: [],
        now: new Date("2026-04-13T12:04:59.000Z"),
      })
    ).toEqual({ sms: false, email: false });

    expect(
      getDueReminderChannels({
        order,
        notifications: [],
        now: new Date("2026-04-13T12:06:00.000Z"),
      })
    ).toEqual({ sms: true, email: false });

    expect(
      getDueReminderChannels({
        order,
        notifications: [],
        now: new Date("2026-04-13T12:16:00.000Z"),
      })
    ).toEqual({ sms: true, email: true });
  });

  it("stops reminder sends after acknowledgment", async () => {
    const client = buildClient();
    client.getTable("orders")[0].acknowledged_at = "2026-04-13T12:03:00.000Z";

    const smsSender = vi.fn();
    const emailSender = vi.fn();
    const result = await sendReminderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:16:00.000Z"),
      smsSender: smsSender as any,
      emailSender: emailSender as any,
    });

    expect(result.action).toBe("already_acknowledged");
    expect(smsSender).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("sends exactly one SMS reminder at 5 minutes and one email reminder at 15 minutes", async () => {
    const client = buildClient();
    client.getTable("orders")[0].notification_state = "awaiting_ack";
    client.getTable("orders")[0].first_alert_sent_at = "2026-04-13T12:00:00.000Z";

    const smsSender = vi.fn().mockResolvedValue({
      provider: "twilio",
      providerMessageId: "SMREMINDER",
      status: "pending",
      rawStatus: "queued",
    });
    const emailSender = vi.fn().mockResolvedValue({
      provider: "resend",
      providerMessageId: "email-reminder",
    });

    await sendReminderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:06:00.000Z"),
      smsSender,
      emailSender,
    });
    await sendReminderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:16:00.000Z"),
      smsSender,
      emailSender,
    });
    await sendReminderNotifications("order-1", {
      client,
      now: new Date("2026-04-13T12:17:00.000Z"),
      smsSender,
      emailSender,
    });

    expect(smsSender).toHaveBeenCalledTimes(1);
    expect(emailSender).toHaveBeenCalledTimes(1);

    const reminderRows = client
      .getTable("order_notifications")
      .filter((row) => row.notification_kind === "reminder");
    expect(reminderRows).toHaveLength(2);
    expect(client.getTable("orders")[0]?.notification_state).toBe("reminder_sent");
  });

  it("updates notification state from Twilio callbacks and ignores older callbacks", async () => {
    const client = buildClient();
    client.getTable("order_notifications").push({
      id: "notif-1",
      order_id: "order-1",
      owner_user_id: "vendor-1",
      business_entity_id: "business-row-1",
      channel: "sms",
      notification_kind: "new_order",
      destination: "+14155550100",
      provider: "twilio",
      provider_message_id: "SM123",
      status: "sent",
      attempt_number: 1,
      idempotency_key: "order:order-1:new_order:sms:v1",
      meta: {},
      created_at: "2026-04-13T12:00:00.000Z",
    });

    await updateOrderNotificationFromTwilioCallback({
      client,
      payload: {
        MessageSid: "SM123",
        MessageStatus: "delivered",
      },
      receivedAt: new Date("2026-04-13T12:01:00.000Z"),
    });

    await updateOrderNotificationFromTwilioCallback({
      client,
      payload: {
        MessageSid: "SM123",
        MessageStatus: "sent",
      },
      receivedAt: new Date("2026-04-13T12:02:00.000Z"),
    });

    expect(client.getTable("order_notifications")[0]?.status).toBe("delivered");
    expect(client.getTable("order_notifications")[0]?.delivered_at).toBe(
      "2026-04-13T12:01:00.000Z"
    );
  });

  it("marks orders acknowledged idempotently", async () => {
    const client = buildClient();

    const first = await markOrderAcknowledged("order-1", "vendor-1", {
      client,
      acknowledgedAt: new Date("2026-04-13T12:05:00.000Z"),
    });
    const second = await markOrderAcknowledged("order-1", "vendor-1", {
      client,
      acknowledgedAt: new Date("2026-04-13T12:06:00.000Z"),
    });

    expect(first?.acknowledged_at).toBe("2026-04-13T12:05:00.000Z");
    expect(second?.acknowledged_at).toBe("2026-04-13T12:05:00.000Z");
    expect(client.getTable("orders")[0]?.notification_state).toBe("acknowledged");
  });
});
