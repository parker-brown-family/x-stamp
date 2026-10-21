# Security controls

Difficulty: 3/10 — contained repairs with reproduced failures; no gates. Parker authorized all five fixes on 2026-10-21.

Implemented in version 0.3.2:

- Release packaging scans the exact bytes it archives, handles whitespace filenames, rejects symlinks and read errors, and replaces an archive only on success.
- Off aborts active requests and settles queued callers without uploading them.
- Recording changes and Clear invalidate older work; recording writes and deletion are serialized.
- Local storage is restricted to trusted extension contexts. Content scripts receive only enabled state and can request judgments; options commands validate their sender.
- Requests have bounded input, six active slots, 24 waiting slots, minute limits and a persistent daily allowance. Cache and recording retention have byte and entry caps.

Validation: 18 offline tests; 11 Chromium security scenarios (12 tests including their parent); live end-to-end pass with 19 requests, zero errors, $0.002063334 reported cost, and no additional requests after toggling or reloading. Dependency audit reported zero known advisories.

Request limits: 1,000 per UTC day, 60 per rolling minute overall, 30 per rolling minute per tab. They also apply to explicit Options tests. The daily counter reserves before sending and can count cancelled work. These initial caps are conservative choices, not measured optimal rates. A provider key spending limit remains necessary for a dollar cap.

Post-hoc difficulty: 3/10. The repairs used standard cancellation, serialized storage, and finite admission; real Chromium checks covered the browser-specific behavior.
