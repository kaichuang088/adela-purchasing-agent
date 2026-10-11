# Adela 前後台 Netlify 準備 — 尚未發布

原始碼 commit：398e5353ef40f3fedd8d7f9c180387faac1a90fd。包含完整前後台、資產、字型、依賴鎖檔、遷移、部署設定與57張本階段瀏覽器截圖。
本包不是新的Sites發布或已部署Netlify版本；先前draft 6aca9048對應00ba5b94，不是本包SHA。
已取得交接基準為R20／Sites第31版／0418b8ed；同一Site目前即時最新版尚未能讀取核實。
私人Sites ID appgprj_6ab47d9a2d1881919a796ec9b609c7b4，資料與私人分享權限均保留。

先讀 PROJECT_STATE.json、source/NETLIFY_FRONT_ADMIN_20261011.md、source/RECOVERY_R20_20261010.md 與 source/PERSONAL_ACCOUNT_HANDOFF.md。
新文件優先於更早的部署前/歷史限制。使用者已授權Netlify前後台及Adela改名，不需再次批准。
Netlify原兩個專案ID保留，目標名稱adela-purchasing-agent-shop/admin尚未改名或部署。
實際帳號登入仍pending，缺帳號存取能力；不是缺發布許可。
既有Worker不是R20相容格式，draft商品503防护；相同DB尚未查明，不可切換/重建。

TypeScript、前後台build、15項隔離proxy測試、375/390/430px前台12與後台45項Chromium檢查通過。
截圖在source/verification/netlify-r20與netlify-admin；合成API隔離資料，不是實體手機、線上金流或provider實測。
原交接78項R20測試僅歷史證據。AI真實Function/provider/model未驗證成功，不能稱已啟用。
自己的OpenAI API不是免費方案，本次不建立付費API；只可核實並使用帳號免費Gateway額度，禁止升級、自動加值、買額度。
Cloudflare後端/DB切換與Stripe仍需另行核准；Email、手機Push、排程與完整商品證據未完成。

完整檔案分散在所有Source/Assets包，必須全部七包下載，不能只拿Source兩包。
每ZIP小於32MiB。先解壓Verification包，將其他ZIP置於旁邊，依RESTORE.md執行restore.py。
逐包SHA256、CRC、逐檔manifest與Git來源逐位元核對；不包含node_modules、密碼、登入憑證或金鑰。
ZIP不等於線上資料庫備份。personal account仍需同一Sites、Netlify、GitHub與Cloudflare權限及平台安全重綁。
