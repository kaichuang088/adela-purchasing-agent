# R19 Le Labo 逐規格內部比較（2026-10-10）

本表來自隔離資料庫重建的現有商品，不是線上資料匯出。台韓官方頁面、公開價格 API、SKU 可購狀態與 SSG／PChome 商店頁已實際 GET 查核；原始證據摘要、URL、SKU、條件及回應 SHA256 在 verification/r19-sourcing/。未把初始 HTML 的空價格或 inStock=false 當作真實庫存。

**2026-10-10實際查到每日公開中間參考匯率0.023824；本表使用此值，不等於當前線上設定或已確認實際採買匯率。** 同時臺銀韓元現金賣出為0.02594，兩者不能混用；既有fetchBankRate因KRW即期欄為0走每日fallback，尚未自行變更採買匯率政策。若用臺銀現金，55mL護手霜成本NT$1,090超上限NT$45，250mL沐浴膠成本NT$1,272超上限NT$37；需賣家核实實際交易匯率，不能將中間價當作銀行實際售匯價。 韓元成本包含必要韓國境內運費；商品售價不含另列的買家配送費。所有上限取 floor(台灣同規格價×0.95)。成本已高於上限時，降低服務費仍不能解決，不虛構成本或默認虧損。

台灣官方比較用公開價格 API 的當前 buq，不能把較低的舊 listBuq 當作當前促銷。SANTAL 33／ANOTHER 13 50mL 的 PChome 比較為單瓶國際航空版／平行輸入公開促銷 NT$6,350，非會員回饋；不把官方價 NT$7,600 代入來放寬它的上限。SSG 的 ₩303,050 及手部乳液 ₩56,050 有「可能僅部分會員適用」條件，未證實資格，所以成本仍用 ₩319,000／₩59,000。韓國官方滿₩40,000境內免運，SSG相關來源滿₩30,000免運；均不代表台灣跨境／末段配送免費。

25筆商品加入受保護資料更新；VIOLETTE 30 50mL仍缺可核實的現行韓國 SKU／價格。三筆既有泛用淡香精商品展開15／50／100mL，保持草稿，新增規格庫存0，未假設供應商庫存數。較新的管理員修改會整筆保留，不能保證線上每筆都符合匯出基準。

|ID|商品／選項|含韓國運費₩|參考成本NT$|台灣NT$／分類|95%上限|成本超出上限|查核日期|缺口|
|---|---|---:|---:|---|---:|---:|---|---|
|166|Le Labo 滾珠體香劑 50mL |52000|1239|1550 / taiwan_preorder_retailer|1472|0|2026-10-10|台灣同規格明確記錄；可核實的台灣一般／公開促銷／預購／現貨分類|
|132|Le Labo 檜木護手霜 55ml |42000|1001|1100 / regular|1045|0|2026-10-10|參考匯率下價格規則通過；線上狀態未驗證|
|125|Le Labo 樹果 19淡香精 100ml |462000|11007|10900 / regular|10355|652|2026-10-10|成本高於95%上限|
|124|Le Labo 百合 41淡香精 100ml |462000|11007|10650 / retailer_reference_price|10117|890|2026-10-10|原較低台灣來源未重驗；新官方價較高，未擅自提高比較基準；可核實的台灣一般／公開促銷／預購／現貨分類；成本高於95%上限|
|123|Le Labo 香根草 46淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|122|Le Labo 岩薔薇 18淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|121|Le Labo 紫羅蘭 30淡香精 50ml |319000|7600|None / |未核實|未核實|2026-09-30|商品照片；必要韓國運費與折扣條件確認；有效台灣同規格價格／來源／日期；台灣同規格明確記錄；可核實的台灣一般／公開促銷／預購／現貨分類|
|120|Le Labo 薰衣草 31淡香精 50ml |319000|7600|None / |未核實|未核實|2026-10-10|有效台灣同規格價格／來源／日期；台灣同規格明確記錄；可核實的台灣一般／公開促銷／預購／現貨分類|
|119|Le Labo 東加豆 25淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|118|Le Labo 苦橙 36淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|117|Le Labo 依蘭 49淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|116|Le Labo 香葵 9淡香精 50ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|86|Le Labo 檜木沐浴膠 250 ml |49000|1168|1300 / regular|1235|0|2026-10-10|參考匯率下價格規則通過；線上狀態未驗證|
|85|Le Labo 檜木護手乳 250 ml |59000|1406|1600 / |1520|0|2026-10-10|有效台灣同規格價格／來源／日期；原較低台灣來源未重驗；新官方價較高，未擅自提高比較基準；可核實的台灣一般／公開促銷／預購／現貨分類|
|84|Le Labo 羅勒洗手露 250 ml |44000|1049|1250 / regular|1187|0|2026-10-10|參考匯率下價格規則通過；線上狀態未驗證|
|83|Le Labo 玫瑰 31 淡香精 50 ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|82|Le Labo 佛手柑 22 淡香精 50 ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|81|Le Labo 末茶 26 淡香精 50 ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|80|Le Labo 黑茶 29 淡香精 50 ml |319000|7600|7600 / regular|7220|380|2026-10-10|成本高於95%上限|
|79|Le Labo 別物 13 淡香精 50 ml |319000|7600|6350 / public_promotion|6032|1568|2026-10-10|成本高於95%上限|
|72|Le Labo HINOKI 檜木洗手露 250ml |44000|1049|1080 / |1026|23|2026-10-10|有效台灣同規格價格／來源／日期；原較低台灣來源未重驗；新官方價較高，未擅自提高比較基準；可核實的台灣一般／公開促銷／預購／現貨分類；成本高於95%上限|
|71|Le Labo SANTAL 33 淡香精 50ml |319000|7600|6350 / public_promotion|6032|1568|2026-10-10|成本高於95%上限|
|43|Le Labo ANOTHER 13 香氛護手霜 30ml |43000|1025|None / |未核實|未核實|2026-10-10|有效台灣同規格價格／來源／日期；台灣同規格明確記錄；可核實的台灣一般／公開促銷／預購／現貨分類|
|42|Le Labo SANTAL 33 香水 15ml × 1瓶|140000|3336|3350 / regular|3182|154|2026-10-10|成本高於95%上限|
|42|Le Labo SANTAL 33 香水 50ml × 1瓶|319000|7600|6350 / public_promotion|6032|1568|2026-10-10|成本高於95%上限|
|42|Le Labo SANTAL 33 香水 100ml × 1瓶|462000|11007|10900 / regular|10355|652|2026-10-10|成本高於95%上限|
|4|Le Labo ANOTHER 13 淡香精 15ml × 1瓶|140000|3336|3350 / regular|3182|154|2026-10-10|成本高於95%上限|
|4|Le Labo ANOTHER 13 淡香精 50ml × 1瓶|319000|7600|6350 / public_promotion|6032|1568|2026-10-10|成本高於95%上限|
|4|Le Labo ANOTHER 13 淡香精 100ml × 1瓶|462000|11007|10900 / regular|10355|652|2026-10-10|成本高於95%上限|
|3|Le Labo SANTAL 33 淡香精 15ml × 1瓶|140000|3336|3350 / regular|3182|154|2026-10-10|成本高於95%上限|
|3|Le Labo SANTAL 33 淡香精 50ml × 1瓶|319000|7600|6350 / public_promotion|6032|1568|2026-10-10|成本高於95%上限|
|3|Le Labo SANTAL 33 淡香精 100ml × 1瓶|462000|11007|10900 / regular|10355|652|2026-10-10|成本高於95%上限|

## 逐規格來源

- ID 166 ：韓國 https://www.lelabofragrances.co.kr/deodorant-1085.html?size=50ml；台灣 https://mall.iopenmall.tw/109531/index.php?action=product_detail&prod_no=P10953115286142
- ID 132 ：韓國 https://www.lelabofragrances.co.kr/hand-pomade-1068.html?size=55ml；台灣 https://www.lelabofragrances.com.tw/hand-pomade-1068.html?size=55ml
- ID 125 ：韓國 https://www.lelabofragrances.co.kr/baie-19-1132.html?size=100ml；台灣 https://www.lelabofragrances.com.tw/baie-19-1132.html?size=100ml
- ID 124 ：韓國 https://www.lelabofragrances.co.kr/lys-41-878.html?size=100ml；台灣 https://www.1976.com.tw/prod/20424
- ID 123 ：韓國 https://www.lelabofragrances.co.kr/vetiver-46-1029.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/vetiver-46-1029.html?size=50ml
- ID 122 ：韓國 https://www.lelabofragrances.co.kr/labdanum-18-856.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/labdanum-18-856.html?size=50ml
- ID 121 ：韓國 https://department.ssg.com/item/itemView.ssg?itemId=1000780499398&salestrNo=1004&siteNo=6009；台灣 
- ID 120 ：韓國 https://www.lelabofragrances.co.kr/31--lavande-31-1265.html?size=50ml；台灣 
- ID 119 ：韓國 https://www.lelabofragrances.co.kr/tonka-25-1105.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/tonka-25-1105.html?size=50ml
- ID 118 ：韓國 https://www.lelabofragrances.co.kr/neroli-36-904.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/neroli-36-904.html?size=50ml
- ID 117 ：韓國 https://www.lelabofragrances.co.kr/ylang-49-1043.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/ylang-49-1043.html?size=50ml
- ID 116 ：韓國 https://www.lelabofragrances.co.kr/ambrette-9-735.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/ambrette-9-735.html?size=50ml
- ID 86 ：韓國 https://www.lelabofragrances.co.kr/shower-gel-1062.html?size=250ml；台灣 https://www.lelabofragrances.com.tw/shower-gel-1062.html?size=250ml
- ID 85 ：韓國 https://www.ssg.com/item/itemView.ssg?itemId=1000024865773；台灣 https://www.lelabofragrances.com.tw/hand-lotion-1059.html?size=250ml
- ID 84 ：韓國 https://www.lelabofragrances.co.kr/hand-soap-1113.html?size=250ml；台灣 https://www.lelabofragrances.com.tw/hand-soap-1113.html?size=250ml
- ID 83 ：韓國 https://www.lelabofragrances.co.kr/rose-31-962.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/rose-31-962.html?size=50ml
- ID 82 ：韓國 https://www.lelabofragrances.co.kr/bergamote-22-771.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/bergamote-22-771.html?size=50ml
- ID 81 ：韓國 https://www.lelabofragrances.co.kr/th-matcha-26-1186.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/th-matcha-26-1186.html?size=50ml
- ID 80 ：韓國 https://www.lelabofragrances.co.kr/th-noir-29-1003.html?size=50ml；台灣 https://www.lelabofragrances.com.tw/th-noir-29-1003.html?size=50ml
- ID 79 ：韓國 https://www.lelabofragrances.co.kr/another-13-747.html?size=50ml；台灣 https://24h.pchome.com.tw/prod/DDAHN9-A900K0146
- ID 72 ：韓國 https://www.lelabofragrances.co.kr/hand-soap-1057.html?size=250ml；台灣 https://tw.buy.yahoo.com/gdsale/Le-Labo-Hinoki-檜木洗手露-250ml-平行輸入-11746093.html
- ID 71 ：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=50ml；台灣 https://24h.pchome.com.tw/prod/DDAHN9-A900K0146
- ID 43 ：韓國 https://www.lelabofragrances.co.kr/classic-collection/another-13/perfuming-hand-cream/30-ml?size=30ml；台灣 
- ID 42 15ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=15ml；台灣 https://www.lelabofragrances.com.tw/santal-33-987.html?size=15ml
- ID 42 50ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=50ml；台灣 https://24h.pchome.com.tw/prod/DDAHN9-A900K0146
- ID 42 100ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=100ml；台灣 https://www.lelabofragrances.com.tw/santal-33-987.html?size=100ml
- ID 4 15ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/another-13-747.html?size=15ml；台灣 https://www.lelabofragrances.com.tw/another-13-747.html?size=15ml
- ID 4 50ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/another-13-747.html?size=50ml；台灣 https://24h.pchome.com.tw/prod/DDAHN9-A900K0146
- ID 4 100ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/another-13-747.html?size=100ml；台灣 https://www.lelabofragrances.com.tw/another-13-747.html?size=100ml
- ID 3 15ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=15ml；台灣 https://www.lelabofragrances.com.tw/santal-33-987.html?size=15ml
- ID 3 50ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=50ml；台灣 https://24h.pchome.com.tw/prod/DDAHN9-A900K0146
- ID 3 100ml × 1瓶：韓國 https://www.lelabofragrances.co.kr/santal-33-987.html?size=100ml；台灣 https://www.lelabofragrances.com.tw/santal-33-987.html?size=100ml

## 可計價商品的共用展示與結帳核對

測試使用一次性會員、D1及手動參考匯率，不是線上訂單或新庫存承諾。

|商品|商品卡／詳情／購物車／結帳單品NT$|台灣NT$|95%上限|買家配送另列NT$|
|---|---:|---:|---:|---:|
|Le Labo 羅勒洗手露 250 ml|1116|1250|1187|50|
|Le Labo 檜木沐浴膠 250 ml|1235|1300|1235|50|
|Le Labo 檜木護手霜 55ml|1045|1100|1045|50|

ANOTHER 13 50mL在參考匯率下公開參考匯率下成本NT$7,600，上限NT$6,032，差NT$1,568；估價／結帳拒絕，沒有將顯示成本加費用稱為完成定價。真正恢復可買仍需要符合上限的真實採買來源。
