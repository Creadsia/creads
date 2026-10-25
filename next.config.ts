import type { NextConfig } from "next";

const ffmpegFiles = ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**", "./assets/sfx/**"];

// Security headers for every page and API answer.
// The page scripts Next.js writes inline need 'unsafe-inline'; everything else is locked to our own site,
// our storage (Supabase), the landing videos (CloudFront), ElevenLabs' voice samples and the Meta Pixel.
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net https://sdk.mercadopago.com https://*.mlstatic.com https://*.mercadopago.com https://*.mercadolibre.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://*.mlstatic.com",
  "img-src 'self' data: blob: https://*.mlstatic.com https://*.mercadopago.com https://*.supabase.co https://*.cloudfront.net https://www.facebook.com https://*.fbcdn.net",
  "media-src 'self' blob: https://*.supabase.co https://*.cloudfront.net https://storage.googleapis.com https://*.fbcdn.net",
  "font-src 'self' data: https://*.mlstatic.com",
  `connect-src 'self' https://*.supabase.co https://www.facebook.com https://connect.facebook.net https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com${dev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "frame-src https://www.facebook.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PostHog through our own domain (no outside script, and ad blockers don't break the measurement)
  skipTrailingSlashRedirect: true,
  // what Creads no longer sells (owner and Benjamín, 21-22 Oct 2026: UGC ads and images for business owners)
  // goes to the home page; temporary, so any of them can come back
  async redirects() {
    return ["/en", "/en/:path*", "/ia/:path*", "/curso", "/curso/:path*"].map((source) => ({ source, destination: "/", permanent: false }));
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // private pages and data are never stored by browsers or shared caches
      ...["/app/:path*", "/admin/:path*", "/api/:path*"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: "private, no-store" }] })),
    ];
  },
  images: {
    // Showcase images generated for the site (to be moved to Creads' own storage in Phase 1).
    remotePatterns: [{ protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net" }, { protocol: "https", hostname: "d2ol7oe51mr4n9.cloudfront.net" }],
    formats: ["image/avif", "image/webp"],
  },
  // The montage runs FFmpeg inside the serverless function: ship the binary and the caption font with it.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/montage": ffmpegFiles,
    // «Editor de video»: the export cuts, burns texts and subtitles and mixes the music
    "/api/ads/[id]/editor/exportar": ffmpegFiles,
    "/api/review": ffmpegFiles,
    // the assistant's review (frame sheet) and «Persona real» (cuts a piece of the person's video)
    "/api/v1/anuncios/[id]/revisar": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/clips/run": ["./node_modules/ffmpeg-static/ffmpeg"],
    // «Demo con presentador»: split screen, the prompt card and the captions (needs the fonts too)
    "/api/v1/montajes": ffmpegFiles,
    "/api/v1/anuncios/[id]/subtitulos": ffmpegFiles,
    "/api/inspiracion": ["./node_modules/ffmpeg-static/ffmpeg"],
    // GPT Image draws 2:3, the ad formats (9:16, 4:5) are cut from it
    "/api/generate/image": ["./node_modules/ffmpeg-static/ffmpeg"],
    // «Primera tanda»: the brand's logo is put on each finished image
    "/api/tanda": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/historias/montar": ffmpegFiles,
    "/api/historias/dialogos": ["./node_modules/ffmpeg-static/ffmpeg"],
    // voice samples are cleaned up (any audio or video → mono mp3) before cloning
    "/api/voices/clone": ["./node_modules/ffmpeg-static/ffmpeg"],
    // the tools measure uploaded videos and audio with FFmpeg before spending
    "/api/tools/*": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
