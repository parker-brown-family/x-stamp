// Put X into its own "Lights out" display setting in the x-stamp profile: the
// night_mode cookie (2 = Lights out) that X keeps per browser, not per account.
// Run once with the window open on X_STAMP_DEBUG_PORT; the cookie stays.
import { chromium } from "playwright";
const b = await chromium.connectOverCDP(`http://127.0.0.1:${process.env.X_STAMP_DEBUG_PORT ?? "9333"}`);
const ctx = b.contexts()[0];
const before = (await ctx.cookies("https://x.com")).find((c) => c.name === "night_mode");
await ctx.addCookies([{ name: "night_mode", value: "2", domain: ".x.com", path: "/", secure: true, sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365 * 2 }]);
const page = ctx.pages().find((p) => p.url().startsWith("https://x.com/"));
if (page) {
  await page.reload();
  await page.waitForTimeout(3000);
}
const bg = page ? await page.evaluate(() => getComputedStyle(document.body).backgroundColor) : "no x.com tab";
console.log(JSON.stringify({ before: before?.value ?? "unset", now: "2", bodyBg: bg }));
process.exit(0);
