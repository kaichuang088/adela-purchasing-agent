CREATE TABLE kk_admin_alerts(id INTEGER PRIMARY KEY AUTOINCREMENT,delivery_key TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TEXT);
--> statement-breakpoint
CREATE TABLE kk_admin_push_subscriptions(endpoint TEXT PRIMARY KEY,last_alert_id INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0,lease_until_ms INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TRIGGER adela_admin_new_order AFTER INSERT ON shopping_requests BEGIN INSERT OR IGNORE INTO kk_admin_alerts(delivery_key,title,body) VALUES('order:'||NEW.id,'新訂單',NEW.request_no||'，請至每日工作查看。'); END;
--> statement-breakpoint
CREATE TRIGGER adela_admin_payment_report AFTER UPDATE OF payment_reported_at ON shopping_requests WHEN NEW.payment_reported_at IS NOT NULL AND NEW.payment_reported_at IS NOT OLD.payment_reported_at BEGIN INSERT OR IGNORE INTO kk_admin_alerts(delivery_key,title,body) VALUES('payment:'||NEW.id||':'||NEW.payment_reported_at,'匯款待核對',NEW.request_no||' 已回報付款，請確認銀行入帳。'); END;
--> statement-breakpoint
CREATE TRIGGER adela_admin_photo_review AFTER INSERT ON kk_photo_inquiries BEGIN INSERT OR IGNORE INTO kk_admin_alerts(delivery_key,title,body) VALUES('photo-review:'||NEW.id,'照片查價待處理','請至每日工作／查價回報核對商品與含代購費報價。'); END;
--> statement-breakpoint
CREATE TRIGGER adela_admin_human_request AFTER UPDATE OF needs_human ON kk_support_threads WHEN NEW.needs_human=1 AND OLD.needs_human=0 BEGIN INSERT OR IGNORE INTO kk_admin_alerts(delivery_key,title,body) VALUES('human:'||NEW.member_id||':'||NEW.updated_at,'買家要求真人客服','請至訊息頁查看對話紀錄與訴求摘要。'); END;
