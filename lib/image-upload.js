import { cafe24AdminWriteRequest } from "./cafe24.js";
import { fetchMappedCafe24Products } from "./sync.js";

const CODE_PATTERN = /HARU-G\d{4}/i;
const IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,/i;

export function productCodeFromFilename(filename) {
  return String(filename || "").match(CODE_PATTERN)?.[0]?.toUpperCase() || null;
}

export function uploadedImagePath(response) {
  return response?.images?.[0]?.path || response?.image?.path || response?.path || null;
}

export function buildProductImageRequest(path) {
  return {
    image_upload_type: "A",
    detail_image: path,
  };
}

export async function uploadProductThumbnail(config, accessToken, { filename, image }) {
  const customProductCode = productCodeFromFilename(filename);
  if (!customProductCode) throw new Error("THUMBNAIL_FILENAME_CODE_MISSING");
  if (!IMAGE_PATTERN.test(String(image || ""))) throw new Error("THUMBNAIL_IMAGE_INVALID");

  const products = await fetchMappedCafe24Products(config, accessToken);
  const product = products.find(
    (item) => String(item.custom_product_code || "").toUpperCase() === customProductCode,
  );
  if (!product) throw new Error(`THUMBNAIL_PRODUCT_NOT_FOUND:${customProductCode}`);

  const uploaded = await cafe24AdminWriteRequest(config, accessToken, "products/images", "POST", {
    shop_no: config.shopNo,
    requests: [{ image }],
  });
  const path = uploadedImagePath(uploaded);
  if (!path) throw new Error("THUMBNAIL_UPLOAD_RESPONSE_INVALID");

  await cafe24AdminWriteRequest(config, accessToken, `products/${product.product_no}/images`, "POST", {
    shop_no: config.shopNo,
    request: buildProductImageRequest(path),
  });

  return {
    custom_product_code: customProductCode,
    product_no: Number(product.product_no),
    product_code: product.product_code,
    path,
  };
}
