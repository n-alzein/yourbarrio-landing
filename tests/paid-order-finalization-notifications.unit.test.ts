import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNewOrderNotificationsMock } = vi.hoisted(() => ({
  sendNewOrderNotificationsMock: vi.fn(),
}));

vi.mock("@/lib/notifications/orders", () => ({
  sendNewOrderNotifications: sendNewOrderNotificationsMock,
}));

import {
  finalizePaidOrderFromCheckoutSession,
  finalizePaidOrderFromPaymentIntent,
} from "@/lib/orders/persistence";

class MockQuery {
  private readonly client: MockSupabaseClient;
  private readonly table: string;
  private readonly filters: Array<(row: any) => boolean> = [];
  private updateValues: Record<string, any> | null = null;

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

    if (this.table === "vendor_members") {
      for (const row of rows) {
        const duplicate = tableRows.some(
          (existing) =>
            existing.vendor_id === row.vendor_id && existing.user_id === row.user_id
        );
        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          });
        }
      }
    }

    if (this.table === "notifications") {
      for (const row of rows) {
        const duplicate = tableRows.some((existing) => existing.id === row.id);
        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          });
        }
      }
    }

    for (const row of rows) {
      tableRows.push({ ...row });
    }

    return Promise.resolve({ data: rows, error: null });
  }

  update(values: Record<string, any>) {
    this.updateValues = values;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((row) => row?.[field] === value);
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push((row) => values.includes(row?.[field]));
    return this;
  }

  maybeSingle() {
    if (this.updateValues) {
      const result = this.runUpdate();
      return Promise.resolve({
        data: result.data[0] ? { ...result.data[0] } : null,
        error: result.error,
      });
    }

    const rows = this.getFilteredRows();
    return Promise.resolve({
      data: rows[0] ? { ...rows[0] } : null,
      error: null,
    });
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    if (this.updateValues) {
      return Promise.resolve(this.runUpdate()).then(resolve, reject);
    }

    return Promise.resolve({
      data: this.getFilteredRows().map((row) => ({ ...row })),
      error: null,
    }).then(resolve, reject);
  }

  private getFilteredRows() {
    return this.client
      .getTable(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
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
}

function buildClient() {
  return new MockSupabaseClient({
    orders: [
      {
        id: "order-1",
        order_number: "YB-TEST01",
        status: "pending_payment",
        paid_at: null,
        vendor_id: "vendor-1",
        user_id: "customer-1",
        cart_id: "cart-1",
      },
    ],
    carts: [{ id: "cart-1", user_id: "customer-1", status: "active" }],
    vendor_members: [{ vendor_id: "vendor-1", user_id: "vendor-1", role: "owner" }],
    notifications: [],
  });
}

describe("paid order finalization notification trigger", () => {
  beforeEach(() => {
    sendNewOrderNotificationsMock.mockReset();
    sendNewOrderNotificationsMock.mockResolvedValue({
      orderId: "order-1",
      action: "processed",
      sms: "sent",
      email: "sent",
    });
  });

  it("triggers new-order notifications after checkout session finalization", async () => {
    const client = buildClient();

    const result = await finalizePaidOrderFromCheckoutSession({
      client,
      session: {
        id: "cs_test_123",
        payment_status: "paid",
        payment_intent: "pi_test_123",
        amount_total: 2499,
        currency: "usd",
        metadata: {
          order_id: "order-1",
          checkout_flow: "cart_checkout",
        },
      },
    });

    expect(result.nextStatus).toBe("requested");
    expect(client.getTable("orders")[0]?.status).toBe("requested");
    expect(sendNewOrderNotificationsMock).toHaveBeenCalledTimes(1);
    expect(sendNewOrderNotificationsMock).toHaveBeenCalledWith("order-1", { client });
  });

  it("triggers new-order notifications after payment intent finalization", async () => {
    const client = buildClient();

    const result = await finalizePaidOrderFromPaymentIntent({
      client,
      paymentIntent: {
        id: "pi_test_456",
        status: "succeeded",
        latest_charge: "ch_test_456",
        amount_received: 2499,
        application_fee_amount: 250,
        currency: "usd",
        metadata: {
          order_id: "order-1",
          checkout_flow: "buy_now",
        },
      },
    });

    expect(result.nextStatus).toBe("requested");
    expect(client.getTable("orders")[0]?.status).toBe("requested");
    expect(sendNewOrderNotificationsMock).toHaveBeenCalledTimes(1);
    expect(sendNewOrderNotificationsMock).toHaveBeenCalledWith("order-1", { client });
  });

  it("preserves paid-order finalization when notification dispatch fails", async () => {
    const client = buildClient();
    sendNewOrderNotificationsMock.mockRejectedValueOnce(new Error("twilio unavailable"));

    const result = await finalizePaidOrderFromPaymentIntent({
      client,
      paymentIntent: {
        id: "pi_test_789",
        status: "succeeded",
        latest_charge: "ch_test_789",
        amount_received: 2499,
        application_fee_amount: 250,
        currency: "usd",
        metadata: {
          order_id: "order-1",
          checkout_flow: "buy_now",
        },
      },
    });

    expect(result.nextStatus).toBe("requested");
    expect(client.getTable("orders")[0]?.status).toBe("requested");
    expect(sendNewOrderNotificationsMock).toHaveBeenCalledTimes(1);
  });
});
