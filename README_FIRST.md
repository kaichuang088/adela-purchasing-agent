# Adela R21.3 — 已發布 Netlify 前後台

原始碼 SHA：`a6f77678018c7c8a9e70ca59b8df0e40df2f1e48`。
前台：https://adela-purchasing-agent-shop.netlify.app
後台：https://adela-purchasing-agent-admin.netlify.app
實際 Netlify deploy、原 Worker version、原 D1 與測試狀態見 PROJECT_STATE.json。Sites v31 是交接基準，不是本次新發布。

完成：所有香水共用低費率；截圖 Aesop 50mL 一般會員價 NT$5,890→NT$5,851（未含台灣配送）。後台代建 Email 帳號與待付款訂單；照片總價已含代購費、接受／取消、24小時賣家核價與購買清單；客製商品可建立公開草稿，驗證規格／來源後上架。後台電腦右下角 GPT 助理、手機 AI tab，支援一次多項操作預覽與核准、四級會員估價、未稅採買方案建議。手機通知仍在「更多」。管理密碼只在平台安全設定，Netlify 前置帳號登入解除，所有 API 管理密碼保留。官方徽章關閉，修正整頁 iframe 遮擋。保留中英韓語系、品牌風格、原會員／帳本／訂單與已付贈額，不販售新儲值。

真實 GPT：客服明確回答 NT$5,851 已含 NT$15 代購費，不會再加8%；後台能解釋各會員比例、已付款回購與未稅資格。不是只有mock。照片服務有真實 gpt-6.1-sol 回應，但本次 Le Labo 測試沒有取得精確韓國商家證據，回422並停止，沒有價格或訂單。不能宣稱每張照片都準確或成功報價。

隔離檢查：32新流程、29金融、20照片、12照片jobs、5背景transport、19proxy、28本機Chromium畫面；TypeScript與Worker/前後台建置通過。正式手機尺寸截圖與結果見 deployment-evidence/live-mobile/，是瀏覽器 viewport 實測，非實體手機。會員資料於 DOM 遮罩後截圖，未更改資料庫。

37個香水品項逐會員比較在 PERFUME_PRICE_REPORT.csv / deployment-evidence/r21-perfume-prices.json。已是零費率、成本超出上限或未具備可售证据的規格不能憑空再降，不改低成本、不偽造台灣比較價或庫存。舊型錄來源缺口、成功實際照片購買報價與實體手機Push/Email仍未全面驗證。

完整程式、圖片、字型、package.json與鎖定檔、27個migration、Netlify/Cloudflare設定、安裝執行測試建置與交接說明在 source/。先讀 source/R21_NETLIFY_UPDATE_20261012.md。所有七包還原才能得到完整 source/；外層GitHub完整ZIP包含七包與還原工具，可一鍵下載。

無node_modules、真實密碼、API keys、私鑰或登入憑證。ZIP不是線上資料庫備份。移交personal account需另外取得原GitHub、Netlify、Cloudflare與私人Sites權限，秘密用平台安全設定，不貼聊天或存入ZIP。

R21.3 修正：停止新接單不會阻擋既有客製訂單接受賣家新報價。所有新訂單仍受接單開關限制。Netlify前後台靜態源維持R21.2/5cfb75f及原部署ID，原Worker更新為本包SHA；React/CSS/圖片完全相同，不重複部署Netlify。32項新流程及31項正式手機/桌面檢查通過。
