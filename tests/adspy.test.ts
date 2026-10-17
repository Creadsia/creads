import { test } from "node:test";
import assert from "node:assert/strict";
import { readAd } from "../src/lib/providers/adspy";

const now = Date.parse("2026-10-17T12:00:00Z");

test("ad library: a video ad is read with its days running and versions", () => {
  const ad = readAd({
    ad_archive_id: "1234567890", page_name: "Seguros Pepe", is_active: true, start_date: Date.parse("2026-08-18T12:00:00Z") / 1000, collation_count: 4,
    publisher_platform: ["FACEBOOK", "INSTAGRAM"],
    snapshot: { body: { text: "¿Pagas mucho por tu seguro?" }, cta_text: "Más información", link_url: "https://pepe.cl", page_profile_picture_url: "https://x.fbcdn.net/p.jpg",
      videos: [{ video_hd_url: "https://video.fbcdn.net/v.mp4", video_preview_image_url: "https://x.fbcdn.net/v.jpg" }] },
  }, now)!;
  assert.equal(ad.id, "1234567890");
  assert.equal(ad.days, 60);
  assert.equal(ad.copies, 4);
  assert.equal(ad.video, "https://video.fbcdn.net/v.mp4");
  assert.equal(ad.start, "2026-08-18");
  assert.deepEqual(ad.platforms, ["FACEBOOK", "INSTAGRAM"]);
});

test("ad library: carousels, placeholders, stopped ads and unsafe links", () => {
  const ad = readAd({
    ad_archive_id: 99, page_name: "Tienda", is_active: false, start_date: "2026-10-01", end_date: "2026-10-11",
    snapshot: { body: { text: "{{product.brand}}" }, cards: [{ body: "Zapatillas -30%", original_image_url: "https://x.fbcdn.net/i.jpg", link_url: "javascript:alert(1)" }] },
  }, now)!;
  assert.equal(ad.text, "Zapatillas -30%");
  assert.equal(ad.image, "https://x.fbcdn.net/i.jpg");
  assert.equal(ad.link, null);
  assert.equal(ad.days, 10);
  assert.equal(ad.active, false);
  assert.equal(readAd({ page_name: "sin id" }), null);
  assert.equal(readAd(null), null);
});
