import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Showcase images generated for the site (to be moved to Creads' own storage in Phase 1).
    remotePatterns: [{ protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net" }],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
