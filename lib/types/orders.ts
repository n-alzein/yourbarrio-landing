import type { FulfillmentType } from "./cart";

export type OrderStatus =
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
  created_at?: string | null;
  order_items?: OrderItem[];
};
