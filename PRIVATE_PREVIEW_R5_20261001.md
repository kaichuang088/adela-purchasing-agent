# AdelaPA private preview R5 — 2026-10-01

Continues the existing owner-private project appgprj_6ab47d9a2d1881919a796ec9b609c7b4. Netlify and Stripe have not been deployed or connected in this update.

Implemented:
- One coffee product with three 32g single-tin flavors; one gummy product with three 67g single-pouch flavors. Legacy listings discontinued, historical orders preserved.
- Shared exact-spec Taiwan reference ceiling: all-in product price (including purchasing/size fees, excluding delivery) at most floor(reference × 95%). Uses the lower recorded promotion when present. Product display and server checkout use the same cap. Products without matched references remain visible but cannot be ordered; no fabricated Taiwan prices.
- 23 additional requested selections: two Aesop SKUs ready for ordering, 21 explicit research candidates including screenshot collections, UNOVE, makeprem, Condition, RE:NEW PHY, toys and snacks. Candidate names/photos/specs and evidence limitations are recorded in lib/requested-catalog-20261001.json. Reference screenshots are clearly for selections whose exact SKU remains unverified.
- Brand changed to Adela’s 代購. Customer-facing administration links removed.
- Order-linked admin messaging automatically inserts an order summary, with ownership validation and deduplication.
- Fixed 24-hour single-line stage timestamps, redesigned message composer/bubbles, yellow buyer-payment-review badge, contained service and email panels.
- PWA manifest, home-screen icon and service worker. Opt-in phone push uses standard VAPID and empty payloads; no private-page/API caching or customer data in push payloads. Member-only endpoint registration, provider-host allowlist, unsubscribe, deduplication cursor, leases, expiry cleanup and retries. No actual device subscription or real phone delivery has been tested.
- GPT 6.1 Sol model selection (gpt-6.1-sol) in code/runtime. AI credentials remain absent: no live AI completion claimed. Email credentials also absent; email outbox retained.

Validation:
- TypeScript and Sites build passed.
- 16 focused integration checks passed against compiled Worker and isolated D1; 40 purchasable specs verified display=checkout and <=95% cap; 108 visible entries, 21 marked research.
- 7 response-error checks and all five newer migration exec checks passed, including push subscription migration.
- All 10 new remote product images returned 200 with image content types; reference screenshot files exist locally.
- Browser visual QA and real mobile push delivery not performed. Historical R4 comprehensive test count is not represented as a new R5 run. Old catalog-count assertions/uncapped fixture pricing tests need revised fixtures for R5 contracts.

Remaining before full catalog acceptance / Netlify:
- Complete Taiwan exact-spec sourcing for all pending existing products and 21 research selections; verify collab availability, full reference-photo SKU identities, cold-chain suitability, and sizes.
- Real iPhone/Android opt-in delivery test. Private Sites authentication may require reopening/signing in to access notifications; this has not been validated on a phone.
- AI credentials and live GPT 6.1 Sol completion; optional email provider credentials and inbox confirmation.
- User review of private preview before Netlify production publication. Stripe remains deferred by user request.
