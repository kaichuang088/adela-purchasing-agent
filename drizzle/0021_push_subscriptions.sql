CREATE TABLE kk_push_subscriptions (endpoint TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL, last_message_id INTEGER NOT NULL DEFAULT 0, lease_until_ms INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX kk_push_member ON kk_push_subscriptions(member_id);
