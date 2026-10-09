# R9B — Manual wallet top-ups
R9A deployed successfully as appgdep_6ac2077db76c8191a6c21452bc599c71, source ac1cc02bbdbde8e233e6c352432cb06f8d7bb369.
This batch adds 2000+200 and 5000+500 manual bank-transfer top-ups in customer wallet, payment report, yellow verification state, admin confirmation and atomic principal/bonus entries. No Stripe. Bank configuration required before accepting requests. Only confirmed money enters spendable wallet.
Tests cover duplicate submissions, ownership, admin auth, concurrent confirmation, injected bonus failure rollback, safe retry, private history, and covering shipping.
Still pending: per-item deferral and grouped procurement, catalog completeness, fee flexibility, real-phone push, live AI credentials, mobile/desktop visual QA. Original environment has no OPENAI_API_KEY or gateway. Preserve project, bindings, current audience.
