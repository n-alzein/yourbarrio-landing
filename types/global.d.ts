export {};

declare global {
  interface UserProfile {
    id?: string;
    full_name?: string | null;
    business_name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    address_2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    profile_photo_url?: string | null;
    website?: string | null;
    role?: string | null;
  }

  interface Window {
    __ybWebVitals?: (payload: {
      id: string;
      name: string;
      value: number;
      rating?: string;
      delta?: number;
      navigationType?: string;
    }) => void;
  }
}
