"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const PLACES_MODE =
  process.env.NEXT_PUBLIC_PLACES_MODE || process.env.PLACES_MODE || "prod";
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
  const [mapsError, setMapsError] = useState("");
  const addressInputRef = useRef(null);
  const pickedLocationRef = useRef(null); // stores { lat, lng } from Places

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

  // Lazily load Google Maps Places and wire autocomplete to the address field
  useEffect(() => {
    if (!MAPS_API_KEY || PLACES_DISABLED || PLACES_MODE === "dev") {
      setMapsError("Address autocomplete is disabled in this environment.");
      return;
    }

    let destroyed = false;
    let autocomplete;

    const loadMaps = () => {
      // Reuse existing loader promise if present
      if (!window.__ybMapsLoader) {
        window.__ybMapsLoader = new Promise((resolve, reject) => {
          // Avoid duplicate script tags
          const existing = Array.from(document.scripts || []).find((s) =>
            s.src?.includes("maps.googleapis.com/maps/api/js")
          );
          if (existing && existing.src.includes("key=")) {
            existing.addEventListener("load", () => resolve(window.google));
            existing.addEventListener("error", reject);
            return;
          }
          if (existing && !existing.src.includes("key=")) {
            existing.remove();
          }

          const params = new URLSearchParams({
            key: MAPS_API_KEY,
            libraries: "places",
          });

          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
          script.async = true;
          script.defer = true;
          script.onload = () => resolve(window.google);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      return window.__ybMapsLoader;
    };

    loadMaps()
      .then((google) => {
        if (destroyed || !addressInputRef.current || !google?.maps?.places) return;

        autocomplete = new google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            types: ["address"],
            fields: ["formatted_address", "geometry"],
          }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const formatted = place?.formatted_address;
          const loc = place?.geometry?.location;

          if (formatted) {
            updateField("address", formatted);
          }

          if (loc) {
            pickedLocationRef.current = {
              lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
              lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
            };
          } else {
            pickedLocationRef.current = null;
          }
        });
      })
      .catch((err) => {
        console.warn("Failed to load Google Maps", err);
        if (!destroyed) {
          setMapsError("Address autocomplete failed to load.");
        }
      });

    return () => {
      destroyed = true;
    };
  }, []);

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
      router.push(`/b/${payload.id}`);
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
            onChange={(v) => updateField("address", v)}
            required
          />

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
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
