import type { MetadataRoute } from "next";

// Google may read the public pages; the studio, the Panel and the API are private.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/empezar"] }],
    sitemap: "https://www.creadsia.com/sitemap.xml",
  };
}
