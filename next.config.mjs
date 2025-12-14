/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the experimental React Compiler in prod; it can interfere with event handling
  // on some builds. Flip on locally by setting NEXT_PUBLIC_REACT_COMPILER=true if needed.
  reactCompiler: process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_REACT_COMPILER !== "false",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "crskbfbleiubpkvyvvlf.supabase.co", 
      },
    ],
  },
};

export default nextConfig;
