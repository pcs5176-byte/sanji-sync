import detailUpdates from "../data/detail-updates.json" with { type: "json" };
import { cafe24AdminWriteRequest } from "./cafe24.js";
import { fetchMappedCafe24Products } from "./sync.js";

function tags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function buildDetailProductRequest(item) {
  return {
    display: "F",
    selling: "F",
    summary_description: item.summary,
    simple_description: item.simple,
    description: item.detail,
    mobile_description: item.detail,
    product_tag: tags(item.tags),
    shipping_info: item.shipping,
    exchange_info: item.exchange,
  };
}

export function buildDetailSeoRequest(item, productName) {
  return {
    meta_title: productName,
    meta_author: "산지한상",
    meta_description: item.meta_description,
    meta_keywords: item.meta_keywords,
    search_engine_exposure: "F",
  };
}

export async function applyDetailBatch(config, accessToken, { fromProductNo = 102, limit = 25 } = {}) {
  const start = Math.max(1, Number(fromProductNo) || 102);
  const size = Math.min(25, Math.max(1, Number(limit) || 25));
  const products = await fetchMappedCafe24Products(config, accessToken);
  const byProductNo = new Map(products.map((product) => [Number(product.product_no), product]));
  const batch = detailUpdates
    .filter((item) => Number(item.product_no) >= start)
    .sort((a, b) => Number(a.product_no) - Number(b.product_no))
    .slice(0, size);

  const updated = [];
  const skipped = [];
  for (const item of batch) {
    const product = byProductNo.get(Number(item.product_no));
    if (!product || String(product.product_code || "") !== String(item.product_code)) {
      skipped.push({ product_no: item.product_no, product_code: item.product_code, reason: "product_code_mismatch" });
      continue;
    }

    await cafe24AdminWriteRequest(config, accessToken, `products/${item.product_no}`, "PUT", {
      shop_no: config.shopNo,
      request: buildDetailProductRequest(item),
    });
    await cafe24AdminWriteRequest(config, accessToken, `products/${item.product_no}/seo`, "PUT", {
      shop_no: config.shopNo,
      request: buildDetailSeoRequest(item, product.product_name),
    });
    updated.push({ product_no: item.product_no, product_code: item.product_code });
  }

  return {
    requested: batch.length,
    updated,
    skipped,
    next_product_no: updated.length ? Number(updated.at(-1).product_no) + 1 : start,
  };
}
