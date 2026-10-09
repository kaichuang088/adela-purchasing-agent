CREATE TABLE kk_wallet_entries (event_key TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL, order_no TEXT NOT NULL, amount_twd INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX kk_wallet_member ON kk_wallet_entries(member_id);
--> statement-breakpoint
CREATE TRIGGER kk_wallet_prevent_negative BEFORE INSERT ON kk_wallet_entries WHEN NEW.amount_twd<0 BEGIN SELECT RAISE(ABORT,'STORE_CREDIT_CHANGED') WHERE COALESCE((SELECT SUM(amount_twd) FROM kk_wallet_entries WHERE member_id=NEW.member_id),0)+NEW.amount_twd<0; END;
--> statement-breakpoint
CREATE TABLE kk_coupon_claims (offer_id INTEGER NOT NULL, member_id TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(offer_id,member_id));
--> statement-breakpoint
CREATE TRIGGER kk_coupon_claim_limit BEFORE INSERT ON kk_coupon_claims WHEN NOT EXISTS(SELECT 1 FROM kk_coupon_claims WHERE offer_id=NEW.offer_id AND member_id=NEW.member_id) BEGIN SELECT RAISE(ABORT,'COUPON_FULL') WHERE COALESCE((SELECT json_extract(data,'$.totalQuantity') FROM kk_offers WHERE id=NEW.offer_id),0)>0 AND (SELECT COUNT(*) FROM kk_coupon_claims WHERE offer_id=NEW.offer_id)>=(SELECT json_extract(data,'$.totalQuantity') FROM kk_offers WHERE id=NEW.offer_id); END;
--> statement-breakpoint
CREATE TABLE kk_urgent_orders (order_no TEXT PRIMARY KEY NOT NULL, window_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TRIGGER kk_urgent_limit BEFORE INSERT ON kk_urgent_orders BEGIN SELECT RAISE(ABORT,'URGENT_FULL') WHERE (SELECT COUNT(*) FROM kk_urgent_orders WHERE window_key=NEW.window_key)>=10; END;
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN eta_to TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN payment_photo_id TEXT;
--> statement-breakpoint
ALTER TABLE shopping_requests ADD COLUMN cancellation_key TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE kk_members ADD COLUMN miles_debt INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE kk_ledger ADD COLUMN debt_delta INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE store_settings SET value=json_set(value,'$.shippingByTier',json('{"standard":50,"platinum":50,"black":50,"diamond":0}')) WHERE key='commerce_settings';
--> statement-breakpoint
CREATE TABLE kk_order_purchases (order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(order_id,product_id));
--> statement-breakpoint
ALTER TABLE kk_photo_drafts ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
