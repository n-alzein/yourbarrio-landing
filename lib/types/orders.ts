import type { FulfillmentType } from "./cart";

export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "requested"
  | "confirmed"
  | "ready"
  | "out_for_delivery"
  | "fulfilled"
  | "completed"
  | "cancelled";

export type OrderItem = {
  id: string;
  order_id: string;
  listing_id?: string | null;
  title: string;
  unit_price: number | null;
  image_url: string | null;
  quantity: number;
  created_at?: string | null;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  vendor_id: string;
  cart_id?: string | null;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  delivery_address1?: string | null;
  delivery_address2?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_postal_code?: string | null;
  delivery_instructions?: string | null;
  delivery_time?: string | null;
  pickup_time?: string | null;
  subtotal: number;
  fees: number;
  total: number;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  platform_fee_amount?: number;
  currency?: string | null;
  paid_at?: string | null;
  notification_state?: string | null;
  first_alert_sent_at?: string | null;
  last_alert_sent_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  escalation_level?: number;
  created_at?: string | null;
  order_items?: OrderItem[];
  order_notifications?: Array<{
    id: string;
    channel: "sms" | "email" | "call";
    notification_kind: "new_order" | "reminder";
    status: string;
    destination: string;
    provider?: string | null;
    provider_message_id?: string | null;
    error_code?: string | null;
    error_message?: string | null;
    attempt_number?: number;
    meta?: Record<string, unknown> | null;
    created_at?: string | null;
    sent_at?: string | null;
    delivered_at?: string | null;
    failed_at?: string | null;
  }>;
};
