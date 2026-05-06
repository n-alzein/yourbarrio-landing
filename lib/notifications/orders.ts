import "server-only";

import { getAppUrl } from "@/lib/stripe";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import {
  classifyTwilioError,
  normalizePhoneNumber,
  sendTwilioSms,
} from "@/lib/integrations/twilio";
import { sendOrderNotificationEmail } from "@/lib/integrations/resend";

type SupabaseClientLike = {
  from: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<{ data?: any; error?: any }>;
};

type OrderNotificationRow = {
  id: string;
  order_id: string;
  owner_user_id: string;
  business_entity_id?: string | null;
  channel: "sms" | "email" | "call";
  notification_kind: "new_order" | "reminder";
  destination: string;
  provider?: string | null;
  provider_message_id?: string | null;
  status:
    | "pending"
    | "sent"
    | "accepted"
    | "delivered"
    | "failed"
    | "undelivered"
    | "skipped";
  attempt_number: number;
  idempotency_key: string;
  error_code?: string | null;
  error_message?: string | null;
  meta?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
};

type OrderContext = {
  order: any;
  business: any;
  user: any;
};

type SendNewOrderNotificationsOptions = {
  client?: SupabaseClientLike;
  now?: Date;
  smsSender?: typeof sendTwilioSms;
  emailSender?: typeof sendOrderNotificationEmail;
};

type SendReminderNotificationsOptions = SendNewOrderNotificationsOptions;

type UpdateTwilioStatusOptions = {
  client?: SupabaseClientLike;
  payload: Record<string, string>;
  receivedAt?: Date;
};

type AcknowledgeOrderOptions = {
  client?: SupabaseClientLike;
  acknowledgedAt?: Date;
};

const ACKNOWLEDGED_ORDER_STATES = new Set([
  "confirmed",
  "ready",
  "out_for_delivery",
  "fulfilled",
]);

function getClient(client?: SupabaseClientLike) {
  return client || getAdminServiceRoleClient();
}

function toIso(date: Date) {
  return date.toISOString();
}

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function normalizeEmail(input: string | null | undefined) {
  const email = String(input || "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function coerceJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildNotificationKey({
  orderId,
  notificationKind,
  channel,
  backup = false,
}: {
  orderId: string;
  notificationKind: "new_order" | "reminder";
  channel: "sms" | "email";
  backup?: boolean;
}) {
  const stage = notificationKind === "new_order" ? "new_order" : channel === "sms" ? "reminder_1" : "reminder_1";
  const backupSuffix = backup ? ":backup" : "";
  return `order:${orderId}:${stage}:${channel}${backupSuffix}:v1`;
}

function mapTwilioCallbackStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "delivered") return "delivered";
  if (normalized === "sent") return "sent";
  if (normalized === "failed") return "failed";
  if (normalized === "undelivered") return "undelivered";
  if (
    normalized === "queued" ||
    normalized === "accepted" ||
    normalized === "sending" ||
    normalized === "scheduled"
  ) {
    return "pending";
  }
  return "pending";
}

export function isValidTwilioStatusTransition(
  current: string | null | undefined,
  incoming: string
) {
  const normalizedCurrent = String(current || "pending").trim().toLowerCase();
  const normalizedIncoming = String(incoming || "pending").trim().toLowerCase();
  const order = ["pending", "sent", "delivered", "failed", "undelivered"];
  const currentIndex = order.indexOf(normalizedCurrent);
  const incomingIndex = order.indexOf(normalizedIncoming);

  if (currentIndex === -1 || incomingIndex === -1) {
    return false;
  }

  return incomingIndex >= currentIndex;
}

function buildOrderUrl(orderNumber: string) {
  let baseUrl = "http://localhost:3000";
  try {
    baseUrl = getAppUrl();
  } catch {
    baseUrl =
      String(process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
      String(process.env.APP_URL || "").trim() ||
      baseUrl;
  }

  const url = new URL("/business/orders", baseUrl);
  url.searchParams.set("tab", "new");
  url.searchParams.set("order", orderNumber);
  return url.toString();
}

function buildSmsBody(order: any) {
  const customerName = String(order?.contact_name || "customer").trim() || "customer";
  return `New order on YourBarrio: Order #${order.order_number}, $${formatMoney(
    order.total
  )} from ${customerName}. View: ${buildOrderUrl(order.order_number)}`;
}

function buildReminderSmsBody(order: any) {
  return `Reminder: Order #${order.order_number} is still waiting in YourBarrio. View: ${buildOrderUrl(
    order.order_number
  )}`;
}

function buildEmailContent({
  order,
  businessName,
  reminder = false,
}: {
  order: any;
  businessName: string;
  reminder?: boolean;
}) {
  const orderUrl = buildOrderUrl(order.order_number);
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const note = String(order?.delivery_instructions || "").trim();
  const fulfillmentLabel = order?.fulfillment_type === "delivery" ? "Delivery" : "Pickup";
  const schedule =
    order?.fulfillment_type === "delivery"
      ? String(order?.delivery_time || "ASAP")
      : String(order?.pickup_time || "ASAP");
  const subject = reminder
    ? `Reminder: order still needs acknowledgment — #${order.order_number}`
    : `New order received — #${order.order_number}`;

  const itemHtml = items
    .map(
      (item: any) => `
        <tr>
          <td style="padding:8px 0;color:#111827;">${escapeHtml(item?.title || "Item")}</td>
          <td style="padding:8px 0;text-align:right;color:#111827;">${escapeHtml(item?.quantity || 0)}</td>
          <td style="padding:8px 0;text-align:right;color:#111827;">$${escapeHtml(
            formatMoney(item?.unit_price)
          )}</td>
        </tr>
      `
    )
    .join("");

  const lines = [
    reminder ? "Reminder: this order still has not been acknowledged." : "A new paid order is ready.",
    "",
    `Order: #${order.order_number}`,
    `Customer: ${order?.contact_name || "Customer"}`,
    `Total: $${formatMoney(order?.total)}`,
    `${fulfillmentLabel}: ${schedule}`,
    note ? `Note: ${note}` : null,
    "",
    `View order: ${orderUrl}`,
  ].filter(Boolean);

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">YourBarrio</p>
        <h1 style="margin:0 0 12px;font-size:24px;color:#111827;">${escapeHtml(subject)}</h1>
        <p style="margin:0 0 18px;line-height:1.6;color:#334155;">
          ${escapeHtml(reminder ? `${businessName}, this order still needs attention.` : `${businessName}, a new paid order just came in.`)}
        </p>
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 20px;">
          <p style="margin:0 0 6px;font-weight:700;">Order #${escapeHtml(order.order_number)}</p>
          <p style="margin:0 0 4px;color:#475569;">Customer: ${escapeHtml(order?.contact_name || "Customer")}</p>
          <p style="margin:0 0 4px;color:#475569;">Total: $${escapeHtml(formatMoney(order?.total))}</p>
          <p style="margin:0;color:#475569;">${escapeHtml(fulfillmentLabel)}: ${escapeHtml(schedule)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
          <thead>
            <tr>
              <th style="padding:0 0 8px;text-align:left;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Item</th>
              <th style="padding:0 0 8px;text-align:right;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Qty</th>
              <th style="padding:0 0 8px;text-align:right;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Unit</th>
            </tr>
          </thead>
          <tbody>${itemHtml}</tbody>
        </table>
        ${
          note
            ? `<p style="margin:0 0 18px;color:#475569;"><strong>Customer note:</strong> ${escapeHtml(note)}</p>`
            : ""
        }
        <p style="margin:0 0 18px;">
          <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
            View order
          </a>
        </p>
      </div>
    </div>
  `;

  return {
    subject,
    html,
    text: lines.join("\n"),
  };
}

async function loadOrderContext(client: SupabaseClientLike, orderId: string): Promise<OrderContext | null> {
  const { data: order, error: orderError } = await client
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message || "Failed to load order notification context");
  }
  if (!order?.id) return null;

  const { data: business, error: businessError } = await client
    .from("businesses")
    .select(
      [
        "id",
        "owner_user_id",
        "business_name",
        "phone",
        "order_alert_phone",
        "order_alert_phone_backup",
        "order_alert_email",
        "sms_opt_in",
        "order_alerts_enabled",
        "phone_verified_at",
      ].join(",")
    )
    .eq("owner_user_id", order.vendor_id)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message || "Failed to load business notification settings");
  }

  const { data: user, error: userError } = await client
    .from("users")
    .select("id,email,phone,business_name,full_name")
    .eq("id", order.vendor_id)
    .maybeSingle();

  if (userError) {
    throw new Error(userError.message || "Failed to load business contact user");
  }

  return { order, business: business || null, user: user || null };
}

async function getExistingNotificationByKey(client: SupabaseClientLike, idempotencyKey: string) {
  const { data, error } = await client
    .from("order_notifications")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load existing order notification");
  }

  return (data || null) as OrderNotificationRow | null;
}

async function insertPendingNotification(
  client: SupabaseClientLike,
  row: Partial<OrderNotificationRow> & {
    order_id: string;
    owner_user_id: string;
    business_entity_id?: string | null;
    channel: "sms" | "email" | "call";
    notification_kind: "new_order" | "reminder";
    destination: string;
    idempotency_key: string;
  }
) {
  const { error } = await client.from("order_notifications").insert({
    status: "pending",
    attempt_number: 1,
    meta: {},
    updated_at: new Date().toISOString(),
    ...row,
  });

  if (!error) {
    return { inserted: true, row: await getExistingNotificationByKey(client, row.idempotency_key) };
  }

  if (String(error.code || "") === "23505") {
    return { inserted: false, row: await getExistingNotificationByKey(client, row.idempotency_key) };
  }

  throw new Error(error.message || "Failed to create order notification row");
}

async function updateNotificationRow(
  client: SupabaseClientLike,
  id: string,
  values: Record<string, unknown>
) {
  const { error } = await client
    .from("order_notifications")
    .update({
      ...values,
      updated_at:
        values.updated_at || new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(error.message || "Failed to update order notification row");
  }
}

async function updateOrderNotificationState(
  client: SupabaseClientLike,
  orderId: string,
  values: Record<string, unknown>
) {
  const { error } = await client.from("orders").update(values).eq("id", orderId);
  if (error) {
    throw new Error(error.message || "Failed to update order notification state");
  }
}

function getNotificationDestinations(context: OrderContext) {
  const primaryPhone =
    normalizePhoneNumber(context.business?.order_alert_phone) ||
    normalizePhoneNumber(context.user?.phone) ||
    normalizePhoneNumber(context.business?.phone);
  const backupPhone = normalizePhoneNumber(context.business?.order_alert_phone_backup);
  const email =
    normalizeEmail(context.business?.order_alert_email) ||
    normalizeEmail(context.user?.email);

  return {
    ownerUserId: context.order.vendor_id,
    businessEntityId: context.business?.id || null,
    phone: primaryPhone,
    backupPhone,
    email,
    alertsEnabled: context.business?.order_alerts_enabled !== false,
    smsEnabled: context.business?.sms_opt_in !== false,
    businessName:
      String(
        context.business?.business_name ||
          context.user?.business_name ||
          context.user?.full_name ||
          "YourBarrio business"
      ).trim() || "YourBarrio business",
  };
}

async function sendEmailNotification({
  client,
  context,
  notificationKind,
  email,
  emailSender,
  now,
}: {
  client: SupabaseClientLike;
  context: OrderContext;
  notificationKind: "new_order" | "reminder";
  email: string | null;
  emailSender: typeof sendOrderNotificationEmail;
  now: Date;
}) {
  const destinations = getNotificationDestinations(context);
  const idempotencyKey = buildNotificationKey({
    orderId: context.order.id,
    notificationKind,
    channel: "email",
  });
  const pending = await insertPendingNotification(client, {
    order_id: context.order.id,
    owner_user_id: destinations.ownerUserId,
    business_entity_id: destinations.businessEntityId,
    channel: "email",
    notification_kind: notificationKind,
    destination: email || "",
    provider: "resend",
    idempotency_key: idempotencyKey,
  });

  if (!pending.inserted || !pending.row?.id) {
    return { action: "skipped_duplicate" as const };
  }

  if (!email) {
    await updateNotificationRow(client, pending.row.id, {
      status: "skipped",
      error_code: "invalid_email",
      error_message: "Missing or invalid business order alert email",
      failed_at: toIso(now),
      updated_at: toIso(now),
      meta: { invalid_destination: true },
    });
    return { action: "invalid_destination" as const };
  }

  try {
    const content = buildEmailContent({
      order: context.order,
      businessName: getNotificationDestinations(context).businessName,
      reminder: notificationKind === "reminder",
    });
    const result = await emailSender({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [
        { name: "order_id", value: context.order.id },
        { name: "notification_kind", value: notificationKind },
      ],
    });

    await updateNotificationRow(client, pending.row.id, {
      status: "sent",
      provider_message_id: result.providerMessageId,
      sent_at: toIso(now),
      updated_at: toIso(now),
      meta: { subject: content.subject },
    });
    return { action: "sent" as const };
  } catch (error: any) {
    await updateNotificationRow(client, pending.row.id, {
      status: "failed",
      error_code: "email_send_failed",
      error_message: String(error?.message || "Email send failed"),
      failed_at: toIso(now),
      updated_at: toIso(now),
      meta: { notification_kind: notificationKind },
    });
    return { action: "failed" as const };
  }
}

async function sendSmsNotification({
  client,
  context,
  notificationKind,
  destination,
  idempotencyKey,
  body,
  smsSender,
  now,
}: {
  client: SupabaseClientLike;
  context: OrderContext;
  notificationKind: "new_order" | "reminder";
  destination: string | null;
  idempotencyKey: string;
  body: string;
  smsSender: typeof sendTwilioSms;
  now: Date;
}) {
  const destinations = getNotificationDestinations(context);
  const pending = await insertPendingNotification(client, {
    order_id: context.order.id,
    owner_user_id: destinations.ownerUserId,
    business_entity_id: destinations.businessEntityId,
    channel: "sms",
    notification_kind: notificationKind,
    destination: destination || "",
    provider: "twilio",
    idempotency_key: idempotencyKey,
  });

  if (!pending.inserted || !pending.row?.id) {
    return { action: "skipped_duplicate" as const };
  }

  if (!destination) {
    await updateNotificationRow(client, pending.row.id, {
      status: "skipped",
      error_code: "invalid_phone",
      error_message: "Missing or invalid business order alert phone",
      failed_at: toIso(now),
      updated_at: toIso(now),
      meta: { invalid_destination: true },
    });
    return { action: "invalid_destination" as const, failureKind: "permanent" as const };
  }

  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      const result = await smsSender({
        to: destination,
        body,
      });

      await updateNotificationRow(client, pending.row.id, {
        status: result.status,
        provider_message_id: result.providerMessageId,
        attempt_number: attempts,
        sent_at: toIso(now),
        updated_at: toIso(now),
        meta: {
          raw_status: result.rawStatus,
        },
      });
      return { action: "sent" as const };
    } catch (error: any) {
      const classified = classifyTwilioError(error);
      const isRetryable = classified.kind === "transient" && attempts < 2;

      await updateNotificationRow(client, pending.row.id, {
        status: "failed",
        attempt_number: attempts,
        error_code: classified.code,
        error_message: classified.message,
        failed_at: toIso(now),
        updated_at: toIso(now),
        meta: {
          failure_kind: classified.kind,
          http_status: classified.statusCode,
          will_retry: isRetryable,
        },
      });

      if (!isRetryable) {
        return {
          action: "failed" as const,
          failureKind: classified.kind,
        };
      }
    }
  }

  return { action: "failed" as const, failureKind: "transient" as const };
}

async function loadOrderNotificationsForOrder(client: SupabaseClientLike, orderId: string) {
  const { data, error } = await client
    .from("order_notifications")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load order notification rows");
  }
  return Array.isArray(data) ? (data as OrderNotificationRow[]) : [];
}

async function assertActorCanAcknowledgeOrder({
  client,
  orderId,
  actorUserId,
}: {
  client: SupabaseClientLike;
  orderId: string;
  actorUserId: string;
}) {
  const { data: order, error: orderError } = await client
    .from("orders")
    .select("id,vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message || "Failed to load order access for acknowledgment");
  }
  if (!order?.id) {
    return false;
  }
  if (order.vendor_id === actorUserId) {
    return true;
  }

  const { data: membership, error: membershipError } = await client
    .from("vendor_members")
    .select("user_id")
    .eq("vendor_id", order.vendor_id)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      membershipError.message || "Failed to verify vendor member acknowledgment access"
    );
  }

  return Boolean(membership?.user_id);
}

export function getDueReminderChannels({
  order,
  notifications,
  now = new Date(),
}: {
  order: any;
  notifications: OrderNotificationRow[];
  now?: Date;
}) {
  if (!order?.first_alert_sent_at || order?.acknowledged_at) {
    return { sms: false, email: false };
  }

  const firstAlertMs = Date.parse(order.first_alert_sent_at);
  if (Number.isNaN(firstAlertMs)) {
    return { sms: false, email: false };
  }

  const elapsedMs = now.getTime() - firstAlertMs;
  const hasReminderSms = notifications.some(
    (row) => row.channel === "sms" && row.notification_kind === "reminder"
  );
  const hasReminderEmail = notifications.some(
    (row) => row.channel === "email" && row.notification_kind === "reminder"
  );

  return {
    sms: elapsedMs >= 5 * 60 * 1000 && !hasReminderSms,
    email: elapsedMs >= 15 * 60 * 1000 && !hasReminderEmail,
  };
}

export async function sendNewOrderNotifications(
  orderId: string,
  options: SendNewOrderNotificationsOptions = {}
) {
  const client = getClient(options.client);
  const now = options.now || new Date();
  const smsSender = options.smsSender || sendTwilioSms;
  const emailSender = options.emailSender || sendOrderNotificationEmail;
  const context = await loadOrderContext(client, orderId);

  if (!context?.order?.id) {
    return { orderId, action: "missing_order" as const };
  }

  const destinations = getNotificationDestinations(context);
  if (!destinations.alertsEnabled) {
    await updateOrderNotificationState(client, orderId, {
      notification_state: "disabled",
    });
    return { orderId, action: "alerts_disabled" as const };
  }

  const smsResult = destinations.smsEnabled
    ? await sendSmsNotification({
        client,
        context,
        notificationKind: "new_order",
        destination: destinations.phone,
        idempotencyKey: buildNotificationKey({
          orderId,
          notificationKind: "new_order",
          channel: "sms",
        }),
        body: buildSmsBody(context.order),
        smsSender,
        now,
      })
    : { action: "sms_disabled" as const };

  if (
    smsResult.action === "failed" &&
    smsResult.failureKind === "permanent" &&
    destinations.backupPhone
  ) {
    await sendSmsNotification({
      client,
      context,
      notificationKind: "new_order",
      destination: destinations.backupPhone,
      idempotencyKey: buildNotificationKey({
        orderId,
        notificationKind: "new_order",
        channel: "sms",
        backup: true,
      }),
      body: buildSmsBody(context.order),
      smsSender,
      now,
    });
  }

  const emailResult = await sendEmailNotification({
    client,
    context,
    notificationKind: "new_order",
    email: destinations.email,
    emailSender,
    now,
  });

  await updateOrderNotificationState(client, orderId, {
    notification_state:
      smsResult.action === "failed" || smsResult.action === "invalid_destination"
        ? "sms_degraded"
        : "awaiting_ack",
    first_alert_sent_at: context.order.first_alert_sent_at || toIso(now),
    last_alert_sent_at: toIso(now),
    escalation_level: 0,
  });

  return {
    orderId,
    action: "processed" as const,
    sms: smsResult.action,
    email: emailResult.action,
  };
}

export async function sendReminderNotifications(
  orderId: string,
  options: SendReminderNotificationsOptions = {}
) {
  const client = getClient(options.client);
  const now = options.now || new Date();
  const smsSender = options.smsSender || sendTwilioSms;
  const emailSender = options.emailSender || sendOrderNotificationEmail;
  const context = await loadOrderContext(client, orderId);

  if (!context?.order?.id) {
    return { orderId, action: "missing_order" as const };
  }

  if (context.order.acknowledged_at) {
    return { orderId, action: "already_acknowledged" as const };
  }

  const notifications = await loadOrderNotificationsForOrder(client, orderId);
  const due = getDueReminderChannels({
    order: context.order,
    notifications,
    now,
  });
  const destinations = getNotificationDestinations(context);

  let sentAny = false;

  if (due.sms && destinations.smsEnabled) {
    const smsResult = await sendSmsNotification({
      client,
      context,
      notificationKind: "reminder",
      destination: destinations.phone,
      idempotencyKey: buildNotificationKey({
        orderId,
        notificationKind: "reminder",
        channel: "sms",
      }),
      body: buildReminderSmsBody(context.order),
      smsSender,
      now,
    });
    sentAny = sentAny || smsResult.action === "sent";
  }

  if (due.email) {
    const emailResult = await sendEmailNotification({
      client,
      context,
      notificationKind: "reminder",
      email: destinations.email,
      emailSender,
      now,
    });
    sentAny = sentAny || emailResult.action === "sent";
  }

  if (sentAny || due.sms || due.email) {
    await updateOrderNotificationState(client, orderId, {
      notification_state: sentAny ? "reminder_sent" : context.order.notification_state || "awaiting_ack",
      last_alert_sent_at: sentAny ? toIso(now) : context.order.last_alert_sent_at,
      escalation_level:
        due.email || context.order.escalation_level >= 1
          ? 2
          : due.sms
            ? 1
            : context.order.escalation_level || 0,
    });
  }

  return { orderId, action: sentAny ? "processed" as const : "noop" as const, due };
}

export async function markOrderAcknowledged(
  orderId: string,
  actorUserId: string,
  options: AcknowledgeOrderOptions = {}
) {
  const client = getClient(options.client);
  const acknowledgedAt = options.acknowledgedAt || new Date();
  const canAcknowledge = await assertActorCanAcknowledgeOrder({
    client,
    orderId,
    actorUserId,
  });

  if (!canAcknowledge) {
    throw new Error("Unauthorized to acknowledge this order");
  }

  const { data: existing, error: loadError } = await client
    .from("orders")
    .select("id,acknowledged_at")
    .eq("id", orderId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message || "Failed to load order acknowledgment state");
  }
  if (!existing?.id) {
    return null;
  }
  if (existing.acknowledged_at) {
    return existing;
  }

  const { error } = await client
    .from("orders")
    .update({
      acknowledged_at: toIso(acknowledgedAt),
      acknowledged_by: actorUserId,
      notification_state: "acknowledged",
      updated_at: toIso(acknowledgedAt),
    })
    .is("acknowledged_at", null)
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message || "Failed to acknowledge order");
  }

  const { data: updated, error: updatedError } = await client
    .from("orders")
    .select("id,acknowledged_at,acknowledged_by,notification_state")
    .eq("id", orderId)
    .maybeSingle();

  if (updatedError) {
    throw new Error(updatedError.message || "Failed to reload acknowledged order");
  }

  return updated || existing;
}

export async function markOrderAcknowledgedForStatusChange({
  orderId,
  actorUserId,
  nextStatus,
  client,
}: {
  orderId: string;
  actorUserId: string;
  nextStatus: string;
  client?: SupabaseClientLike;
}) {
  if (!ACKNOWLEDGED_ORDER_STATES.has(String(nextStatus || "").trim())) {
    return null;
  }
  return markOrderAcknowledged(orderId, actorUserId, { client });
}

export async function findOrdersNeedingReminderProcessing({
  client,
  limit = 50,
  now = new Date(),
}: {
  client?: SupabaseClientLike;
  limit?: number;
  now?: Date;
}) {
  const effectiveClient = getClient(client);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const { data, error } = await effectiveClient
    .from("orders")
    .select("id,first_alert_sent_at,acknowledged_at,notification_state,escalation_level")
    .in("notification_state", ["awaiting_ack", "sms_degraded", "reminder_sent"])
    .is("acknowledged_at", null)
    .lte("first_alert_sent_at", fiveMinutesAgo)
    .order("first_alert_sent_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load orders needing notification reminders");
  }

  return Array.isArray(data) ? data : [];
}

export async function acquireReminderWorkerLock(client?: SupabaseClientLike) {
  const effectiveClient = getClient(client);
  if (!effectiveClient.rpc) return false;

  const { data, error } = await effectiveClient.rpc(
    "try_acquire_order_notification_reminders_lock"
  );

  if (error) {
    throw new Error(error.message || "Failed to acquire reminder worker lock");
  }

  return data === true;
}

export async function releaseReminderWorkerLock(client?: SupabaseClientLike) {
  const effectiveClient = getClient(client);
  if (!effectiveClient.rpc) return false;

  const { data, error } = await effectiveClient.rpc(
    "release_order_notification_reminders_lock"
  );

  if (error) {
    throw new Error(error.message || "Failed to release reminder worker lock");
  }

  return data === true;
}

export async function reconcileStaleSmsNotifications({
  client,
  now = new Date(),
  limit = 50,
}: {
  client?: SupabaseClientLike;
  now?: Date;
  limit?: number;
}) {
  const effectiveClient = getClient(client);
  const staleBefore = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await effectiveClient
    .from("order_notifications")
    .select("id,meta")
    .eq("channel", "sms")
    .eq("status", "sent")
    .lte("sent_at", staleBefore)
    .order("sent_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load stale SMS notifications");
  }

  let reconciled = 0;
  for (const row of data || []) {
    await updateNotificationRow(effectiveClient, row.id, {
      updated_at: toIso(now),
      meta: {
        ...coerceJsonObject(row.meta),
        stale_reconciliation: {
          checked_at: toIso(now),
          status: "stale_sent_over_2h",
        },
      },
    });
    reconciled += 1;
  }

  return reconciled;
}

export async function updateOrderNotificationFromTwilioCallback({
  client,
  payload,
  receivedAt = new Date(),
}: UpdateTwilioStatusOptions) {
  const effectiveClient = getClient(client);
  const providerMessageId = String(payload.MessageSid || payload.SmsSid || "").trim();
  if (!providerMessageId) {
    return { updated: false, reason: "missing_message_sid" as const };
  }

  const { data: row, error } = await effectiveClient
    .from("order_notifications")
    .select("*")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load notification for Twilio callback");
  }
  if (!row?.id) {
    return { updated: false, reason: "missing_notification" as const };
  }

  const nextStatus = mapTwilioCallbackStatus(payload.MessageStatus);
  if (!isValidTwilioStatusTransition(row.status, nextStatus)) {
    return { updated: false, reason: "out_of_order_ignored" as const };
  }

  const meta = {
    ...coerceJsonObject(row.meta),
    twilio_callback: payload,
  };

  const updates: Record<string, unknown> = {
    status: nextStatus,
    error_code: payload.ErrorCode || row.error_code || null,
    error_message: payload.ErrorMessage || row.error_message || null,
    updated_at: toIso(receivedAt),
    meta,
  };

  if (nextStatus === "delivered") {
    updates.delivered_at = toIso(receivedAt);
  }
  if (nextStatus === "failed" || nextStatus === "undelivered") {
    updates.failed_at = toIso(receivedAt);
  }

  await updateNotificationRow(effectiveClient, row.id, updates);

  return { updated: true, status: nextStatus };
}
