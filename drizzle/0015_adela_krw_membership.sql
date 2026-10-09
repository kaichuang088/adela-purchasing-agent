ALTER TABLE kk_members ADD COLUMN spend_krw INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE kk_ledger ADD COLUMN spend_krw INTEGER NOT NULL DEFAULT 0;
