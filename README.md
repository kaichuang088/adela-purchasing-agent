# Adela 前後台 Netlify draft完整交接

原始碼 commit：3c015228665f9b3e91196dae7b61ee4a4cf4f4f6。本次兩個原Netlify站已改名，沒有建立新站或換ID。
前台draft：https://6acb3a4ab69e96d75f629e14--adela-purchasing-agent-shop.netlify.app
後台draft：https://6acb3a6b07a5516d8523067e--adela-purchasing-agent-admin.netlify.app
正式域名：https://adela-purchasing-agent-shop.netlify.app、https://adela-purchasing-agent-admin.netlify.app。
正式程式仍保留舊deploy；本包對應上述兩個draft，不等於production已更新。

先讀PROJECT_STATE.json、source/NETLIFY_FRONT_ADMIN_20261011.md、source/RECOVERY_R20_20261010.md與source/PERSONAL_ACCOUNT_HANDOFF.md。
根目錄實際部署狀態優先於更早準備/歷史文字。本次manual部署的Netlify commit_ref欄位是null，
部署title記錄完整SHA；以本包Git逐檔一致、API靜態檔hash及部署紀錄作來源關聯，不稱Git自動建置。
交接基準R20/Sites第31版/0418b8ed，但同一私人Sites即時版本目前無法由本環境讀取；
使用者確認網站可以開，不等於已查得版本或DB身分。Sites ID appgprj_6ab47d9a2d1881919a796ec9b609c7b4未改。

已完成兩站Adela改名、前後台profile建置、原後端相容保護；舊Worker商品格式仍不符合R20，
draft商品/結帳/退款回503保護，既有會員資料和餘額未改。尚未取得Cloudflare帳號存取及同DB身分證據。
不得新建或切換DB，不可盲跑舊deploy-cloudflare.mjs所有remote migrations/重播0025。

真實免費AI成功：先前frontend Function HTTP200，要求/實際模型gpt-6.1-sol，completed回OK，15tokens。
這證明免費Gateway通道可用，沒有自建付費OpenAI API；Free300credits與流量/compute/部署共用，非無限。
檢查時無付款方式、自動加值false、overagesfalse。沒有升級/購買；credits計量可能延遲。
網站客服/照片查價/後台AI新增/編輯/批次仍待共用後端接入與實際驗證，不能宣稱全部已啟用。
新兩個draft網域受到執行環境代理CONNECT403，尚未線上HTTP/瀏覽器驗證；API部署ready與靜態hash已核對。

TypeScript、前後台build、15隔離proxy測試、375/390/430px前台12+後台45項Chromium視窗檢查通過。
57張截圖在source/verification/netlify-r20、netlify-admin；隔離合成API，不是實體手機或線上金流驗收。
原交接78項R20測試為歷史證據。Email、手機Push、無人開頁排程及完整商品證據仍未完成。

完整前後台程式、資產、字型、lockfile、migration、部署設定、附件與說明分在全部七包。
每包小於32MiB，須全下載；先解壓Verification，依RESTORE.md執行restore.py，逐包SHA256/CRC及逐檔manifest核對。
不含node_modules、密碼、金鑰或登入憑證。ZIP不等於線上資料庫備份。
personal account仍需同一Sites/Netlify/GitHub/Cloudflare原專案權限、D1/R2安全備份與平台秘密重綁；ZIP不自動移轉帳號。

完整分包直接下載（全部七包）：

- [Adela_Netlify_Front_Admin_Drafts_20261011_01_Source.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_01_Source.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_02_Source.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_02_Source.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_03_Assets.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_03_Assets.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_04_Assets.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_04_Assets.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_05_Assets.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_05_Assets.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_06_Assets.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_06_Assets.zip)
- [Adela_Netlify_Front_Admin_Drafts_20261011_07_Verification.zip](https://github.com/kaichuang088/adela-purchasing-agent/raw/refs/heads/adela-netlify-drafts-downloads-20261011/Adela_Netlify_Front_Admin_Drafts_20261011_07_Verification.zip)
