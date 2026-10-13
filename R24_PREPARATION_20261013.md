# R24 corrective preparation — NOT published

The owner rejected the R23 release because195 catalog issues remained. R24 must not be published until genuine source/specification/cost verification is complete, original product photos are available, and a current balance supports at least750 remaining credits. Original R23 production URLs, deployment IDs, Worker, D1 and secret bindings remain unchanged. This round has zero production deployments, zero paid AI calls and zero real orders, member balance changes or emails sent.

The local corrective branch is `codex/r24-correction-20261013`. GitHub branch backup is authorized and the original Netlify sites have no GitHub automatic builds.

## Completed local changes

- New ordinary Taiwan delivery60TWD; priority80 and Diamond0 retained. Historical snapshots keep their original amounts, including50TWD delivery.
- Simplified buyer and admin chat: compact header, conversation and composer; removed photo-card menus and repeated order cards. Enter/IME safeguards and admin operation confirmations remain.
- Buyers can start a new conversation but cannot list, reopen, write into or export archived sessions. The server enforces this. Admins can view all of a selected buyer's sessions and associated orders and export them. Data is retained; updates to an old archive cannot make it the buyer's active session.
- Mobile cart remains a full page with all five working bottom tabs. The chat composer fits above the tabs.
- Member cards show identity, KRW spending, miles and credit/actions without overlapping rows or nested panels.
- All73 existing external catalog-image URLs are cached as unedited originals and decoded successfully. Known old Aesop URLs are repaired in order cards, item progress and procurement lists without rewriting financial JSON. All active products in the inspected snapshot have an original photo;33 draft/reference records still do not. This is not a claim that every requested reference has been resolved.
- New Brevo/Resend payloads include Adela-branded responsive HTML: gray background, brand header, order/member/status/amount/date details, product table and buyer-site link. Escaping and immutable retry payloads are preserved. Previously sent/accepted emails are not resent. Rendering and mock-provider integration passed; the new template is not live or inbox-tested.
- R24 front/admin mobile PDFs use the verified phone layouts. Front guide has no admin link or buyer history/backup instructions; it explains new chat, phone notifications and home-screen installation. Ordinary delivery60 is documented.

## Catalog status —188 genuinely pending

Read-only production snapshot:199 product records,181 Korean records after the existing country filter.285 original source URLs re-read:249 returned200;144 supplied structured data. A readable page is not approval.152 products with outstanding issues were searched for additional Taiwan sources; only7 searches produced candidates and16 failed. Search results, unrelated variants and snippets were not converted into fabricated evidence.

Six guarded patches were prepared from actual inspected rows:

- Aesop153 Resurrection hand balm75mL: KR42000, TW1050; same official BM06 product/size, differing regional SKUs explicitly recorded.
- Aesop154 hand wash500mL **pump**: KR58000, TW1350; matching global SKU. The55000KRW refill is not substituted.
- Aesop180 Rozu Arises and181 Boundless Eremia50mL: KR245000, TW6200, matching50mL SKUs, current availability and free official KR delivery.
- Round Lab19 **200mL option only**: KR11900 plus necessary2500 delivery, TW359 public offer, current KR source sold out. The unverified500mL option is unchanged.
- Round Lab20 sunscreen50mL: KR22500, qualifying free KR delivery, TW469 public offer.

Patches require exact commerce/status/price/timestamp equality and preserve newer merchant edits. They have been applied only to disposable local D1 during verification. No live catalog changes were made.

188 unresolved options/records remain listed in `verification/r24/catalog-followup.csv`; original product statuses and history are retained. Fully evidenced sold-out items and policy-approved subsidies are visibly listed under reviewed outcomes, rather than pretending they lack evidence. Stock0 still forbids ordering and gross costs remain visible. Tests explicitly show that missing Taiwan/Korean evidence, missing shipping conditions, research records and unapproved cost conflicts cannot disappear through this classification.

Major remaining groups:96 missing Taiwan same-specification references,36 draft records without verified source/specification/cost,22 incomplete evidence cases,6 unresolved cost conflicts, plus reference-model, edition, supply and cold-chain questions. CITRON28 current Seoul boutique15/50/100mL prices remain unavailable from the inspected October official web pages. The owner has been asked for these prices and whether unidentifiable reference products may be replaced with verified current models. No replies yet.

## Evidence and publication gate

`verification/r24/` contains source facts, guarded patch evidence, named test reports, original-photo decoding records, responsive email preview and phone/desktop screenshots. Financial and pricing regression reports come from tests re-run against the corrective compiled Worker. All model/provider interactions in those tests are mocked.

- Workflow90 checks; financial29; pricing29; email transport6; HTML template8; catalog classification8; mobile134. Total304 named checks.
-73 original photos decoded; responsive email rendered at390 and900px.
- Type checking and backend/front/admin local builds passed.
- `node scripts/check-r24-release-gate.mjs` **exits1 intentionally**:188 unresolved issues,33 draft/reference photos missing, actual current credit balance unconfirmed. This is a blocked release, not a passing deployment check.

The last owner baseline827.4 minus the **previous R23** two15-credit revisions estimates797.4 before other usage. The Netlify API usage counter lagged; do not use it or the estimate as an authoritative current balance. Future two-site publication budget30 must leave750. Do not create Netlify candidates, call paid research in batches or restore the already-published R23 deployments again.

Actual iPhone push delivery was confirmed by the owner in the prior round. Physical Android delivery, full real-provider photo-quote accuracy, and new HTML email inbox delivery are still unverified. Existing Brevo authentication/sender settings were already corrected; do not ask for or dump API keys.

R24 guides are branch artifacts until publication:
`public/manuals/Adela_R24_Front_Mobile_Guide.pdf`
`public/manuals/Adela_R24_Admin_Mobile_Guide.pdf`

Use actual GitHub raw download links for review; workspace preview links previously failed for the owner. The source backup is not a live database/financial/conversation backup or platform ownership transfer. Read `PROJECT_STATE.json` and this file for corrective status; `R23_DEPLOYMENT_20261013.md` remains the authoritative record of the unchanged live release.
