# 2026-09-30 R2 逐項驗收（尚未發布）

原v9 manifest 362檔核對完成。此版沿用既有專案。18組／398個具名本機檢查通過，另有R2實際瀏覽器流程、2份真實下載檔案與PDF視覺檢視；不是歷史310／344，也不是真實AI／寄信／部署測試。詳細修改及缺項見HANDOFF_NOTES_20260930.md；本輪證據均為verification/20260930-r2-*。R1紀錄保留為歷史，不當成本輪測試。

| 編號 | 需求 | 本次狀態 | 本次程式／證據與剩餘限制 |
|---|---|---|---|
| MD-119 | 保留 KK 整體版型及所有帳號／訂單／購買流程；logo 和品牌改 Adela’s。 | 本輪未完整逐項驗證 | 保留既有實作，原歷史證據不可代替本轮；需依此需求補充實際驗收。 |
| MD-120 | PDF 收據抬頭統一 **Adela's Purchasing Agent**；單筆訂單 PDF 可下載、內容／狀態／金額／兌換資訊正確。 | 部分驗證；實際下載通過 | R2實際Downloads檔案：取消522與全購物金應付0，抬頭／狀態／50免運及472折抵均核對；hash、時間與渲染見r2-pdf-download-results。真實營運及兌換收據情境仍待確認。 |
| MD-121 | 修「登入成功但仍未登入」循環，包含重新整理、跨頁、退出與再次登入。先前本機修法是網站會員 Session 優先於 ChatGPT 身分，並在會員載入後才顯示成功；仍需正式驗證。 | 本機API＋部分瀏覽器驗證 | auth6；實際註冊、重新整理仍登入、再次開訂單成功；正式跨站登入未驗。 |
| MD-122 | 「會員不透明化」先前被理解成隱藏費率與計價內部細節、保留應付總價；這是先前實作解讀，並非我明確確認過全部規格。不要把會員等級／權益一起刪掉；只在有實際歧義時向我確認。 | 保留既有規格／部分驗證 | policy-updates與korea-photo-flow重跑；保留會員權益與僅KR限制。完整介面／原圖展示規格仍待驗。 |
| MD-123 | 集滿 **30 點送韓國小包零食**；前台、會員、結帳、訂單、後台及 PDF 一致，不再沿用舊門檻／獎品。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-124 | 語言加入韓文，切換與主要前後台、表單、錯誤、訂單狀態、商品內容均能使用，不只有按鈕或少數字串。 | 本機部分驗證 | R2英韓商品名稱、庫存未知標示、英文券名稱快照、客服品牌與Taipei時間；localization40及notifications7重新通過。舊快照缺英文名保留原文，不偽翻譯。每頁／每語言組合仍待核對。 |
| MD-125 | 代購國家保留多國選擇，目前只開放韓國；其他國家可見但不能誤下單。 | 保留既有規格／部分驗證 | policy-updates與korea-photo-flow重跑；保留會員權益與僅KR限制。完整介面／原圖展示規格仍待驗。 |
| MD-126 | 使用者說「圖一不用第三欄」：需從最新畫面或補圖確認對應，不可猜測後刪錯欄位。 | 缺原始圖 | 原圖1–6未附，未猜測刪欄。 |
| MD-127 | 付款／資料輸入頁重排清楚，欄位有標籤、用途、必填／選填與錯誤提示；改善目前雜乱且難理解的輸入區。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-131 | 後台左側獨立 **AI 管理** 入口，不要只藏在商品表單內。 | 本機瀏覽器通過；真AI受阻 | R2桌面與390窄版左側／底部獨立AI入口，8選單可見；真服務尚未配置。 |
| MD-132 | 新增／編輯商品上方兩個左右並排的小卡：「手動」「AI」，點選後整個 box 變藍色。 | 本機瀏覽器通過 | R2手機商品編輯兩模式可切換，選中呈藍；未配置AI會停用並提示。 |
| MD-133 | AI 模式只顯示 AI 工作流程，不再把完整手動欄位堆在下面；手動模式清楚分出上傳圖片／提供圖片 URL／商品欄位。 | 本機瀏覽器通過 | R2 AI模式只顯示AI流程；手動模式保留表單。缺AI提示與草稿停用已實際操作。 |
| MD-134 | AI 新增／編輯採逐步詢問：商品名稱 → 使用者給 KRW 價格或選 AI research → 規格／變體 → 圖片 research／自己上傳／貼連結 → 預覽並問圖片是否正確 → 核價與確認 → 寫入商品庫。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-135 | 貼商品網頁 URL，AI 能擷取頁面真正商品圖片，不把整個網頁 URL 當圖片 URL。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-136 | 所有 AI 功能真正接通：商品研究、查價、找圖、AI Scan／照片估價、編輯、新增、後台指令、客服等已有入口均需盤點實測。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-137 | AI 能停售／撤下指定商品、修改指定商品、批次改全部或指定商品的到貨日期區間。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-138 | AI 能把某個商品在相關訂單中一次標記「已買到」；正確選定商品與符合狀態的訂單，提供影響清單，不誤改未付款／取消單。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-139 | AI Scan 找到商品後，在賣家確認價格且通過審核後可自動發布到商品庫。要有「全部審核」勾選功能，個別項目仍可取消；未勾選／未核價項目不得发布。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-140 | 批次修改確認對象、變更内容与影响範圍，實際成功才報成功；失敗／逾時要可恢復、不重複新增商品。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-141 | AI 端點驗證管理員權限，秘密留服務端。連線失敗顯示真實原因，不以偽造／硬編碼回覆冒充 AI 成功。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-142 | 模型用經實測可用的 GPT-6 設定；先前 `gpt-6-astra` 字串需查證供應商支援，不能宣稱設定名稱就是已啟用。 | 部分程式與mock驗證；真實AI受阻 | admin-batch／ai-command／ai-scan＋drizzle0020；13項mock API驗證含影響範圍、並發、舊預覽、回滾、選擇核准；原policy等批次買到測試重跑。provider/model未配置，不宣稱真AI接通。 |
| MD-148 | 保留並強制執行退款截止日，前後端都限制，過期不能以直接 API 取消繞過。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-149 | 退款／取消完成，訂單 status 明確變 **已取消**；前後台顯示退款處理結果、已轉購物金／折抵額、金額、時間、原訂單號。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-150 | 例：已確認付款訂單 NT$522 取消，應產生 NT$522 下次自動折抵，不能重複退款或多發。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-151 | 自動寄送／送出「您的退款申請已經通過」通知；站內通知與外部寄送通道分開驗證，不能只插入 DB 訊息便說已寄信。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-152 | 自動回沖該訂單帶來的里程／點數／會員累積金額／件數／等級相關累計，不可扣掉其他訂單的累積。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-153 | 未付款取消不發現金等額購物金；已用購物金的訂單取消須正確恢復，混合付款也不可重複計算。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-154 | 重按、重送、重試與並發皆不能重複發購物金／回沖點數。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-155 | 下一單自動折抵且顯示使用金額、應付餘額與剩餘額度。 | 本機驗證；實際服務部分受阻 | price-revisions／order-actions／shop confirm_custom；credit20＋wallet30＋regressions23及policy61重跑。並發／回滾／舊提案／里程不足相容；瀏覽器522取消回購物金。Email需實際sender。 |
| MD-161 | 一般運費統一 **NT$50**，金鑽會員例外保留原權益；離島維持原規則。 | 本島本機通過；離島缺資料 | 一般50、金鑽免運已重跑；離島原費率未提供，不編造。 |
| MD-162 | 下單前可選加急／優先取貨，**加急運費 NT$80**；不擅自解讀為 50 再加 80。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-163 | 每一個購物區間總共最多 **10 筆加急訂單**，跨會員共用限制；並發下單也不可超額。取消是否釋出名額若既有規則未定，明確列出待定。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-164 | 預計可取貨日為起訖區間，後台可修改，前台訂單與 PDF 同步。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-165 | 後台可按「已取貨」，記錄完成時間。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-166 | 「採買中」依最新要求保留，圓圈下方先顯示預計採買日期／區間，到該區間自動切換。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-167 | 注意目前 `lib/order-scheduler.ts` 是 request-time reconciliation／後台刷新觸發，不是真正排程；若要無人開頁也準時更新，必須補實際排程或明確驗證符合需求。 | 本機API通過／部分介面驗證 | wallet-delivery／regressions／policy；加急80、全站10筆並發、取消釋放；購物金差額與會員規則按現有流程保存。完整頁面待驗。 |
| MD-171 | 非 AI 待審核訂單，下單後是「訂單已確認」。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-172 | 明確分開訂單已確認、買家已回報付款、賣家確認已付款、採買中、已買到、待取貨、已取貨／完成、已取消；不要買家只按按鈕就當收款成功。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-173 | 付款回報放在容易找到的位置，操作簡單，可上傳付款截圖、輸入末五碼，或兩者一起提供。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-174 | 賣家確認付款後才標「已付款」及正確累計；Stripe 若接通以可信付款事件對帳。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-175 | 時間放在訂單進度各圓圈下面，不放在使用者要求移除的另一狀態欄旁重複顯示。 | 部分瀏覽器驗證／缺原圖 | OrderProgress的付款與訂單時間在節點下方已見；未取得原圖第三欄對照，不稱已比對。 |
| MD-176 | 採買日期到期自動進階，但不可推進未驗證付款、待報價確認、已取消等不適合訂單。 | 本機compiled scheduled通過；線上受阻 | order-scheduler、worker event.scheduledTime；14項無page-view測試含不適用狀態、每日去重、失敗回滾；正式cron沒有證據。 |
| MD-177 | 後台分「尚未解決」「已解決」；已取貨完成才歸已解決，並可按已付款、已買到等 status 篩選。 | 本機部分瀏覽器驗證 | 後台Resolved＝Collected與Paid/Purchased filter已見；policy狀態更新重跑。所有篩選互動與原圖未完整驗。 |
| MD-178 | 退款、取消、欠款、待付款確認等都有清楚標記，不再看不出整張訂單發生什麼事。 | 本機部分驗證 | payment-report與後台付款流程；API及瀏覽器522案例：末五碼→payment_review→賣家核對paid→累計。390窄版基本會員／結帳已核對；付款截圖及實際收款待驗。 |
| MD-182 | 後台每張券可設定低消、期限、適用類別、適用會員、Public／Private 等。 | 本機API＋部分瀏覽器通過 | R2實際建立公開限量及私人低消券，起訖日期保存／編輯回填；wallet、policy、commerce套件重新通過。全部券類與語言组合未逐一點選。 |
| MD-183 | 類別限定券的低消用該 Category 合格商品小計判斷，不用全購物車總額湊門檻。 | 本機API通過；完整互動待驗 | commerce-admin／offers／wallet-controls；wallet30、regressions23、policy61、commerce38、email20；Public／Private、分類低消、期限、一次券、長期無碼會員優惠、並發回滾重跑。完整券瀏覽器鏈仍待做。 |
| MD-184 | 可以给指定用戶永久優惠；**永久優惠是否可重複套用**與「所有券只能使用一次」有潛在衝突，應分清長期會員優惠資格與一次性券，不能擅自給永久無限重複用券。 | 本機API通過；完整互動待驗 | commerce-admin／offers／wallet-controls；wallet30、regressions23、policy61、commerce38、email20；Public／Private、分類低消、期限、一次券、長期無碼會員優惠、並發回滾重跑。完整券瀏覽器鏈仍待做。 |
| MD-185 | 前台新增「我的優惠券」區，可輸入優惠碼兌換。 | 本機API＋瀏覽器通過 | R2 My coupons輸入QA2PRIVATE領取，保存到同一wallet；隔離合成帳號，非正式雙站。 |
| MD-186 | Public 券可在我的優惠券中看見並領取，在期限內使用。 | 本機API＋瀏覽器通過 | R2公开QA2FREE實際領取、免運50、结帐使用并显示Used；過期／額度／並發由API套件重跑。 |
| MD-187 | Private 券未兌換前不出現在公開領券清單，輸入碼後才進入該會員錢包。 | 本機API通過；完整互動待驗 | commerce-admin／offers／wallet-controls；wallet30、regressions23、policy61、commerce38、email20；Public／Private、分類低消、期限、一次券、長期無碼會員優惠、並發回滾重跑。完整券瀏覽器鏈仍待做。 |
| MD-188 | 下單前用「我的優惠券」列表取代只輸入碼；所有已領券可見，不符資格的置灰並說明原因。 | 本機API＋瀏覽器通過 | R2已领券可見；Used券停用；私人低消2000但适用商品437時停用并說明；規則修改後重新報價生效。 |
| MD-189 | 同一订单可使用多張符合資格券，後端計算疊加後的正確總額，不可負數、重複消耗或多用一次性券。 | 本機API通過；完整互動待驗 | commerce-admin／offers／wallet-controls；wallet30、regressions23、policy61、commerce38、email20；Public／Private、分類低消、期限、一次券、長期無碼會員優惠、並發回滾重跑。完整券瀏覽器鏈仍待做。 |
| MD-190 | 所有一般優惠券一次性使用；跨會員各一次或整個活動總共一次／限量以後台規則明確定義，避免前端自行猜測。 | 本機API＋瀏覽器通過 | R2免運券使用後顯示Used且不能再選；recovery-sync新增已用券再估價拒絕及歴史雙語快照不随活動改名變動。 |
| MD-191 | 公開領券、私碼兌換、低消、類別門檻、到期、指定會員、多券、已使用、並發重送均測試。 | 本機API通過；完整互動待驗 | commerce-admin／offers／wallet-controls；wallet30、regressions23、policy61、commerce38、email20；Public／Private、分類低消、期限、一次券、長期無碼會員優惠、並發回滾重跑。完整券瀏覽器鏈仍待做。 |
| MD-195 | 「真人客服」所在入口直接有通知圖示／未讀提醒，不要只藏在通知中心。 | 部分本機驗證；實際Email受阻 | notification-text英韓＋email-outbox20mock測試；站內與queue原子rollback；emailConfigured真實反映空設定。真人客服未讀入口未完整互動，真實信箱未測。 |
| MD-196 | 後台有新訂單、訂單待處理／異常、是否接受訂單、付款回報、退款等通知。 | 站內與真人客服本機通過；實際Email受阻 | R2真人請求產生後台未讀1，管理員開對話回覆，買家看到相同內容；email-outbox20仍為mock，無真信箱證據。 |
| MD-197 | 自動退款通知可靠、不重複，必要時可重試。 | 部分本機驗證；實際Email受阻 | notification-text英韓＋email-outbox20mock測試；站內與queue原子rollback；emailConfigured真實反映空設定。真人客服未讀入口未完整互動，真實信箱未測。 |
| MD-198 | 使用者曾問 Cloudflare 通知連動，但目前沒有已啟用外部寄送服務的查證結果；先確認現有通道、環境變數及事件處理，不要假定 Cloudflare 免費帳號代表已接好郵件。 | 部分本機驗證；實際Email受阻 | notification-text英韓＋email-outbox20mock測試；站內與queue原子rollback；emailConfigured真實反映空設定。真人客服未讀入口未完整互動，真實信箱未測。 |
| PRODUCT-01 | 商品全數補齊、圖片正確可載入 | 尚未全部完成 | catalog recovery17筆，6列售11草稿；可見93（不是完整型錄），API catalog56＋recovery11，研究證據保留；新潮牌可買尺寸未確認，不冒充可列售。所有照片瀏覽器待驗。 |
| PRODUCT-02 | 剝皮軟糖單包、咖啡糖三口味單盒 | 本機資料/API通過 | Orion三款67g與三種I'MINT32g單盒保留；瀏覽器Grape單包可下單。組合分攤成本明示，沒有冒充單盒店家標價。 |
| PRODUCT-03 | 所有商品台灣同規格市售價 | 尚未全部完成 | 空欄補價與精確種子文案修復；既有50款及新增可見5款仍缺同規格台灣參考。Dokdo200/500分開、促銷與參考分類；賣家修改保護recovery11通過。 |
| PRODUCT-04 | Olive Young、Diptyque、Byredo、Le Labo、Stüssy、韓國潮牌 | 尚未全部完成 | catalog recovery17筆，6列售11草稿；可見93（不是完整型錄），API catalog56＋recovery11，研究證據保留；新潮牌可買尺寸未確認，不冒充可列售。所有照片瀏覽器待驗。 |
| SYNC-01 | 前台 Netlify 與 Business ChatGPT Sites 後台同步 | 本機proxy同一DB通過；正式雙站受阻 | R2 recovery-sync15：同backendId／r2識別、付款取消522、券與購物金512→余额10、雙語快照不回寫、已用券拒絕。實際Netlify／Sites部署尚未驗。 |
| SYNC-02 | 前後台可發布且 ZIP 完整 | 兩種本機build通過；未發布 | Sites與Netlify建置、ZIP源碼提交／SHA manifest。Sites owner可存取但v9/noLiveUrl/env0。需全部門檻過後才部署並交真網址。 |

發布限制以 verification/RELEASE_GATE.json 為準；本機通過不表示所有門檻通過。

R2手機證據：390×844實測寬度390，首頁／會員／結帳／後台AI／訂單篩選；修正後台header固定高度及8選單遮蔽。未宣稱全部彈窗或每一語言组合已驗收。
