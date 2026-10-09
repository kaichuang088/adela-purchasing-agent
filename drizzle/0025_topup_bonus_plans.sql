-- Preserve every historical amount, bonus, status, timestamp and confirmation.
-- SQLite cannot alter an existing CHECK: rebuild only this table in the same DB.
-- Apply as one D1 migration transaction, once; never replay old migrations.
CREATE TABLE kk_topups_r18 (
 id TEXT PRIMARY KEY NOT NULL,
 member_id TEXT NOT NULL,
 amount_twd INTEGER NOT NULL CHECK(amount_twd IN (2000,5000)),
 bonus_twd INTEGER NOT NULL CHECK((amount_twd=2000 AND bonus_twd IN (160,200)) OR (amount_twd=5000 AND bonus_twd IN (500,600))),
 status TEXT NOT NULL DEFAULT 'awaiting_payment',
 payment_reference TEXT NOT NULL DEFAULT '',
 admin_reference TEXT NOT NULL DEFAULT '',
 confirmation_key TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reported_at TEXT,
 confirmed_at TEXT
);
--> statement-breakpoint
INSERT INTO kk_topups_r18 (id,member_id,amount_twd,bonus_twd,status,payment_reference,admin_reference,confirmation_key,created_at,reported_at,confirmed_at)
 SELECT id,member_id,amount_twd,bonus_twd,status,payment_reference,admin_reference,confirmation_key,created_at,reported_at,confirmed_at FROM kk_topups;
--> statement-breakpoint
DROP TABLE kk_topups;
--> statement-breakpoint
ALTER TABLE kk_topups_r18 RENAME TO kk_topups;
--> statement-breakpoint
CREATE INDEX kk_topups_member ON kk_topups(member_id,created_at);
