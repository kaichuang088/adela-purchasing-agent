"""Produce reviewable sourcing reports from recorded public responses and isolated tests."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
audit = json.loads((root / 'verification/r19-catalog-audit.json').read_text())
parity = json.loads((root / 'verification/r19-lelabo-checkout-results.json').read_text())

def cell(value):
    return str(value if value is not None else '未核實').replace('|', '\\|').replace('\n', ' ')

intro = """# R19 Le Labo 逐規格內部比較（2026-10-10）

本表來自隔離資料庫重建的現有商品，不是線上資料匯出。台韓官方頁面、公開價格 API、SKU 可購狀態與 SSG／PChome 商店頁已實際 GET 查核；原始證據摘要、URL、SKU、條件及回應 SHA256 在 verification/r19-sourcing/。未把初始 HTML 的空價格或 inStock=false 當作真實庫存。

**2026-10-10實際查到每日公開中間參考匯率0.023824；本表使用此值，不等於當前線上設定或已確認實際採買匯率。** 同時臺銀韓元現金賣出為0.02594，兩者不能混用；既有fetchBankRate因KRW即期欄為0走每日fallback，尚未自行變更採買匯率政策。若用臺銀現金，55mL護手霜成本NT$1,090超上限NT$45，250mL沐浴膠成本NT$1,272超上限NT$37；需賣家核实實際交易匯率，不能將中間價當作銀行實際售匯價。 韓元成本包含必要韓國境內運費；商品售價不含另列的買家配送費。所有上限取 floor(台灣同規格價×0.95)。成本已高於上限時，降低服務費仍不能解決，不虛構成本或默認虧損。

台灣官方比較用公開價格 API 的當前 buq，不能把較低的舊 listBuq 當作當前促銷。SANTAL 33／ANOTHER 13 50mL 的 PChome 比較為單瓶國際航空版／平行輸入公開促銷 NT$6,350，非會員回饋；不把官方價 NT$7,600 代入來放寬它的上限。SSG 的 ₩303,050 及手部乳液 ₩56,050 有「可能僅部分會員適用」條件，未證實資格，所以成本仍用 ₩319,000／₩59,000。韓國官方滿₩40,000境內免運，SSG相關來源滿₩30,000免運；均不代表台灣跨境／末段配送免費。

25筆商品加入受保護資料更新；VIOLETTE 30 50mL仍缺可核實的現行韓國 SKU／價格。三筆既有泛用淡香精商品展開15／50／100mL，保持草稿，新增規格庫存0，未假設供應商庫存數。較新的管理員修改會整筆保留，不能保證線上每筆都符合匯出基準。

|ID|商品／選項|含韓國運費₩|參考成本NT$|台灣NT$／分類|95%上限|成本超出上限|查核日期|缺口|
|---|---|---:|---:|---|---:|---:|---|---|
"""
lines = [intro]
references = []
for r in audit['leLabo']:
    lines.append('|'+ '|'.join(cell(x) for x in [r['productId'],r['name']+' '+r['option'],r['costKrw'],r['costTwd'],str(r['taiwanTwd'])+' / '+str(r.get('classification')),r['ceilingTwd'],r['costGapTwd'],r.get('sourceCheckedAt'), '；'.join(r['missing']) or '參考匯率下價格規則通過；線上狀態未驗證'])+'|\n')
    references.append('- ID '+str(r['productId'])+' '+cell(r['option'])+'：韓國 '+cell(r['source'])+'；台灣 '+cell(r['taiwanSource'])+'\n')
lines.append('\n## 逐規格來源\n\n'+''.join(references)+'\n')
lines.append('## 可計價商品的共用展示與結帳核對\n\n測試使用一次性會員、D1及手動參考匯率，不是線上訂單或新庫存承諾。\n\n|商品|商品卡／詳情／購物車／結帳單品NT$|台灣NT$|95%上限|買家配送另列NT$|\n|---|---:|---:|---:|---:|\n')
for r in parity['rows']:
    lines.append('|'+ '|'.join(cell(x) for x in [r['name'],r['cardAndDetailTwd'],r['taiwanTwd'],r['ceilingTwd'],r['shippingSeparateTwd']])+'|\n')
lines.append('\nANOTHER 13 50mL在參考匯率下公開參考匯率下成本NT$7,600，上限NT$6,032，差NT$1,568；估價／結帳拒絕，沒有將顯示成本加費用稱為完成定價。真正恢復可買仍需要符合上限的真實採買來源。\n')
(root/'LE_LABO_R19_REVIEW.md').write_text(''.join(lines))

gaps=[f"""# R19 商品逐規格缺口

隔離來源重建：{audit['products']}商品、{audit['variants']}規格，{len(audit['issues'])}規格至少有一項下列缺口。這不是線上資料庫，也不是已全部查核／可購買商品數。

R18為228規格／211缺口。本次三個淡香精父商品各展開3規格，總數增加6；本表另加台灣明確規格、售價分類、舊較低比較價重驗及原廠遠端照片未下載檢查，216不能直接當作舊口徑的退步或進度百分比。資料更新及查核不代表剩餘缺口已完成。

## 原附件具體識別

- Stüssy Seoul 黑／白：完整公開韓國 Shopify 型錄5頁、1058筆未找到 Seoul 商品；這不證明首爾實體Chapter店沒販售。仍缺Chapter限定款現行SKU、各色尺寸、實體店成本／運费、當前照片與採買可用性；不以Basic Tee或公開一般T恤代替。
- `截圖 2026-10-09 下午9.06.45.png`：上方UNOVE瓶罐與三麗鷗周邊是拼圖，須分清洗髮／護髮容量、正式商品與贈品；下方疑似COLORGRAM彩妝不可用普通非聯名SKU取代。品牌候選不等於SKU确认。
- `截圖 2026-10-09 下午9.07.09.png`：含COLORGRAM／WAKEMAKE疑似聯名彩妝與吊飾，底部橄欖洋聯名包裝尚不能可靠辨識品名，不能當乳液或髮梳猜測，也不能把整張合為一件商品。仍缺品號、色號、重量、套裝／贈品條件與相對應正式商品照片。
- Olive Young初始搜尋HTML為延遲載入外殼；本次已讀公開搜尋JS及標準商品搜尋API，不能把空HTML當成查無商品。已查到WAKEMAKE豹紋Hello Kitty等現行SKU，但它們不能自動視為附件中的舊聯名款。原廠照片25張現已下載入包；未把搜尋候選當成已識別或已完成售價。個別make p:rem NMN套組已見50+20mL與周邊條件，但台灣同包裝比較及必要運費未完成。
- Le Labo已查25筆商品成本／來源，尚有超出上限、台灣同SKU缺失及附件圖片與SKU對應缺口，逐筆見LE_LABO_R19_REVIEW.md。VIOLETTE 30單獨列為現行韓國來源不足，未改成本。

以下保留每個商品與選項，未刪除、改標籤或隱藏待辦掩飾。沒有擅自提高台灣比較價格來放寬售價上限。

|ID|商品／選項|狀態|韓元成本|具體缺口|韓國來源|
|---|---|---|---:|---|---|
"""]
for r in audit['issues']:
    gaps.append('|'+ '|'.join(cell(x) for x in [r['productId'],r['name']+' '+r['option'],r['status'],r['costKrw'],'；'.join(r['missing']),r['source']])+'|\n')
(root/'CATALOG_R19_GAPS.md').write_text(''.join(gaps))

figures=[]
for p in sorted((root/'verification/r19-mobile').glob('*.png')):
    name=html.escape(p.name);path='verification/r19-mobile/'+name
    figures.append(f'<figure><figcaption>{name}</figcaption><a href="{path}"><img loading="lazy" src="{path}" alt="{name}"></a></figure>')
(root/'MOBILE_R19.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R19手機尺寸測試</title><style>body{font-family:system-ui;margin:24px;background:#f4f6f7}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0}img{width:100%;max-width:430px;height:auto;border:1px solid #ccc}figcaption{margin:8px 0}</style><h1>R19本機 Chromium 手機尺寸測試</h1><p>375、390、430 px；隔離資料，非線上私人Site或實體手機通知驗證。測試銀行不可付款。</p><section>'+''.join(figures)+'</section></html>')
