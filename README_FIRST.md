# Adela 最新 Netlify／Cloudflare 發布交接

原始碼 commit：c04545247b313607301df7db2dabb0227e8e591e。
前台：https://adela-purchasing-agent-shop.netlify.app
後台：https://adela-purchasing-agent-admin.netlify.app
前台 deploy：6acbd8709108bd42ccc94863；後台：6acbd8aadc72e567f11332fa。
Worker：b6694f45-f0b9-4cb9-ad0d-eeefa7cd158f，沿用原 kk-purchasing-agent、原 D1 與原 Netlify IDs。
Sites v31／R20 是使用者交付的匯出基準，不代表本次新增 Sites 版本；本次沒有更動私人 Sites。

本次完成：十二個缺少 D1 遷移逐一套用、前後台 Adela 更新、前台客服真實 gpt-6.1-sol 呼叫、後台四項 AI 編譯 handler／隔離 D1 透過真實 provider 測試，以及照片輸入自動壓縮和伺服器 24KiB 預算檢查。原 605423 bytes 圖片壓至 22330 bytes、896×896。後台批次初次暫時失敗、單次重試通過，證據保留。

測試：TypeScript、Worker／前台／後台建置、15 proxy、29 隔離金流／售價及 20 照片回歸通過。實際 production Chromium 375／390／430 的首頁、商品詳情／規格與購物車截圖無水平溢出，未建立訂單或改動真實餘額。這是瀏覽器手機尺寸測試，不是實體手機或正式後台登入驗收。

仍未完成／未驗證：線上照片查價遇到 502／逾時，雖然編譯 handler 透過 production provider 已回 completed gpt-6.1-sol；該商品沒有有效韓國購買來源，因此回 422 並未建立報價或訂單。正式後台需原 Netlify 帳號及 ADMIN_PASSWORD，原密碼登入未代驗收。Web Push／Email 缺供應商設定且沒有實體手機送達證據。Cloudflare 每分鐘真正 cron 已有成功紀錄，不能把排程成功當作通知送達。完整商品購買證據仍須依歷史逐項缺口表補齊；不宣稱全站 AI／全部商品／Finalize 已完成。Netlify 官方函式錯誤紀錄讀取 403，無法據此確認 502 根因。

沒有購買 AI、付費方案或自動加值；Netlify 免費 credits 有限且與流量／部署共用，耗盡即應停止，不能默默購買。Cloudflare 沒有變更帳務方案，但其訂閱 API 本環境讀取 403。不用自有 OpenAI API key，Netlify Function 使用平台注入的 AI Gateway 授權。

完整前後台程式、全部圖片字型資產、package.json／鎖檔、全部 SQL 遷移、部署設定及證據都在七包內。必須下载全部七包，先解壓 Verification 包，再按 RESTORE.md 還原；逐檔內容應與上述 commit 相同。ZIP 不含 node_modules、密碼、API keys、私鑰或登入憑證，也不是線上資料庫備份。

安裝／執行／測試／建置見 RESTORE.md 及 source/NETLIFY_FRONT_ADMIN_20261011.md、source/NETLIFY_AI_UPDATE_20261012.md。交付根目錄 PROJECT_STATE.json 是實際部署紀錄，歷史文件的「缺 token／後端未更新／待批准部署」不再適用。保留 R20 停售新儲值規則，勿用 R17 贈額販售覆蓋 R20。

personal account 交接：新聊天可取得本包或原 GitHub 此 source commit；須另連接原 GitHub repo、原 Netlify 擁有者帳號 kc4study、原 Cloudflare 帳號及私人 Sites 的實際授權。聊天帳號移轉不會自動移轉平台帳號、Sites 分享、D1、秘密或網域。憑證只存新環境安全設定；不要貼聊天。完成後可撤销不再需要的 Token／CLI 授權。資料庫若需備份另在 Cloudflare 安全匯出，本包不包含會員個資或資料庫。
