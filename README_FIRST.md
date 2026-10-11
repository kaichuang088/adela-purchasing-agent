# Adela 最新正式前後台與 AI 交接

**重要：程式已發布，但 Netlify 免費用量已達上限。**
平台確認兩站 disabled=true，原因 `Account usage exceeded for credits`，目前前後台皆503、AI通道也無法使用。
排查中多次部署與真實AI呼叫使用了免費額度；capabilities.credits.used=0是延遲／非即時數字，不能當剩餘額度證據。
沒有購買、升級、自動加值或允許超額；目前停止額外部署與provider呼叫。下一用量週期API列2026-10-30T00:00:00-07:00，即台灣10/30 15:00。
免費重置後需要核對站點恢復及AI；目前不能宣稱可立即線上測試或已Finalize。程式／D1／所有測試證據與ZIP交付仍保留，發布的精確版本沒有回滾。

原始碼 commit：ccc637413889fd1fd60d370065f1d8de333e26b6。
前台：https://adela-purchasing-agent-shop.netlify.app
後台：https://adela-purchasing-agent-admin.netlify.app
前台 deploy：6acbe20d2760eb0d94a6886c；後台 deploy：6acbe21c9a12b0f301102a75。
原 Worker code version：ab1860c2-41fc-452c-811d-a5d22cecfe1a；加入安全 job endpoint 設定後 active version：761c2b27-b8e1-489f-9550-91fcca4b76a2。
沿用原 Netlify IDs、Cloudflare kk-purchasing-agent、原 D1 和 ASSETS。KK 是原後端技術識別，公開前後台品牌／網址已改 Adela。
Sites v31／R20 是交付匯出基準，本次没有發布 Sites；沒有能力獨立讀取原私人 Sites 更後續的版本。此點不等於發布了新版 Sites。

## 完成與實際驗證

- 原 D1 十二個缺少遷移已逐一套用，26份 SQL 現已全部套用，沒有更換或重設資料庫；歷史餘額／價格／贈額沒有追溯改寫。
- 前台客服經原 Worker → Netlify Function → 平台 AI Gateway，真實 gpt-6.1-sol 已成功回覆，不需自有付費 OpenAI API key。
- 照片原約600KB超出免費輸入預算，現在自動壓縮至24KiB；實際605423→22330 bytes、896×896。
- 平台同步 HTTP 約30秒截斷，timeout60和串流實測未解決。最終改為方案已有的 Netlify Background Function：上傳只建草稿並排工作，前台每2秒查自己結果。背景直接用平台注入授權呼叫真實模型，經私有原 Worker 工作 API 存結果與伺服器計價。
- 真實 production 上傳5.33秒回 pending202，研究44.46秒完成，模型實際回報 gpt-6.1-sol；測試商品缺有效韓國商家來源，正確回422，不是假報價或已成立訂單。另實際375px瀏覽器從選照片、等待到來源警告完成，沒有502或截斷結果。
- 任意公開請求／其他會員不能讀私有草稿；原子 claim 防重複 provider 消耗；取消／過期／重複 callback 受限制。來源或模型不一致不會產生報價；不會在未收款時加購物金。所有真實測試使用可清除的測試會員，訂單／購物金異動為0，已清除。
- 後台 ai-check／AI新增草稿／批次查詢（初次暫時失敗，單次重試通過）／指令解析的編譯 handler＋隔離D1＋真實production provider 已測試；沒有用 mock 充當連線證明。
- Cloudflare 真正每分鐘 cron 已有成功紀錄，無須開頁補跑。

## 測試與仍未驗證事項

TypeScript、Cloudflare／前台／後台建置通過；19 proxy、12背景工作流程、5背景傳輸授權、20原照片流程、29隔離金流／價格檢查通過。mock／隔離／真實 provider 證據分開標注。
每站172 static files API SHA1 對應本地建置；手動 Netlify commit_ref=null，title含正確source SHA，published_deploy已核對。
額度暫停前，實際 production Chromium375／390／430的商品／Le Labo詳情／選項、購物車和照片彈窗測試通過。最後商品測試重跑因平台用量暫停頁而失敗，屬外部託管限制，不是通過的最終重跑；證據保留。375另跑真實照片AI；390／430照片只檢查布局。後台較完整45項屬於隔離fixture測試，不是production登入或實體手機。
正式後台保留 Netlify帳號存取保護＋原 ADMIN_PASSWORD；未代驗收原密碼登入。未驗證实體手機Push、Email或真实匯款；原Cloudflare沒有VAPID／Email供應商設定。站內提醒／cron成功不等於手機或Email已送達。
照片測試只證明真實AI與可靠錯誤流程；該規格沒有有效韓國來源，沒有驗證可購買成功報價。歷史商品缺證表／Le Labo規格比較仍須逐項補齊，不能宣稱全部型錄已核實或Finalize。
Netlify函式錯誤紀錄讀取403；Cloudflare訂閱API讀取403，未獨立驗證其帳務方案。沒有任何帳務方案變更。

## 免費用量與交付

沒有升級、購買額度、開自動加值或超額付費，也未啟用Stripe。Netlify帳號kc4study為credit-free，300 included credits，auto-topup=false、overages=false、沒有付款方式，回報用量可能延遲。免費AI不是無限／永久保證，與部署流量共用額度；耗盡應停止而不是購買。
完整前後台 source/、所有圖片字型資產、package.json／鎖檔、SQL／部署設定／說明／變更／證據均在七包。全部七包都要下載；先解壓Verification，按RESTORE.md跑restore.py。逐檔與source commit一致，SHA256／CRC／正常還原驗證。沒有node_modules、密碼、API keys、私鑰或CLI登入憑證。ZIP不是線上資料庫備份。
本次每個先後發布也保留完整對應ZIP；歷史版本只供追溯，不要覆蓋最新版。

## personal account 與環境續作

新聊天拿完整七包，或連接原GitHub分支netlify-r20-storefront-20261011／上述commit；另授權原Netlify擁有者帳號kc4study、原Cloudflare帳號及私人Sites。聊天personal帳號不會自動移轉平台帳號、Sites分享、D1／網域或秘密。
CLOUDFLARE_API_TOKEN及Netlify CLI授權只在新環境安全設定／官方登入，ADMIN_PASSWORD保留在線上，shared gateway secrets不在ZIP。安全配置KK_AI_PHOTO_JOB_URL指向前台 /.netlify/functions/ai-photo-background。持有程式不等於持有資料庫備份；需要DB備份另安全匯出。
雲端環境 install_script／start_skill／repo精確SHA已存草稿；保留既有網域並新增官方函式紀錄及本次兩個draft網域。依setup技能「Saving persists configuration; it does not ... publish」，若要下次保留此工具／設定，需在環境頁review/save/publish；這與網站已正式發布是兩件事。尚未驗證此最後草稿的下一次新任務還原。
歷史「缺token／後端尚未更新／待批准正式發布」已被本次使用者明確授權與實測取代；R20停售新儲值規則保留。交付根目錄PROJECT_STATE.json是實際發布紀錄，source內早期文件留作歷史。
