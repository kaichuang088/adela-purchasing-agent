# Adela R22 已發布完整交接

前台：https://adela-purchasing-agent-shop.netlify.app
後台：https://adela-purchasing-agent-admin.netlify.app
來源 commit：d02847774518cb9b22368f97b0b93408e7fd2831

根目錄 PROJECT_STATE.json 是這次實際發布狀態。以它和 source/R22_NETLIFY_UPDATE_20261012.md 為準；舊 Sites/R20/R21 文件僅供歷史追溯。本次沒有更新 Sites，也沒有替換資料庫。

直接下載外層完整 GitHub ZIP 即包含全部來源包、資產、手機截圖與兩份 9 頁 PDF。解壓外層後执行 python restore.py --destination ./Adela_R22_Restored；原始碼在 source/，依 README 安裝、建置、測試。PDF 內畫面是隔離測試資料，不是真實會員交易。實際線上驗收另見 deployment-evidence。

已完成商品搜尋／ID、前後台正常 AI 對話與歷史、多照片／確認按鈕、會員多商品代下單、報價回報、一般通知、付款提醒、48 小時延期與 95 折券／折後實付退款，以及採買排程設定。實際前後台 provider 成功回報 gpt-6.1-sol。所有 210 個商品缺口仍完整列在 source/verification/r22/catalog-unresolved.csv，未假造查核完成或歸零。

手機 Push 已設定 VAPID，但實機送達未驗證；Email 未設定寄信服務。照片辨識或模型可用不保證同規格真實價格已取得，缺來源時走賣家查價，不自動下單。

每站僅一次 production 發布共標示 30 credits；僅兩次小範圍真實 AI 探測，未開自動加值或購買其他額度。用量 API 有延遲，不能宣稱即時餘額已獨立驗證。

personal account 交接：需分別保有原 GitHub 私有 repo、兩個 Netlify Site、原 Cloudflare Worker／D1、私人 Sites project 的管理權限。驗證登入／資料綁定／AI 後，在安全設定另行輪替管理密碼、部署 token、Gateway secret 和推播密鑰；不要複製到程式或聊天。ZIP 不轉移平台所有權、不含秘密，亦不等於線上資料庫備份。原 Cloudflare Worker 技術名稱仍是 kk-purchasing-agent，前後台品牌為 Adela；不要只改名而斷開後端綁定。
