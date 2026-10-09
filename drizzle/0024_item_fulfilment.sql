CREATE TABLE kk_order_items (order_id INTEGER NOT NULL,line_index INTEGER NOT NULL,snapshot_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',purchase_at TEXT,proposed_at TEXT,reason TEXT NOT NULL DEFAULT '',refund_twd INTEGER NOT NULL DEFAULT 0,purchased_at TEXT,decision_at TEXT,PRIMARY KEY(order_id,line_index));
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN fulfilment_version TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN item_refund_twd INTEGER NOT NULL DEFAULT 0;
