import { test } from "node:test";
import assert from "node:assert/strict";
import { validPost, trimRows } from "../extension/lib/limits.js";
import { askJev } from "../extension/lib/jev.js";

test("input bounds retain observed fields and reject oversized context without truncation", () => {
  assert.deepEqual(validPost({ text: "a post", unrelated: "discard" }), { text: "a post" });
  assert.equal(validPost({ text: " " }), null);
  for (const [field, length] of [["text", 20000], ["author", 256], ["quoted_text", 10000], ["link_card", 2000]]) {
    assert.ok(validPost({ text: "a post", [field]: "x".repeat(length) }));
    assert.equal(validPost({ text: "a post", [field]: "x".repeat(length + 1) }), null);
  }
});
test("retention bounds use UTF-8 bytes, keep newest rows, and retain explicit unknowns", () => {
  const rows = [{ text: "old", ms: null }, { text: "é".repeat(20), ms: null }, { text: "new", ms: null }];
  assert.deepEqual(trimRows(rows, 1, 1000), [rows[2]]);
  const kept = trimRows(rows, 300, 60);
  assert.deepEqual(kept, [rows[2]]);
  assert.ok(new TextEncoder().encode(JSON.stringify(kept)).length <= 60);
  assert.deepEqual(trimRows(rows, 300, 2), []);
});
test("an already-cancelled job never calls fetch", async () => {
  const ctl = new AbortController(); ctl.abort();
  let calls = 0;
  const result = await askJev("dummy", {}, async () => { calls++; }, { signal: ctl.signal });
  assert.equal(calls, 0);
  assert.equal(result.reason, "cancelled");
});
