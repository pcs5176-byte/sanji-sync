import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveCatalog, roundToEnding900 } from "../lib/live-catalog.js";
import { buildSyncPlan } from "../lib/sync.js";
import { buildCreateProductRequest } from "../lib/import-missing.js";
import { buildDetailProductRequest, buildDetailSeoRequest } from "../lib/detail-update.js";
import { buildProductImageRequest, productCodeFromFilename, uploadedImagePath } from "../lib/image-upload.js";

test("rounds up to the nearest price ending in 900", () => {
  assert.equal(roundToEnding900(24540, 1), 24900);
  assert.equal(roundToEnding900(10000, 1.3), 13900);
});

test("treats a null stock value from AdminPlus as unlimited rather than sold out", () => {
  const template = {
    products: [{
      custom_product_code: "HARU-G0001",
      cafe24_product_name: "산지한상 테스트 상품",
      options: [{ source_product_code: "100", option_label: "기본", expected_sale_price: 10900 }],
    }],
  };
  const live = buildLiveCatalog(template, [{
    product_code: 100,
    name: "테스트",
    price: 10000,
    stock: null,
    status: "active",
  }]);
  assert.equal(live.products[0].options[0].sold_out, false);
});

test("live catalog recalculates prices and treats missing source items as sold out", () => {
  const template = {
    products: [{
      custom_product_code: "HARU-G0001",
      cafe24_product_name: "산지한상 테스트 상품",
      options: [
        { source_product_code: "100", option_label: "3kg", expected_sale_price: 10900 },
        { source_product_code: "101", option_label: "5kg", expected_sale_price: 15900 },
      ],
    }],
  };
  const live = buildLiveCatalog(template, [{
    product_code: 100,
    name: "테스트 3kg",
    price: 12000,
    stock: "unlimited",
    status: "active",
  }]);
  assert.equal(live.products[0].expected_sale_price, 15900);
  assert.equal(live.products[0].expected_retail_price, 21900);
  assert.equal(live.products[0].options[0].sold_out, false);
  assert.equal(live.products[0].options[1].sold_out, true);
});

test("sync plan updates prices, option surcharge and sold-out inventory without publishing", () => {
  const catalog = {
    products: [{
      custom_product_code: "HARU-G0001",
      cafe24_product_name: "산지한상 테스트 상품",
      expected_sale_price: 15900,
      expected_retail_price: 21900,
      sold_out: false,
      options: [
        { source_product_code: "100", option_label: "3kg", expected_sale_price: 15900, sold_out: false },
        { source_product_code: "101", option_label: "5kg", expected_sale_price: 23900, sold_out: true },
      ],
    }],
  };
  const plan = buildSyncPlan(catalog, [{
    product_no: 7,
    custom_product_code: "HARU-G0001",
    price: "14900",
    retail_price: "20900",
    display: "F",
    selling: "F",
    variants: [
      { variant_code: "P0000001000A", custom_variant_code: "100", options: [{ value: "3kg" }], additional_amount: 0, use_inventory: "F" },
      { variant_code: "P0000001000B", options: [{ value: "5kg" }], additional_amount: 7000, use_inventory: "F", quantity: 3 },
    ],
  }]);
  assert.deepEqual(plan.productUpdates[0].request, { price: 15900, retail_price: 21900 });
  assert.equal(plan.variantUpdates[0].requests[0].variant_code, "P0000001000B");
  assert.equal(plan.variantUpdates[0].requests[0].additional_amount, 8000);
  assert.equal(plan.variantUpdates[0].requests[0].use_inventory, "T");
  assert.equal(plan.variantUpdates[0].requests[0].quantity, 0);
  assert.equal("selling" in plan.productUpdates[0].request, false);
});

test("legacy product code links the existing chestnut item and normalizes its identifiers", () => {
  const catalog = { products: [{
    group_id: "G0156",
    legacy_product_code: "P00000CF",
    custom_product_code: "HARU-G0156",
    cafe24_product_name: "산지한상 산지직송 국내산 햇밤 중과 신선배송",
    expected_sale_price: 8900,
    expected_retail_price: 11900,
    options: [{ source_product_code: "10001738", option_label: "1kg", expected_sale_price: 8900, sold_out: false }],
  }] };
  const plan = buildSyncPlan(catalog, [{
    product_no: 57,
    product_code: "P00000CF",
    custom_product_code: "",
    model_name: "HARU-CHESTNUT-M",
    product_name: "산지직송 국내산 부여 햇밤 중과 알밤",
    price: 8900,
    retail_price: 11900,
    variants: [{ variant_code: "P00000CF000A", options: [{ value: "1kg" }], additional_amount: 0, use_inventory: "F" }],
  }]);
  assert.equal(plan.unmatched.length, 0);
  assert.equal(plan.productUpdates[0].request.custom_product_code, "HARU-G0156");
  assert.equal(plan.productUpdates[0].request.model_name, "HARU-G0156");
  assert.equal(plan.variantUpdates[0].requests[0].custom_variant_code, "10001738");
});

test("new product request is hidden and preserves price and weight options", () => {
  const body = buildCreateProductRequest({
    family_name: "햇감자 소",
    cafe24_product_name: "산지한상 산지직송 엄선 햇감자 소 신선 안심배송",
    custom_product_code: "HARU-G0169",
    expected_sale_price: 5900,
    expected_retail_price: 7900,
    options: [
      { source_product_code: "1", source_product_name: "햇감자 소 3kg", option_label: "3kg", supply_price: 4500, expected_sale_price: 5900 },
      { source_product_code: "2", source_product_name: "햇감자 소 5kg", option_label: "5kg", supply_price: 5800, expected_sale_price: 7900 },
    ],
  });
  assert.equal(body.request.display, "F");
  assert.equal(body.request.selling, "F");
  assert.equal(body.request.price, 5900);
  assert.equal(body.request.retail_price, 7900);
  assert.deepEqual(body.request.options[0].value, ["3kg", "5kg"]);
});

test("detail update remains hidden and does not alter price or options", () => {
  const item = {
    summary: "요약",
    simple: "간략",
    detail: "<p>상세</p>",
    tags: "산지한상,산지직송",
    shipping: "배송안내",
    exchange: "교환안내",
    meta_description: "메타 설명",
    meta_keywords: "산지한상,산지직송",
  };
  const product = buildDetailProductRequest(item);
  assert.equal(product.display, "F");
  assert.equal(product.selling, "F");
  assert.equal("price" in product, false);
  assert.equal("retail_price" in product, false);
  assert.equal("options" in product, false);
  assert.deepEqual(product.product_tag, ["산지한상", "산지직송"]);
  const seo = buildDetailSeoRequest(item, "산지한상 테스트 상품");
  assert.equal(seo.search_engine_exposure, "F");
  assert.equal(seo.meta_title, "산지한상 테스트 상품");
});

test("thumbnail filename maps to a product and builds representative image registration", () => {
  assert.equal(productCodeFromFilename("HARU-G0004_양파_v1.png"), "HARU-G0004");
  assert.equal(productCodeFromFilename("no-code.png"), null);
  assert.equal(uploadedImagePath({ images: [{ path: "/web/product/big/onion.png" }] }), "/web/product/big/onion.png");
  assert.deepEqual(buildProductImageRequest("/web/product/big/onion.png"), {
    image_upload_type: "A",
    detail_image: "/web/product/big/onion.png",
  });
});
