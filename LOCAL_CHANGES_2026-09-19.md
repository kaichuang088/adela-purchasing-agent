# KK Purchasing Agent 本機修改 Checklist — 2026-09-19

## 來源與限制

- [x] 唯一來源為 `KK_Purchasing_Agent_source_776bcd66.zip`。
- [x] 已檢查 `package.json`、`.openai/hosting.json`、`netlify.toml`。
- [x] 已移除另一個 Workspace 的 Sites Project ID。
- [x] 未建立新 Sites、Cloudflare D1、R2 或 Netlify site。
- [x] 未部署或讀寫正式資料。

## 顧客前台與客服

- [x] 上方與手機導覽的 AI 客服開啟完整頁面。
- [x] 可建立新對話，顧客畫面重新開始；後台保留完整歷史。
- [x] 訂單問題先選本人訂單，可查付款、取消、退款、配送及會員規則。
- [x] 不主動顯示「轉真人」按鈕；中文或英文要求人工時自動轉接。
- [x] AI 無法處理時保存對話、建立後台摘要並通知管理員。
- [x] 修正非 JSON 回應造成的 `Unexpected end of JSON input`／HTML JSON parse 錯誤。

## 付款、通知與訂單

- [x] 買家先按「我已匯款」並填 5 位帳號末碼。
- [x] 後台不能直接把未回報的訂單改為已付款，只能核對「已收到／未收到」。
- [x] 核對結果會寫入同一個 D1 並通知買家。
- [x] 預設採買時間為台北時間 2027-01-29 10:00；免費取消截止為前 24 小時。
- [x] 後台可逐商品調整採買時間、販售期間、暫停或停止販售。
- [x] 採買開始或截止後禁止一般取消；收貨後 24 小時內可附照片申請瑕疵換貨。
- [x] 訂單進度改為：訂單已確認、採買中、已買到、商家已寄出、配送中、已收貨。
- [x] 顧客 PDF 一次只匯出一筆訂單；管理員仍可合併同一買家的訂單。
- [x] 付款提醒可在後台開關，Cloudflare 排程預設台北每天 10:00。

## 商品、優惠與 AI 查價

- [x] 首頁移除舊展示區，直接顯示商品。
- [x] 後台優惠券支援代購費率、商品幾折／折多少、免運、運費幾折／折多少、整筆訂單幾折／折多少；下單前顯示實際折扣。
- [x] 日本商品同時保存官方含稅價與百貨退稅估算價；估算公式扣除消費稅後再加計未稅價 1.55% 百貨手續費，並標示旅客資格及出境確認條件。
- [x] 商品售價顯示已含代購服務的總額，不公開費率拆解。
- [x] 加入 MALEBRANCHE 茶の菓、NY Perfect Cheese、Calbee Jaga Pokkuru 與 Le Labo Santal 33／Another 13 的盒數或 mL 規格。
- [x] 加入 SUQQU 防曬日霜／The Primer、Armani Privé Thé Yulong、CHANEL 1957／N°5、Aesop Tacit Truths／護手霜及其容量或款式。
- [x] CHANEL 1957 明示限定通路、無法保證庫存，買不到該商品 100% 退款。
- [x] MINTIA、HI-CHEW Premium、白元除皺噴霧、STÜSSY Osaka 先建為後台草稿；官方售價或真偽庫存未核對前不公開下單。
- [x] 多規格商品加入購物車前必須選規格，每個規格有自己的價格。
- [x] 後台可查看近期購買指定商品的會員。
- [x] AI 客製商品可由管理員公開到賣場。
- [x] AI 照片查價依選定國家核對精確商品、當地販售、庫存、幣別與來源；日本查無精確販售時不建立訂單。
- [x] R2 缺席時使用同一個 D1 暫存壓縮圖片，並清理取消、購買及過期草稿。

## 本機驗證

| 指令 | 結果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通過 |
| `pnpm exec tsc --noEmit` | 通過 |
| `pnpm run build` | 通過 |
| `node scripts/verify-photo-quotes.mjs` | 20 / 20 |
| `node scripts/verify-commerce.mjs` | 38 / 38 |
| `node scripts/verify-policy-updates.mjs` | 53 / 53 |
| `node scripts/verify-auth.mjs` | 4 / 4 |
| `node scripts/verify-receipt.mjs` | 通過，成功產生繁中 PDF |

照片與客服測試使用模擬 AI；不等同真實 provider 已連線。建置只有大型 client chunk 警告，沒有 build error。

## 尚待正式環境完成

- [ ] 套用尚未執行的 migrations 到同一個既有 D1。
- [ ] 更新同一個 Cloudflare Worker、AI secrets 與 Cron Trigger。
- [ ] 用真實 AI provider 驗證照片查價與客服。
- [ ] 設定兩個 Netlify site 的同一個 `KK_BACKEND_URL`，各部署一次。
- [ ] 驗證前台／後台共享會員、訂單、付款、通知與客服資料。
- [ ] 重新上傳先前附件中無法讀取、且沒有可辨識品名的商品照片後，再補該商品。
