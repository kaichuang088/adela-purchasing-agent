# AdelaPA 私人預覽 R4 — 2026-10-01

接續已推送 R3 `731a77bbf08f9c6d1edcbe5eba9df73811ac02df`，沿用 owner-private project `appgprj_6ab47d9a2d1881919a796ec9b609c7b4`、DB 與 BUCKET。使用者要求 Continue，延續私人預覽修正／發布授權；Netlify 正式站與 Stripe 未更動。

## 遷移修正

重新讀取原生 DB overview：7 張新增 user tables 仍缺；shopping_requests 的欄位仍到 shipping_address_json，沒有 urgent、eta_to、payment_photo_id、cancellation_key。這些觀察支持 0016 與後續新遷移尚未成功套用；未改 0000–0015 的歷史遷移。

Cloudflare 官方 workers-sdk issue #4326 記錄有效 SQLite trigger 中 CASE/END 導致遠端 incomplete input，並有括號 workaround；#15314 說明遠端 SQL 分割與本機不同。這是相同錯誤模式的調查線索，不是假稱已取得 Sites 內部 migration runner 的程式或確切錯誤 statement。

0016 三個金融／名額 guard 及 0017 的庫存／零食 guard 改寫為 `SELECT RAISE(ABORT,...) WHERE 條件`，維持原有拒絕條件與 trigger。0017 付款累計的 CASE 表達式改為等值 iif，維持韓元／日元分流、先抵里程欠額、ledger 冪等及 changes() 守門。沒有刪 trigger、削弱原子交易、runtime 建表、重建正式 DB 或手改顧客資料。

保留大寫 BEGIN、LF、每個完整 trigger statement 一行。新版 revision 是 `2026-10-01-private-r4`，相關回歸驗證同步更新識別。R3 的其他前後台、Scan、狀態與 heartbeat 修正保留。

## 驗證界線

本輪 TypeScript 與 Sites build 通過；完整 compiled-app suites 與新遷移 exec 結果在 verification/20261001-private-r4-*。AI／Email 仍 mock，R2 瀏覽器圖片仍是歷史，不冒充 R4 瀏覽器驗收。

新版本原生發布結果必須另行讀取；本說明不預測部署成功。舊 R2/R3 release gate 中的環境缺值、版本／liveUrl 與等待發布敘述是歷史快照，不能蓋過原生工具最新結果。現有 ADMIN_PASSWORD secret 被遮罩不是缺值；本輪保存原值。

仍未完成：真實 AI/Gateway 憑證與所有 AI 入口驗收、已驗證寄信服務／真實收件、平台無 page view cron 的啟用證據、55 件台灣同規格價、潮牌可買尺寸／庫存、全部圖片與手機三語／彈窗、離島原費率與原圖1–6、正式雙 Netlify 站同 DB 驗證、Stripe sandbox/live 整合。私人發布不能等同全部正式營運門檻通過。

研究來源：
- https://github.com/cloudflare/workers-sdk/issues/4326
- https://github.com/cloudflare/workers-sdk/issues/15314
- https://developers.cloudflare.com/d1/worker-api/d1-database/
