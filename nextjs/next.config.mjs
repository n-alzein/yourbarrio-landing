/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  images: {
    domains: [
      "lh3.googleusercontent.com",  // ← REQUIRED for Google avatars
      "your-supabase-project-id.supabase.co", // (optional) for Supabase storage
    ],
  },
};

export default nextConfig;
