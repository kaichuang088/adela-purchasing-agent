CREATE TABLE `kk_email_outbox` ( `id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL, `message_id` integer NOT NULL, `recipient` text NOT NULL, `subject` text NOT NULL, `body` text NOT NULL, `state` text DEFAULT 'pending' NOT NULL, `attempts` integer DEFAULT 0 NOT NULL, `first_attempt_ms` integer, `next_attempt_ms` integer DEFAULT 0 NOT NULL, `lease_until_ms` integer DEFAULT 0 NOT NULL, `lock_token` text, `payload_json` text, `provider_id` text, `last_error` text, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `accepted_at` text );
--> statement-breakpoint
CREATE UNIQUE INDEX `kk_email_outbox_message_id_unique` ON `kk_email_outbox` (`message_id`);
--> statement-breakpoint
CREATE INDEX `kk_email_outbox_due` ON `kk_email_outbox` (`state`,`next_attempt_ms`,`lease_until_ms`);
--> statement-breakpoint
CREATE TRIGGER kk_order_message_email AFTER INSERT ON kk_messages WHEN NEW.order_id IS NOT NULL BEGIN INSERT INTO kk_email_outbox(message_id,recipient,subject,body) SELECT NEW.id,m.email,NEW.title, 'Adela''s Purchasing Agent' || char(10) || '訂單 / Order: ' || o.request_no || char(10) || NEW.body || char(10) || NEW.body_en FROM kk_members m JOIN shopping_requests o ON o.id=NEW.order_id WHERE m.id=NEW.member_id AND o.member_id=m.id; UPDATE kk_messages SET email_status='queued' WHERE id=NEW.id AND EXISTS(SELECT 1 FROM kk_email_outbox WHERE message_id=NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER kk_order_email_state AFTER UPDATE OF state ON kk_email_outbox BEGIN UPDATE kk_messages SET email_status=NEW.state WHERE id=NEW.message_id; END;
