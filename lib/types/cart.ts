export type FulfillmentType = "delivery" | "pickup";
export type CartStatus = "active" | "submitted" | "abandoned";

export type CartItem = {
  id: string;
  cart_id: string;
  listing_id: string;
  vendor_id: string;
  variant_id?: string | null;
  variant_label?: string | null;
  selected_options?: Record<string, string> | null;
  quantity: number;
  title: string;
  unit_price: number | null;
  image_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Cart = {
  id: string;
  user_id: string;
  vendor_id: string;
  status: CartStatus;
  fulfillment_type: FulfillmentType | null;
  available_fulfillment_methods?: FulfillmentType[];
  delivery_fee_cents?: number;
  delivery_notes?: string | null;
  delivery_min_order_cents?: number | null;
  delivery_radius_miles?: number | null;
  delivery_unavailable_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cart_items?: CartItem[];
};

export type VendorSummary = {
  id: string;
  business_name?: string | null;
  full_name?: string | null;
  profile_photo_url?: string | null;
  city?: string | null;
  address?: string | null;
};

export type CartResponse = {
  cart: Cart | null;
  vendor: VendorSummary | null;
  carts?: Cart[];
  vendors?: Record<string, VendorSummary>;
};
