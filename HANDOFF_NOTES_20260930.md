# AdelaPA R2 交接 — 2026-09-30，尚未發布

這是接續既有source/的第二版保存修正，**仍不是全部完成版**。保留原project ID、架構和lockfile；沒有重建網站、推送來源或發布新Sites版本。ZIP保存點與SHA見根目錄GIT-PROVENANCE及SOURCE-MANIFEST。

## R2這次實際修正

- 優惠券日期提交改讀實際表單值，拒絕空值／結束早於開始，避免Invalid time value及未保存；重開編輯保留起訖日期。
- 優惠名稱保存中英文報價快照，後來改活動名稱不回寫舊訂單。舊快照缺英文名仍保留原文，不假造翻譯。英文後台券名／代碼、英韓商品名稱與圖片標籤隨語言選擇；類別不再重複列英文。
- 商店未公開數量顯示「商店剩餘數量未公開」；接單無上限不再稱無限現貨。
- 單品AI草稿按鈕在未配置服務時停用，輸入文字後仍停用；明示可先手動編輯。沒有假稱AI接通。
- PDF下載使用已掛到頁面的連結，保留可重試連結並於更換／卸載釋放檔案網址。實際已下載2份PDF，檔名、時間、SHA、頁數與金額在r2-pdf-download-results中。
- 客服英文品牌改Adela，聊天UTC／offset日期用共同Taipei日期格式，英文／韓文訂單選擇使用可用英文名稱。未知賣家／買家文字及舊系統訊息不偽翻譯。
- 修手機後台header固定高度造成文字重疊；8個導航改4欄2排且留出底部空間，訂單篩選可換行。實際390×844測得文件寬度與scrollWidth均390。
- 系統診斷版本改recovery-r2；保留同一持久化backendId。測試日誌可用新前綴，舊R1紀錄不冒充本輪。

## 本轮驗證與證據

- TypeScript、Sites build、Netlify build成功；**18/18套件、398個具名本機檢查通過**。新版日誌與結果為verification/20260930-r2-*，不是歷史310／344或R1的394。
- 新增4個同步回歸檢查：券雙語名稱保存、券＋購物金全額付款及餘額、修改活動不改歷史名稱、已用券再次估價拒絕。
- 瀏覽器公開券：領取→免運50→522購物金扣472→新訂單應付0、剩50、券Used；訂單KK260930-A8D2301974B0。
- 私人券：輸入QA2PRIVATE領取；低消2000、商品437不合資格，勾選停用且有理由；賣家改門檻0後重新報價472＋50−20−50＝452，英文優惠名正確，該報價未下單。
- 真人客服：買家申請→後台未讀1→管理員開啟及回覆→前台收到同一則測試訊息。
- 實際下載：取消522及全購物金應付0收據已存Downloads，各1頁。讀取原下載檔案後核對文字，並渲染完整頁視覺檢查。工具等待下載事件雖逾時，檔案存在且修改時間對應本輪操作；不得仍把此項記為未下載，也不得把旧离线重播當新下載。
- 手機：首頁、會員、結帳、後台AI、模式表單與訂單篩選已在真正390寬度核對；後台標題不再重疊，8個選單可見。不是全部手機／語言／彈窗情境已完成。

全部使用隔離測試帳號、合成地址與不可付款銀行資料。沒有真實匯款、寄信或付費AI呼叫。PNG／JPG及下載證據JSON已在source/verification；PDF本體仍在本機Downloads，不重複塞入ZIP的字型資料。

## 前版成果與型錄狀態

原附件362檔manifest核對，基準Sites v9 7832ae067453efe5abb356139bd445573eff505b。R1本地保存點3c8747d1f7e65cdd49407f4aa28d440d623b14d9，舊ZIP另保留。

R1已保存：調價／退款購物金保留與原子結算／並發回滾／里程回沖；Worker無頁面排程邏輯與每日提醒冪等；英韓系統通知；服務端AI批次快照與Scan個別審核；同一隔離DB的Netlify proxy驗證；後台空ProductDialog崩潰修復。這些套件已在R2重新跑過，AI及Email仍是mock。

本版沒有新增未查證商品價格。型錄維持原87＋6可列售＝93，17候選中11為草稿；原50及新5款合計55缺同規格台灣價。LeLabo13、Byredo8、Diptyque5、OliveYoung31、Stussy8、Mardi6。潮牌候選可買尺寸／圖片與停售狀態仍依研究證據處理，不重上架賣家停售商品。完整研究記錄在verification/catalog-research。

## 仍需補齊，尚未發布的原因

1. 正式ADMIN_PASSWORD（新服務端秘密）；實際AI key或gateway憑證、帳號可用的OPENAI_MODEL，逐一測研究／圖片／查價／新增／編輯／批次／Scan／客服。不要重用聊天曾暴露的金鑰或安裝已拒絕外掛。
2. RESEND_API_KEY、已驗證EMAIL_FROM、SHOP_PUBLIC_URL與實際收件信箱；需要真的收到退款／訂單通知和重試證據。
3. 原Sites正式DB及BUCKET綁定、遷移／備份、平台無人開頁排程；本機Worker及standalone cron配置不等於正式啟用。
4. 目標Netlify網站部署權限、服務端KK_BACKEND_URL及私人Sites登入牆／授權串接，部署兩端讀同一DB。不可在前端放管理密碼、建立第二套DB假同步。
5. 55款台灣同規格價、草稿／原型錄圖片與可買尺寸／容量／現貨再核對。離島原費率與原圖1–6尚缺。全部頁面及每種手機語言／表單／付款證據上傳仍需完整覆核。

原專案appgprj_6ab8b6da8d988191a1db39f6f4a6dd6c最後讀取為owner、最新v9、live URL空、env revision0空。**不是缺所有Sites權限；是正式服務設定與必要驗收尚未完成。** 原Business網站未修改。所有必要門檻過後，才推送確切source提交、保存新Sites版本、發布原專案、交付真正免下載網址及同提交ZIP。

## 接續操作

完整讀本檔、完整Prompt、RECOVERY_NOTES及source/VERIFICATION_20260930.md與verification/RELEASE_GATE.json，接續source/。根目錄history為原始交接材料，R1日誌為歷史；不能沿用它們宣稱新修改通過。

使用保留pnpm/lockfile。重新驗證：pnpm exec tsc --noEmit；pnpm run build；ADELA_VERIFICATION_PREFIX=新的日期版本 node scripts/verify-current-release.mjs；node scripts/build-netlify.mjs。preview-local-release僅隔離QA，.sites-runtime/browser-d1不是正式DB備份；不部署QA密碼與銀行fixture。新會話若socket報EPERM，先申請必要網路權限。

ZIP不含.git、node_modules、dist、.sites-runtime、密鑰或正式顧客DB。來源逐檔由同一已保存提交匯出並校驗SHA及ZIP CRC；未提供可公開免下載網址。
