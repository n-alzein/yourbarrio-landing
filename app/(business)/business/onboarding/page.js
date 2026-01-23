"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const PLACES_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "1" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DISABLE_PLACES !== "false");

// ------------------------------
// State + reducer (must be ABOVE component)
// ------------------------------
const initialForm = {
  businessName: "",
  category: "",
  description: "",
  address: "",
  phone: "",
  website: "",
};

function formReducer(state, action) {
  return { ...state, [action.field]: action.value };
}

// ------------------------------
// MAIN COMPONENT (only ONE export default)
// ------------------------------
export default function BusinessOnboardingPage() {
  const { user, loadingUser } = useAuth();
  const router = useRouter();

  const [form, dispatch] = useReducer(formReducer, initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const pickedLocationRef = useRef(null); // stores { lat, lng } from address lookup

  function updateField(field, value) {
    dispatch({ field, value });
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    const parts = [];

    if (digits.length > 0) parts.push("(" + digits.slice(0, 3));
    if (digits.length >= 4) parts.push(") " + digits.slice(3, 6));
    if (digits.length >= 7) parts.push("-" + digits.slice(6, 10));

    return parts.join("");
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || PLACES_DISABLED) {
      setAddressSuggestions([]);
      return;
    }

    const query = form.address.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json`
        );
        url.searchParams.set("access_token", MAPBOX_TOKEN);
        url.searchParams.set("types", "address");
        url.searchParams.set("limit", "5");
        url.searchParams.set("autocomplete", "true");

        const res = await fetch(url.toString());
        if (!res.ok) return;
        const payload = await res.json();
        const nextSuggestions = (payload.features || [])
          .map((feature) => {
            const center = Array.isArray(feature.center) ? feature.center : [];
            const [lng, lat] = center;
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return {
              label: feature.place_name || feature.text,
              coords: { lat, lng },
            };
          })
          .filter(Boolean);
        if (!cancelled) {
          setAddressSuggestions(nextSuggestions);
        }
      } catch (err) {
        if (!cancelled) {
          setAddressSuggestions([]);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [form.address]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (loadingUser) {
        setLoading(false);
        return;
      }

      const verifiedUser = user;
      if (!verifiedUser) {
        setMessage("You must be logged in to create a business.");
        setLoading(false);
        router.push("/business-auth/login");
        return;
      }

      // 2) Create or update business entry via server (service role bypasses RLS)
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: verifiedUser.id,
          name: form.businessName,
          category: form.category,
          description: form.description,
          address: form.address,
          phone: form.phone,
          website: form.website,
          latitude: pickedLocationRef.current?.lat ?? null,
          longitude: pickedLocationRef.current?.lng ?? null,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to save business");
      }

      const payload = await res.json();

      // 3) Redirect to business profile
      router.push(`/customer/b/${payload.id}`);
    } catch (err) {
      console.error("Business onboarding failed", err);
      setMessage(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-28 pb-20 relative text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-black to-slate-900 opacity-60 -z-10" />
      <div className="absolute inset-0 backdrop-blur-3xl -z-10" />

      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Create Your Business Profile
        </h1>

        <p className="text-center text-white/70 max-w-xl mx-auto mb-12">
          Help people in your neighborhood discover your business.
        </p>

        {message && (
          <div className="mb-6 text-center text-lg font-medium">{message}</div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6"
        >
          <FormField
            label="Business Name"
            value={form.businessName}
            placeholder="e.g., Barrio Coffee House"
            onChange={(v) => updateField("businessName", v)}
            required
          />

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/30 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              required
            >
              <option value="" disabled>
                Select a category
              </option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="text-black">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <FormTextArea
            label="Description"
            value={form.description}
            placeholder="Tell customers what makes your business special..."
            rows={4}
            onChange={(v) => updateField("description", v)}
            required
          />

          <FormField
            label="Address"
            value={form.address}
            placeholder="Street, City, ZIP"
            listId="address-suggestions"
            onChange={(v) => {
              updateField("address", v);
              const match = addressSuggestions.find((item) => item.label === v);
              pickedLocationRef.current = match ? match.coords : null;
            }}
            required
          />
          {addressSuggestions.length ? (
            <datalist id="address-suggestions">
              {addressSuggestions.map((item) => (
                <option key={item.label} value={item.label} />
              ))}
            </datalist>
          ) : null}

          <FormField
            label="Phone Number"
            value={form.phone}
            placeholder="(555) 123-4567"
            onChange={(v) => updateField("phone", formatPhone(v))}
          />

          <FormField
            label="Website"
            value={form.website}
            placeholder="https://"
            type="url"
            onChange={(v) => updateField("website", v)}
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl text-lg font-semibold text-white
              bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500
              shadow-xl transition transform
              ${
                loading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:scale-[1.02] active:scale-95"
              }
            `}
          >
            {loading ? "Creating..." : "Create Business Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------
// Reusable inputs
// ------------------------------
function FormField({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  required = false,
  listId,
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        required={required}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/30
          text-white placeholder-white/40 focus:ring-2 focus:ring-purple-500 
          focus:border-transparent outline-none"
      />
    </div>
  );
}

function FormTextArea({
  label,
  value,
  placeholder,
  onChange,
  rows = 3,
  required = false,
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/30
          text-white placeholder-white/40 focus:ring-2 focus:ring-purple-500 
          focus:border-transparent outline-none"
      />
    </div>
  );
}
