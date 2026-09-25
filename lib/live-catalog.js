function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function roundToEnding900(value, factor) {
  const minimum = numeric(value) * factor;
  if (!Number.isFinite(minimum)) throw new Error("INVALID_PRICE");
  return Math.max(900, Math.ceil((minimum - 900) / 1000) * 1000 + 900);
}

function normalizeLabel(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function soldOut(stock, status = "active") {
  if (status !== "active") return true;
  if (String(stock).toLowerCase() === "soldout") return true;
  const quantity = numeric(stock);
  return quantity !== null && quantity <= 0;
}

function sourceRows(products) {
  const rows = [];
  for (const product of products) {
    const base = {
      source_product_code: String(product?.product_code ?? ""),
      source_product_name: String(product?.name ?? ""),
      supply_price: numeric(product?.price),
      status: String(product?.status || "active").toLowerCase(),
      stock: product?.stock,
    };
    const options = Array.isArray(product?.option) ? product.option : [];
    rows.push({
      ...base,
      option_rows: options.map((option) => ({
        option_label: String(option?.option_name ?? ""),
        stock: option?.stock,
      })),
    });
  }
  return rows.filter((row) => row.source_product_code && row.supply_price !== null);
}

export function buildLiveCatalog(template, adminPlusProducts, { writeEnabled = false } = {}) {
  const rows = sourceRows(adminPlusProducts);
  const byCode = new Map(rows.map((row) => [row.source_product_code, row]));
  const usedCodes = new Set();
  const products = template.products.map((product) => {
    const options = product.options.map((option) => {
      const row = byCode.get(String(option.source_product_code));
      if (!row) return { ...option, sold_out: true, source_missing: true };
      usedCodes.add(row.source_product_code);
      const nested = row.option_rows.find(
        (candidate) => normalizeLabel(candidate.option_label) === normalizeLabel(option.option_label),
      );
      const supplyPrice = row.supply_price;
      return {
        ...option,
        source_product_name: row.source_product_name || option.source_product_name,
        supply_price: supplyPrice,
        expected_sale_price: roundToEnding900(supplyPrice, 1.3),
        sold_out: soldOut(nested?.stock ?? row.stock, row.status),
        source_missing: false,
      };
    });
    const expectedSalePrice = Math.min(...options.map((option) => option.expected_sale_price));
    return {
      ...product,
      options,
      expected_sale_price: expectedSalePrice,
      expected_retail_price: roundToEnding900(expectedSalePrice, 1.33),
      sold_out: options.every((option) => option.sold_out),
    };
  });
  const unmapped = rows.filter((row) => !usedCodes.has(row.source_product_code));
  return {
    ...template,
    live_source_connected: true,
    write_enabled: Boolean(writeEnabled),
    generated_at: new Date().toISOString(),
    source_file_modified_at: new Date().toISOString(),
    product_count: products.length,
    option_count: products.reduce((total, product) => total + product.options.length, 0),
    products,
    unmapped_source_count: unmapped.length,
    unmapped_source_samples: unmapped.slice(0, 20).map((row) => ({
      source_product_code: row.source_product_code,
      source_product_name: row.source_product_name,
    })),
  };
}
