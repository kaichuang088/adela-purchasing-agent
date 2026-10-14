/** Owner-authorized withdrawal, once. Product and financial history are retained. */
export async function applyCatalogR25(db:D1Database){
 const key='adela_catalog_repricing_r25';
 if(await db.prepare('SELECT 1 FROM store_settings WHERE key=?').bind(key).first())return;
 // A single D1 transaction claims the migration and withdraws its current snapshot.
 const token=crypto.randomUUID(),now=new Date().toISOString();
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO store_settings(key,value) VALUES(?,?)').bind(key,token),
  db.prepare("INSERT OR IGNORE INTO store_settings(key,value) SELECT 'adela_catalog_repricing_r25_snapshot',json_group_array(json_object('id',id,'status',status,'priceKrw',price_jpy,'commerce',commerce_json)) FROM products WHERE EXISTS(SELECT 1 FROM store_settings WHERE key=? AND value=?)").bind(key,token),
  db.prepare("UPDATE products SET status='paused',commerce_json=json_set(json_remove(COALESCE(NULLIF(commerce_json,''),'{}'),'$.salePriceTwd','$.serviceFeePercent'),'$.pricingMode','standard_base','$.needsRepricing',json('true'),'$.pricingTaxExclusive',json('false'),'$.variants',json(COALESCE((SELECT json_group_array(json(json_remove(value,'$.salePriceTwd'))) FROM json_each(products.commerce_json,'$.variants')),'[]'))),updated_at=? WHERE EXISTS(SELECT 1 FROM store_settings WHERE key=? AND value=?)").bind(now,key,token),
  db.prepare("INSERT INTO store_settings(key,value) SELECT 'commerce_settings','{}' WHERE NOT EXISTS(SELECT 1 FROM store_settings WHERE key='commerce_settings') ON CONFLICT(key) DO NOTHING"),
  db.prepare("UPDATE store_settings SET value=json_set(value,'$.fees.diamond.catalog',3,'$.fees.diamond.custom',3,'$.pricingMode','standard_base','$.photoQuotesPaused',json('false')) WHERE key='commerce_settings' AND EXISTS(SELECT 1 FROM store_settings WHERE key=? AND value=?)").bind(key,token)
 ]);
}
