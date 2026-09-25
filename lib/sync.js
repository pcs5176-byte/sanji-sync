import sourceCatalog from "../data/source-catalog.json" with { type: "json" };
import { cafe24AdminRequest, cafe24AdminWriteRequest } from "./cafe24.js";

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
}

function variantLabel(variant) {
  if (!Array.isArray(variant?.options)) return "";
  return variant.options
    .map((option) => option?.value ?? option?.option_value ?? option?.name ?? "")
    .filter(Boolean)
    .join("/");
}

export function currentSourceCatalog() {
  return sourceCatalog;
}

export async function fetchMappedCafe24Products(config, accessToken) {
  const products = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const payload = await cafe24AdminRequest(config, accessToken, "products", {
      shop_no: config.shopNo,
      limit,
      offset,
      embed: "variants,inventories",
    });
    const page = Array.isArray(payload?.products) ? payload.products : [];
    products.push(...page);
    if (page.length < limit) break;
  }
  return products;
}

function findTargetProduct(source, indexes) {
  return (
    indexes.byCustomCode.get(source.custom_product_code) ||
    indexes.byModelName.get(source.custom_product_code) ||
    indexes.byProductName.get(source.cafe24_product_name) ||
    (source.legacy_product_code ? indexes.byProductCode.get(source.legacy_product_code) : undefined)
  );
}

function indexCafe24Products(cafe24Products) {
  const byCustomCode = new Map();
  const byModelName = new Map();
  const byProductName = new Map();
  const byProductCode = new Map();
  for (const product of cafe24Products) {
    if (product?.custom_product_code) byCustomCode.set(String(product.custom_product_code), product);
    if (product?.model_name) byModelName.set(String(product.model_name), product);
    if (product?.product_name) byProductName.set(String(product.product_name), product);
    if (product?.product_code) byProductCode.set(String(product.product_code), product);
  }
  return { byCustomCode, byModelName, byProductName, byProductCode };
}

export function buildSyncPreview(catalog, cafe24Products) {
  const indexes = indexCafe24Products(cafe24Products);

  const changes = [];
  const unmatched = [];
  const unmatchedOptionSamples = [];
  let matchedProducts = 0;
  let matchedOptions = 0;
  let unmatchedOptions = 0;
  let salePriceChanges = 0;
  let retailPriceChanges = 0;
  let optionPriceChanges = 0;
  let soldOutChanges = 0;

  for (const source of catalog.products) {
    const target = findTargetProduct(source, indexes);
    if (!target) {
      unmatched.push({
        group_id: source.group_id,
        custom_product_code: source.custom_product_code,
        product_name: source.cafe24_product_name,
      });
      continue;
    }
    matchedProducts += 1;

    const currentSalePrice = numeric(target.price);
    const currentRetailPrice = numeric(target.retail_price);
    const saleChanged = currentSalePrice !== source.expected_sale_price;
    const retailChanged = currentRetailPrice !== source.expected_retail_price;
    salePriceChanges += saleChanged ? 1 : 0;
    retailPriceChanges += retailChanged ? 1 : 0;

    const variants = Array.isArray(target.variants) ? target.variants : [];
    const variantsByLabel = new Map(
      variants.map((variant) => [normalizeLabel(variantLabel(variant)), variant]).filter(([label]) => label),
    );
    const variantsByCustomCode = new Map(
      variants
        .map((variant) => [String(variant?.custom_variant_code || ""), variant])
        .filter(([code]) => code),
    );
    const optionChanges = [];
    for (const option of source.options) {
      const variant =
        variantsByCustomCode.get(String(option.source_product_code)) ||
        variantsByLabel.get(normalizeLabel(option.option_label));
      if (!variant) {
        // Cafe24 can store a one-option source product as a plain product without
        // a named variant. Its price is already checked at the product level.
        if (source.options.length === 1 && option.expected_sale_price === source.expected_sale_price) {
          matchedOptions += 1;
          continue;
        }
        unmatchedOptions += 1;
        if (unmatchedOptionSamples.length < 20) {
          unmatchedOptionSamples.push({
            product_name: target.product_name,
            source_option: option.option_label,
            cafe24_options: [...variantsByLabel.keys()].slice(0, 10),
          });
        }
        continue;
      }
      matchedOptions += 1;
      const expectedAdditionalAmount = option.expected_sale_price - source.expected_sale_price;
      const currentAdditionalAmount = numeric(variant.additional_amount);
      const currentSoldOut =
        variant.use_inventory === "T" && numeric(variant.quantity ?? variant?.inventories?.quantity) <= 0;
      if (currentSoldOut !== Boolean(option.sold_out)) soldOutChanges += 1;
      if (currentAdditionalAmount !== expectedAdditionalAmount) {
        optionPriceChanges += 1;
        optionChanges.push({
          option_label: option.option_label,
          current_additional_amount: currentAdditionalAmount,
          expected_additional_amount: expectedAdditionalAmount,
        });
      }
    }

    if (saleChanged || retailChanged || optionChanges.length) {
      changes.push({
        group_id: source.group_id,
        custom_product_code: source.custom_product_code,
        product_no: target.product_no,
        product_code: target.product_code,
        product_name: target.product_name,
        current_sale_price: currentSalePrice,
        expected_sale_price: source.expected_sale_price,
        current_retail_price: currentRetailPrice,
        expected_retail_price: source.expected_retail_price,
        option_price_changes: optionChanges.slice(0, 10),
      });
    }
  }

  return {
    mode: "dry_run",
    source_live: Boolean(catalog.live_source_connected),
    write_enabled: Boolean(catalog.write_enabled),
    source_as_of: catalog.source_file_modified_at,
    source_products: catalog.product_count,
    source_options: catalog.option_count,
    cafe24_products_received: cafe24Products.length,
    matched_products: matchedProducts,
    unmatched_products: unmatched.length,
    matched_options: matchedOptions,
    unmatched_options: unmatchedOptions,
    sale_price_changes: salePriceChanges,
    retail_price_changes: retailPriceChanges,
    option_price_changes: optionPriceChanges,
    sold_out_changes: soldOutChanges,
    unmapped_source_count: catalog.unmapped_source_count || 0,
    unmapped_source_samples: catalog.unmapped_source_samples || [],
    change_samples: changes.slice(0, 20),
    unmatched_samples: unmatched.slice(0, 20),
    unmatched_option_samples: unmatchedOptionSamples,
  };
}

export function buildSyncPlan(catalog, cafe24Products) {
  const indexes = indexCafe24Products(cafe24Products);

  const productUpdates = [];
  const variantUpdates = [];
  const unmatched = [];
  for (const source of catalog.products) {
    const target = findTargetProduct(source, indexes);
    if (!target) {
      unmatched.push(source.custom_product_code);
      continue;
    }
    const request = {};
    const matchedByLegacyCode =
      source.legacy_product_code && String(target.product_code || "") === String(source.legacy_product_code);
    if (matchedByLegacyCode) {
      if (String(target.custom_product_code || "") !== String(source.custom_product_code)) {
        request.custom_product_code = source.custom_product_code;
      }
      if (String(target.model_name || "") !== String(source.custom_product_code)) {
        request.model_name = source.custom_product_code;
      }
      if (String(target.product_name || "") !== String(source.cafe24_product_name)) {
        request.product_name = source.cafe24_product_name;
      }
    }
    if (numeric(target.price) !== source.expected_sale_price) request.price = source.expected_sale_price;
    if (numeric(target.retail_price) !== source.expected_retail_price) {
      request.retail_price = source.expected_retail_price;
    }
    if (source.sold_out && target.selling !== "F") request.selling = "F";
    if (Object.keys(request).length) {
      productUpdates.push({ product_no: target.product_no, request });
    }

    const variants = Array.isArray(target.variants) ? target.variants : [];
    const byLabel = new Map(
      variants.map((variant) => [normalizeLabel(variantLabel(variant)), variant]).filter(([label]) => label),
    );
    const bySourceCode = new Map(
      variants
        .map((variant) => [String(variant?.custom_variant_code || ""), variant])
        .filter(([code]) => code),
    );
    const requests = [];
    for (const option of source.options) {
      const variant =
        bySourceCode.get(String(option.source_product_code)) ||
        byLabel.get(normalizeLabel(option.option_label));
      if (!variant) continue;
      const expectedAdditional = option.expected_sale_price - source.expected_sale_price;
      const update = { variant_code: variant.variant_code };
      if (numeric(variant.additional_amount) !== expectedAdditional) {
        update.additional_amount = expectedAdditional;
      }
      if (String(variant.custom_variant_code || "") !== String(option.source_product_code)) {
        update.custom_variant_code = String(option.source_product_code);
      }
      const currentQuantity = numeric(variant.quantity ?? variant?.inventories?.quantity);
      const expectedUseInventory = option.sold_out ? "T" : "F";
      if (variant.use_inventory !== expectedUseInventory) update.use_inventory = expectedUseInventory;
      if (option.sold_out && currentQuantity !== 0) update.quantity = 0;
      if (option.sold_out && variant.display_soldout !== "T") update.display_soldout = "T";
      if (Object.keys(update).length > 1) requests.push(update);
    }
    if (requests.length) variantUpdates.push({ product_no: target.product_no, requests });
  }
  return { productUpdates, variantUpdates, unmatched };
}

export async function applySyncPlan(config, accessToken, plan) {
  let productsUpdated = 0;
  let variantsUpdated = 0;
  for (const update of plan.productUpdates) {
    await cafe24AdminWriteRequest(
      config,
      accessToken,
      `products/${update.product_no}`,
      "PUT",
      { shop_no: config.shopNo, request: update.request },
    );
    productsUpdated += 1;
  }
  for (const update of plan.variantUpdates) {
    await cafe24AdminWriteRequest(
      config,
      accessToken,
      `products/${update.product_no}/variants`,
      "PUT",
      { shop_no: config.shopNo, requests: update.requests },
    );
    variantsUpdated += update.requests.length;
  }
  return { products_updated: productsUpdated, variants_updated: variantsUpdated };
}
