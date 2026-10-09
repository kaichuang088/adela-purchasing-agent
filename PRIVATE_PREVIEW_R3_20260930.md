# AdelaPA private preview R3 — 2026-09-30

This revision integrates the uploaded R2 recovery snapshot into the original owner-private preview site in this conversation. The attachment project appgprj_6ab8b6da8d988191a1db39f6f4a6dd6c returned NOT_FOUND in the current workspace. The target is the existing editable owner-private project appgprj_6ab47d9a2d1881919a796ec9b609c7b4. The user requested updating their private site; this mapping was disclosed before source edits. No new site is created and no Netlify site is deployed.

## Included

R2 transaction, catalog, coupon, multilingual, mobile admin and PDF fixes are preserved. Historical SQL migrations already present in the target were byte-identical before integration. Existing D1 binding DB remains unchanged; BUCKET follows the supplied R2 image-storage declaration.

Additional R3 changes:
- Empty/non-JSON/HTML/redirected responses have clear connection or re-login messages in core storefront, authentication and admin AI operations.
- AI Scan offers select-all and review-all, while each item remains individually deselectable. Approval requires successful image loading plus reviewed price, specification, source and stock; missing/failed images cannot be mass-approved.
- Admin settings shows database readiness, configured AI model, email configuration and the last successful scheduled execution. Configured is not the same as tested/operational.
- Scheduled worker writes a success heartbeat only after successful processing; failure never advances it.
- Local preview catalog assertion no longer incorrectly requires the old 50-product count.

## Verification

TypeScript and Sites build passed on this source. Eighteen compiled-app suites passed with 401 named checks, including the rerun of regression tests after updating the expected revision identifier; seven separate response/error tests passed. AI and Email in these suites use mocks. The R2 browser/PDF evidence remains historical R2 evidence, not a new R3 browser run. Current environment does not expose the required control-browser skill, so no new browser run is claimed.

The catalog test confirms 93 visible products on an isolated fresh database. Production catalog initialization is insert-only or conditional and preserves seller-edited content/discontinued status, so existing preview totals can differ. There are still 55 unverified matching Taiwan-price references and additional private candidate drafts; no price was invented in R3.

## Remaining external work

Live AI credentials/model access, real email sender and inbox verification, platform cron activation, complete matching Taiwan references, remaining fashion availability and original offshore/reference screenshots remain incomplete. Private publication does not authorize Netlify production deployment or establish Stripe live payments. Existing admin secret is preserved rather than copied into source.

The release gate file retains the historical formal-release block and records the separate user-authorized private-preview publication. Native deployment success is recorded in the downloadable delivery receipt, not predicted here.

## Private deployment migration repair

The first publication attempt failed with `incomplete input: SQLITE_ERROR` (deployment appgdep_6abd282233988191af5f9504e6f0b1e2). A follow-up native database overview showed all the new wallet, reservation, email and admin-preview tables still absent. Existing database tables remained present.

A disposable D1 binding using its migration `exec` path reproduced the identical error at 0017_atomic_stock.sql, statement 2: the multi-line CREATE TRIGGER header was treated as an incomplete line. Only new, unapplied SQL in 0017, 0018 and 0020 was formatted as one complete statement per line. Logical SQL and trigger guards are preserved; no historical migration or production row was edited and no runtime schema bootstrap was introduced.

After correction, the four new migration files passed the binding's exec path. Wallet/delivery (30), credit-reconciliation (20) and actual proxy/shared-backend logic (16) were rechecked on the corrected schema and passed. These are isolated tests, not live Stripe, AI or email delivery.

Documentation for the D1 exec statement boundary: https://developers.cloudflare.com/d1/worker-api/d1-database/ . The private deployment result is recorded separately after publication.
