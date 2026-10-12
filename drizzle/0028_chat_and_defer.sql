CREATE TABLE kk_ai_sessions(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner_id TEXT NOT NULL,title TEXT NOT NULL DEFAULT '新對話',support_status TEXT NOT NULL DEFAULT 'ai',needs_human INTEGER NOT NULL DEFAULT 0,ai_summary TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX kk_ai_sessions_owner ON kk_ai_sessions(kind,owner_id,updated_at);
--> statement-breakpoint
CREATE TABLE kk_ai_chat_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL REFERENCES kk_ai_sessions(id),role TEXT NOT NULL,body TEXT NOT NULL,payload_json TEXT,attachments_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
ALTER TABLE kk_conversations ADD session_id TEXT;
--> statement-breakpoint
INSERT INTO kk_ai_sessions(id,kind,owner_id,title) SELECT 'legacy:'||member_id,'buyer',member_id,'先前客服對話' FROM kk_conversations GROUP BY member_id;
--> statement-breakpoint
UPDATE kk_ai_sessions SET support_status=COALESCE((SELECT status FROM kk_support_threads WHERE member_id=owner_id),'ai'),needs_human=COALESCE((SELECT needs_human FROM kk_support_threads WHERE member_id=owner_id),0),ai_summary=COALESCE((SELECT ai_summary FROM kk_support_threads WHERE member_id=owner_id),'') WHERE kind='buyer';
--> statement-breakpoint
UPDATE kk_conversations SET session_id='legacy:'||member_id WHERE session_id IS NULL;
--> statement-breakpoint
ALTER TABLE kk_order_items ADD defer_deadline_at TEXT;
--> statement-breakpoint
ALTER TABLE kk_order_items ADD defer_proposed_at TEXT;
--> statement-breakpoint
ALTER TABLE kk_order_items ADD defer_reward_key TEXT;
--> statement-breakpoint
CREATE TABLE kk_photo_inquiries(id TEXT PRIMARY KEY,draft_id TEXT NOT NULL UNIQUE,member_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',analysis_json TEXT,pricing_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
