-- Additive only: keep historical top-ups, wallet entries and order snapshots unchanged.
CREATE TABLE kk_credit_withdrawals (
 id TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL,
 amount_twd INTEGER NOT NULL CHECK(amount_twd > 0),
 bank_code TEXT NOT NULL,
 bank_name TEXT NOT NULL,
 account_number TEXT NOT NULL,
 account_name TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','processing','paid','rejected','cancelled')),
 seller_note TEXT NOT NULL DEFAULT '',
 transfer_reference TEXT NOT NULL DEFAULT '',
 resolution_key TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 paid_at TEXT
);
--> statement-breakpoint
CREATE INDEX kk_credit_withdrawals_member ON kk_credit_withdrawals(member_id,created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX kk_credit_withdrawals_open ON kk_credit_withdrawals(member_id) WHERE status IN ('requested','processing');
