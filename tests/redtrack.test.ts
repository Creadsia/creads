import { test } from "node:test";
import assert from "node:assert/strict";
import { postbackUrl, rtkFrom } from "../src/lib/redtrack";

test("redtrack: postback URL and click id from cookies", () => {
  assert.equal(postbackUrl("https://trk.creadsia.com/", "abc123DEF456", "Purchase", 99), "https://trk.creadsia.com/postback?clickid=abc123DEF456&type=Purchase&sum=99");
  assert.equal(postbackUrl("trk.creadsia.com", "abc123DEF456", "CompleteRegistration"), "https://trk.creadsia.com/postback?clickid=abc123DEF456&type=CompleteRegistration");
  assert.equal(rtkFrom({ "rtkclickid-store": "abc123DEF456" }), "abc123DEF456");
  assert.equal(rtkFrom({ creads_rtk: "zzzzzzzzzzzz" }), "zzzzzzzzzzzz");
  assert.equal(rtkFrom({ "rtkclickid-store": "<script>" }), undefined);
});
