import type { NextConfig } from "next";

const ffmpegFiles = ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**"];

const nextConfig: NextConfig = {
  images: {
    // Showcase images generated for the site (to be moved to Creads' own storage in Phase 1).
    remotePatterns: [{ protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net" }],
    formats: ["image/avif", "image/webp"],
  },
  // The montage runs FFmpeg inside the serverless function: ship the binary and the caption font with it.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/montage": ffmpegFiles,
    "/api/review": ffmpegFiles,
  },
};

export default nextConfig;
