export type FulfillmentType = "delivery" | "pickup";
export type CartStatus = "active" | "submitted" | "abandoned";

export type CartItem = {
  id: string;
  cart_id: string;
  listing_id: string;
  vendor_id: string;
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
};
