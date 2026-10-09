CREATE TABLE kk_topups (id TEXT PRIMARY KEY NOT NULL,member_id TEXT NOT NULL,amount_twd INTEGER NOT NULL CHECK(amount_twd IN (2000,5000)),bonus_twd INTEGER NOT NULL CHECK(bonus_twd=amount_twd/10),status TEXT NOT NULL DEFAULT 'awaiting_payment',payment_reference TEXT NOT NULL DEFAULT '',admin_reference TEXT NOT NULL DEFAULT '',confirmation_key TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reported_at TEXT,confirmed_at TEXT);
--> statement-breakpoint
CREATE INDEX kk_topups_member ON kk_topups(member_id,created_at);
