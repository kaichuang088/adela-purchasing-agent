"""Read public official product/price endpoints; never write a live catalog or execute page JS."""
import concurrent.futures
from datetime import datetime
import hashlib
import html
import json
from pathlib import Path
import re
import urllib.request
import urllib.parse
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parent.parent
output = root / "verification/r19-sourcing"
output.mkdir(parents=True, exist_ok=True)
checked = datetime.now(ZoneInfo("Asia/Taipei")).isoformat()
hosts = {"TW": "https://www.lelabofragrances.com.tw", "KR": "https://www.lelabofragrances.co.kr"}
# Paths discovered from actual official navigation, plus known exact product pages.
paths = ["another-13.html", "santal-33.html", "baie-19.html", "lys-41.html",
         "vetiver-46.html", "labdanum-18.html", "classic-collection/violette-30",
         "lavande-31.html", "tonka-25.html", "neroli-36.html", "ylang-49.html",
         "ambrette-9.html", "rose-31.html", "bergamote-22.html", "th-matcha-26.html",
         "th-noir-29.html", "hand-pomade.html", "hand-lotion.html", "hand-soap.html",
         "shower-gel.html", "deodorant.html", "fine-fragrances/perfuming-hand-cream"]

def read(url, referer=None):
    headers = {"User-Agent": "Mozilla/5.0", "Accept-Language": "en,zh-TW;q=0.9,ko;q=0.8"}
    if referer:
        headers["Referer"] = referer
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as response:
        body = response.read()
        return body.decode("utf-8", errors="replace"), response.url, hashlib.sha256(body).hexdigest()

def json_variable(page, name):
    match = re.search(r"\b(?:var\s+)?" + re.escape(name) + r"\s*=\s*(\{)", page)
    return json.JSONDecoder().raw_decode(page[match.start(1):])[0] if match else {}

def research(pair):
    region, path = pair
    source = hosts[region] + "/" + path
    result = {"region": region, "requestedUrl": source, "checkedAt": checked}
    try:
        page, final, digest = read(source)
        sku_data = json_variable(page, "skusJson")
        result.update(source=final, responseSha256=digest)
        if not sku_data.get("productDatas"):
            result["missing"] = "No exact product SKU data; navigation/category page cannot establish price"
            return result
        product = sku_data["productDatas"][0]
        identifier = product["productId"]
        context = re.search(r"js_site_var\['context_path'\]\s*=\s*'([^']+)'", page)
        if not context:
            raise ValueError("Official product price context missing")
        prices_url = hosts[region] + context.group(1) + "/app/product/prices/" + str(identifier) + ".json"
        prices_body, _, price_hash = read(prices_url, final)
        prices = json.loads(prices_body)["prices"]
        result.update(productId=identifier, productName=product["productName"], priceSource=prices_url, priceResponseSha256=price_hash)
        image_map = json_variable(page, "size_images")
        result["imageMap"] = image_map
        schema_variants = []
        for content in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
            try:
                value = json.loads(content)
                schema_variants.extend(value.get("hasVariant", []))
            except (ValueError, AttributeError):
                pass
        result["variants"] = []
        for sku in sku_data["skuInfos"]:
            option = [{"name": x.get("code"), "value": x.get("optionValue", {}).get("value"), "code": x.get("optionValue", {}).get("altValue1")} for x in sku.get("options", [])]
            price = prices.get(str(sku["itemId"]), {})
            item = {"itemId": sku["itemId"], "sku": sku.get("skuCode"), "options": option, "currency": "TWD" if region == "TW" else "KRW", "regularPrice": price.get("listBuq"), "publicPrice": price.get("buq"), "source": final, "images": [x.get("image") for x in schema_variants if x.get("sku") == sku.get("skuCode")], "stockCountVerified": False}
            # Public official availability endpoint, never a cart or checkout mutation.
            availability_url = hosts[region] + context.group(1) + "/app/sku/available/" + str(sku["itemId"]) + ".json"
            try:
                value, _, availability_hash = read(availability_url, final)
                available = json.loads(value)
                item.update(availabilitySource=availability_url, availabilityResponseSha256=availability_hash, availability=available)
            except Exception as error:
                item["availabilityMissing"] = str(error)
            result["variants"].append(item)
    except Exception as error:
        result["missing"] = str(error)
    print(region, path, "OK" if result.get("variants") else result.get("missing"), flush=True)
    return result

if __name__ == "__main__":
    # Actual navigation loads public Solr product cards. Discover exact page IDs there;
    # a category landing URL is not an individual product source.
    queue = []
    discovery = []
    fragrances = ["another-13", "santal-33", "baie-19", "lys-41", "vetiver-46", "labdanum-18", "violette-30", "31--lavande-31", "tonka-25", "neroli-36", "ylang-49", "ambrette-9", "rose-31", "bergamote-22", "th-matcha-26", "th-noir-29"]
    for region, host in hosts.items():
        index_url = host + "/front/app/proxy/search?" + urllib.parse.urlencode({"wt": "json", "q": "*:*", "rows": 1000})
        text, _, digest = read(index_url)
        response = json.loads(text)["response"]
        docs = response["docs"]
        total = response["numFound"]
        while len(docs) < total and len(docs) < 10000:
            next_url = host + "/front/app/proxy/search?" + urllib.parse.urlencode({"wt": "json", "q": "*:*", "rows": 1000, "start": len(docs)})
            following, _, _ = read(next_url)
            additional = json.loads(following)["response"]["docs"]
            if not additional: break
            docs.extend(additional)
        selected = []
        for doc in docs:
            path = doc.get("page_name_s", "")
            if any(re.fullmatch(re.escape(prefix) + r"-\d+\.html", path) for prefix in fragrances) or re.fullmatch(r"(?:hand-pomade|hand-soap|hand-lotion|shower-gel|deodorant)-\d+\.html", path) or ("another" in path and "hand" in path):
                selected.append({k: doc[k] for k in ["page_name_s", "full_product_name_txt_cjk", "attr_size", "attr_size_alt", "attr_sku_code", "sku_id_s", "attr_product_type", "attr_product_type_fr", "price_twd_i", "price_krw_i", "images_sm", "image_s", "attr_scent"] if k in doc})
        discovery.append({"region": region, "source": index_url, "responseSha256": digest, "checkedAt": checked, "selected": selected, "indexedSkuCount": total, "readSkuCount": len(docs)})
        queue.extend((region, path) for path in sorted({x["page_name_s"] for x in selected}))
    (output / "lelabo-discovery.json").write_text(json.dumps(discovery, ensure_ascii=False, indent=2))
    print("Discovered", len(queue), "exact official product pages", flush=True)
    previous_file = output / "lelabo-official.json"
    previous = json.loads(previous_file.read_text())["products"] if previous_file.exists() else []
    cached = {(p["region"], p["requestedUrl"].removeprefix(hosts[p["region"]]+"/")): p for p in previous if p.get("variants")}
    for region in hosts:
        for known in ["hand-lotion-1059.html", "deodorant-1085.html", "another-13-1319.html"]:
            if (region, known) not in queue: queue.append((region, known))
    needed = [pair for pair in queue if pair not in cached]
    results = [cached[pair] for pair in queue if pair in cached] + list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(research, needed))
    (output / "lelabo-official.json").write_text(json.dumps({"checkedAt": checked, "scope": "Actual unauthenticated official GET responses; no live shop or provider writes", "products": results}, ensure_ascii=False, indent=2))
    print("Saved", len(results), "official page results")
