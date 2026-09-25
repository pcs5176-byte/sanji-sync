import { cafe24AdminRequest, cafe24AdminWriteRequest } from "./cafe24.js";
import { fetchMappedCafe24Products } from "./sync.js";

const IMPORT_GROUPS = new Set(["G0167", "G0168", "G0169", "G0170", "G0171", "G0172"]);

function detailDescription(source) {
  const labels = source.options.map((option) => option.option_label).join(" · ");
  return `<div style="max-width:860px;margin:0 auto;color:#26362f;font-family:'Noto Sans KR',Arial,sans-serif;line-height:1.75">
  <section style="padding:56px 36px;background:#f3f0e7;text-align:center">
    <p style="margin:0 0 12px;font-size:15px;letter-spacing:2px;color:#667c6b">SANJIHANSANG SELECT</p>
    <h1 style="margin:0;font-size:36px;color:#1f4630">${source.family_name}</h1>
    <p style="margin:18px 0 0;font-size:18px">산지에서 엄선해 신선하게 보내드립니다.</p>
  </section>
  <section style="padding:40px 24px">
    <h2 style="font-size:25px;color:#1f4630">상품 핵심정보</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><th style="width:30%;padding:14px;border-bottom:1px solid #dfe7df;text-align:left">상품</th><td style="padding:14px;border-bottom:1px solid #dfe7df">${source.family_name}</td></tr>
      <tr><th style="padding:14px;border-bottom:1px solid #dfe7df;text-align:left">중량 옵션</th><td style="padding:14px;border-bottom:1px solid #dfe7df">${labels}</td></tr>
      <tr><th style="padding:14px;border-bottom:1px solid #dfe7df;text-align:left">출고</th><td style="padding:14px;border-bottom:1px solid #dfe7df">평일 오전 9시 30분 주문 마감 후 순차 출고</td></tr>
      <tr><th style="padding:14px;border-bottom:1px solid #dfe7df;text-align:left">원산지</th><td style="padding:14px;border-bottom:1px solid #dfe7df">국내산</td></tr>
    </table>
  </section>
  <section style="padding:36px 24px;background:#f8faf7">
    <h2 style="font-size:25px;color:#1f4630">참고사항</h2>
    <p>신선식품은 수령 즉시 상태를 확인해 주세요. 자연산물 특성상 모양·크기·색상에는 차이가 있을 수 있습니다. 수령 후 신선도 유지를 위해 냉장 보관을 권장합니다.</p>
    <h3 style="margin-top:28px">구매 전 꼭 확인해 주세요</h3>
    <p>상품 이상 시 포장과 상품 상태가 확인되는 사진을 남겨 수령 직후 고객센터로 접수해 주세요. 단순 변심이나 보관 부주의로 인한 품질 저하는 교환·반품이 제한될 수 있습니다.</p>
  </section>
</div>`;
}

export function buildCreateProductRequest(source) {
  const base = source.options[0];
  return {
    shop_no: 3,
    request: {
      display: "F",
      selling: "F",
      product_condition: "N",
      custom_product_code: source.custom_product_code,
      product_name: source.cafe24_product_name,
      internal_product_name: source.family_name,
      supply_product_name: base.source_product_name,
      model_name: source.custom_product_code,
      supply_price: base.supply_price,
      price: source.expected_sale_price,
      retail_price: source.expected_retail_price,
      has_option: "T",
      options: [{ name: "중량", value: source.options.map((option) => option.option_label) }],
      soldout_message: "품절",
      summary_description: `산지한상에서 엄선한 ${source.family_name}, 산지 정보와 출고 기준을 확인하고 안심 구매하세요.`,
      simple_description: `${source.options.map((option) => option.option_label).join("·")} 중량 옵션 / 산지 직송 신선배송`,
      description: detailDescription(source),
      mobile_description: detailDescription(source),
      product_tag: ["산지한상", "산지직송", ...source.family_name.split(/\s+/).filter(Boolean)],
      tax_type: "B",
      origin_classification: "F",
      shipping_scope: "A",
      shipping_fee_by_product: "F",
      product_shipping_type: "C",
    },
  };
}

function labelOf(variant) {
  return (variant.options || []).map((item) => item.value || item.option_value || item.name || "").filter(Boolean).join("/");
}

export async function importMissingProducts(config, accessToken, catalog) {
  let products = await fetchMappedCafe24Products(config, accessToken);
  const existingCodes = new Set(products.map((product) => String(product.custom_product_code || "")).filter(Boolean));
  const created = [];

  for (const source of catalog.products.filter((product) => IMPORT_GROUPS.has(product.group_id))) {
    if (existingCodes.has(source.custom_product_code)) continue;
    const body = buildCreateProductRequest(source);
    body.shop_no = config.shopNo;
    const response = await cafe24AdminWriteRequest(config, accessToken, "products", "POST", body);
    const productNo = response?.product?.product_no;
    if (!productNo) throw new Error(`CAFE24_PRODUCT_CREATE_RESPONSE_INVALID:${source.group_id}`);

    const detail = await cafe24AdminRequest(config, accessToken, `products/${productNo}`, {
      shop_no: config.shopNo,
      embed: "variants,inventories",
    });
    const variants = detail?.product?.variants || [];
    const byLabel = new Map(variants.map((variant) => [labelOf(variant), variant]));
    const requests = source.options.map((option) => {
      const variant = byLabel.get(option.option_label);
      if (!variant) throw new Error(`CAFE24_VARIANT_CREATE_MISMATCH:${source.group_id}:${option.option_label}`);
      return {
        variant_code: variant.variant_code,
        custom_variant_code: String(option.source_product_code),
        display: "F",
        selling: "F",
        additional_amount: option.expected_sale_price - source.expected_sale_price,
        use_inventory: option.sold_out ? "T" : "F",
        ...(option.sold_out ? { quantity: 0, display_soldout: "T" } : {}),
      };
    });
    await cafe24AdminWriteRequest(config, accessToken, `products/${productNo}/variants`, "PUT", {
      shop_no: config.shopNo,
      requests,
    });
    created.push({ group_id: source.group_id, product_no: productNo, product_code: response.product.product_code });
    existingCodes.add(source.custom_product_code);
  }

  products = await fetchMappedCafe24Products(config, accessToken);
  return { created, products };
}
