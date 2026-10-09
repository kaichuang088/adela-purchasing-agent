CREATE INDEX IF NOT EXISTS idx_kk_orders_member ON shopping_requests(member_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_kk_messages_member ON kk_messages(member_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_kk_ledger_member ON kk_ledger(member_id, id);
