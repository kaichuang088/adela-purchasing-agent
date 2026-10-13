CREATE TABLE kk_admin_order_notes(id TEXT PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES shopping_requests(id),body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX kk_admin_order_notes_order ON kk_admin_order_notes(order_id,created_at);
