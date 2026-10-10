# Adela R20 — 同一 Netlify 專案前台 draft

測試網址：https://6aca904822b00e5a18be294c--kk-purchasing-agent-shop.netlify.app
既有正式前台：https://kk-purchasing-agent-shop.netlify.app （未切換，仍是舊版）
既有後台：https://kk-purchasing-agent-admin.netlify.app （未部署，本次一般請求回401）
Netlify site ID：5bddbf98-7e39-4173-a0d9-9759be24fbc9
Netlify draft deploy：6aca904822b00e5a18be294c；API狀態ready。
原始碼 commit：00ba5b94c3b5a5c8b4ad22e36ba255ee95216c5e
GitHub 分支：netlify-r20-storefront-20261011

同一私人 Sites 基準仍為第31版，commit 0418b8ed36a43ae973ca227f3ae0767fcdeec25b，
project appgprj_6ab47d9a2d1881919a796ec9b609c7b4。本次沒有再發布 Sites。
先讀 PROJECT_STATE.json、source/NETLIFY_FRONTEND_R20_20261011.md、
source/RECOVERY_R20_20261010.md、source/PERSONAL_ACCOUNT_HANDOFF.md。
根目錄本次發佈狀態比 source/ 中部署前與历史文字優先。

本次：匯入使用者完整R20匯出；前台獨立部署，admin不輸出；品牌完整名稱一致；
新增server proxy舊後端防護，商品舊格式回503，任何資料寫入前先核對R20payload。
現有Netlify後端仍是旧版Worker，14個舊商品缺R20欄位，不會把它說成最新版交易已可用。
需要另處理原Cloudflare後端與D1綁定；不會新建或更換資料庫。

本次通過TypeScript、前台建置、Function打包、15項隔離proxy/Gateway測試及
375/390/430px共12項Chromium檢查、12張截圖。截圖在source/verification/netlify-r20。
合成API、沒有真實金流寫入；不是實體手機或完整購物端到端驗收。交接78項R20測試是歷史證據。
Netlify API確認部署ready、172個前台檔案SHA1全部與本地建置一致、正式deploy未換；新draft網域本環境CONNECT403，線上瀏覽器未驗證。

已核實登入的Netlify帳號Free(credit-free)：300 credits，檢查時已用0、無付款方式、
auto_topup_enabled=false，不能產生額度超額帳單。沒有升級、購買或自動加值。
模型清單含gpt-6.1-sol，但一次64tokens上限真實直接Gateway請求回403 free_direct_disabled，
沒有成功模型回傳。Netlify Function 路徑與網站AI仍未成功驗證，不能說已啟用AI。
發布admin頁面不會自動啟用AI。Gateway配額與網站部署、流量、compute共用，並非無限免費。

完整 source/ 與附件分散在所有Source/Assets ZIP，必须全部下載，加上Verification包。
先解壓Verification包，其他ZIP放旁邊，再執行 python3 restore.py --destination ./Adela_R20_Restored。
逐包SHA256/CRC及逐檔manifest核對；禁止將ZIP二進位串接。每包小於32MiB。
不含node_modules、登入憑證或金鑰；ZIP不等於線上資料庫備份。

personal account接手還需要Sites分享/所有權、Netlify kc4study團隊權限或專案轉移、
GitHub原始碼/下載分支權限、Cloudflare原Worker/D1/R2/cron權限與安全秘密重綁。
ZIP不會自動轉移帳號、會員、資料庫或平台安全設定。先透過官方平台取得可還原備份，再遷移。
完成後在 https://app.netlify.com/user/applications 撤銷這次Netlify CLI授權；
一次診斷錯誤夾帶過CLI憑證，本次已停止未過濾錯誤輸出，交付與Git均不含該憑證。

source/verification/netlify-r20/preflight.json 的 Function bundle hash 是部署前、尚未加入後端防護之歷史打包證據，不作本次線上Function二進位驗證。實際部署對應根目錄sourceCommit；線上Function未驗證。
