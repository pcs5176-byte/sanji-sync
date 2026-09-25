import { getConfig } from "../../lib/config.js";
import { methodNotAllowed, noStore, parseCookies } from "../../lib/http.js";
import { openTokens } from "../../lib/oauth.js";
import { executeProductSync } from "../../lib/sync-runner.js";
import { importMissingProducts } from "../../lib/import-missing.js";
import { applyDetailBatch } from "../../lib/detail-update.js";
import { currentSourceCatalog, fetchMappedCafe24Products } from "../../lib/sync.js";
import { loadPersistentTokens, savePersistentTokens } from "../../lib/token-store.js";
import { uploadProductThumbnail } from "../../lib/image-upload.js";
import { refreshTokens } from "../../lib/oauth.js";
import { cafe24AdminWriteRequest } from "../../lib/cafe24.js";
import { automationRequestAuthorized } from "../../lib/automation-auth.js";
import { withPersistentCafe24Token } from "../../lib/persistent-cafe24.js";

const HOSTED_THUMBNAILS = new Set([
  "HARU-G0001_참외가정용소과_v1.png",
  "HARU-G0002_참외가정용중과_v1.png",
  "HARU-G0003_참외가정용대과_v1.png",
  "HARU-G0004_양파_v1.png",
  "HARU-G0156_국산햇밤중_v1.png",
  "HARU-G0157_국산햇밤대_v2.png",
  "HARU-G0158_국산햇밤특_v1.png",
  "HARU-G0159_한우선물세트_v1.png",
  "HARU-G0160_못난이흙당근_v1.png",
  "HARU-G0161_왕특흙당근_v1.png",
  "HARU-G0162_추희자두중과_v1.png",
  "HARU-G0163_추희자두대과_v1.png",
  "HARU-G0164_추희자두특_v1.png",
  "HARU-G0165_흰다리새우_v1.png",
  "HARU-G0166_활숫꽃게1kg_v1.png",
  "HARU-G0167_오미자생과_v1.png",
  "HARU-G0168_애플망고_v1.png",
  "HARU-G0169_햇감자소_v1.png",
  "HARU-G0170_햇감자중소_v1.png",
  "HARU-G0171_햇감자중대_v1.png",
  "HARU-G0172_햇감자특_v1.png",
  "HARU-G0005_쥬스용사과_v1.png",
  "HARU-G0006_피호두_v1.png",
  "HARU-G0007_유러피언샐러드_v1.png",
  "HARU-G0008_그린망고_v1.png",
  "HARU-G0009_서리태_v1.png",
  "HARU-G0010_쥐눈이콩_v1.png",
  "HARU-G0011_메주콩_v1.png",
  "HARU-G0012_통녹두_v1.png",
  "HARU-G0013_팥_v1.png",
  "HARU-G0014_안동마가정용_v1.png",
  "HARU-G0015_옥광밤대과_v1.png",
  "HARU-G0016_깐옥광밤대과_v1.png",
  "HARU-G0017_알밤대과_v1.png",
  "HARU-G0018_알밤특과_v1.png",
  "HARU-G0019_칼집밤대과_v1.png",
  "HARU-G0020_깐밤중과_v1.png",
  "HARU-G0021_깐밤대과_v1.png",
  "HARU-G0022_깐밤특과_v1.png",
  "HARU-G0023_깐밤조각밤_v1.png",
  "HARU-G0024_세척사과_v1.png",
  "HARU-G0025_산양삼2등품5-6년산_v1.png",
  "HARU-G0026_산양삼2등품7-8년산_v1.png",
  "HARU-G0027_산양삼특품7-8년산_v1.png",
  "HARU-G0028_산양삼특품8-10년산_v1.png",
  "HARU-G0029_산양삼특품12-15년산_v1.png",
  "HARU-G0030_냉동아로니아줄기제거특품_v1.png",
  "HARU-G0031_냉동아로니아최상품_v1.png",
  "HARU-G0032_냉동포포열매소과_v1.png",
  "HARU-G0033_냉동포포열매중과_v1.png",
  "HARU-G0034_냉동포포열매대과_v1.png",
  "HARU-G0035_생알땅콩_v1.png",
  "HARU-G0036_스테비아방울토마토_v1.png",
  "HARU-G0037_대추방울토마토특품_v1.png",
  "HARU-G0038_냉동잭푸르트_v1.png",
  "HARU-G0039_과상2호오디특품_v1.png",
  "HARU-G0040_냉동토종복분자특품_v1.png",
  "HARU-G0041_삼겹살_v1.png",
  "HARU-G0042_오겹살_v1.png",
  "HARU-G0043_목살_v1.png",
  "HARU-G0044_항정살_v1.png",
  "HARU-G0045_가브리살_v1.png",
  "HARU-G0046_냉동낙엽살_v1.png",
  "HARU-G0047_B곶감호두말이20구선물세트_v1.png",
  "HARU-G0048_B곶감호두말이30구선물세트_v1.png",
  "HARU-G0049_곶감선물용건시_v1.png",
  "HARU-G0050_영광굴비장줄20미1.2_v1.png",
  "HARU-G0051_영광굴비장줄20미1.6_v1.png",
  "HARU-G0052_영광굴비오가10미1.0_v1.png",
  "HARU-G0053_영광굴비오가10미1.3_v1.png",
  "HARU-G0054_꿀2병선물세트_v1.png",
  "HARU-G0055_영동반건시곶감선물세트_v1.png",
  "HARU-G0056_사과9구선물세트_v1.png",
  "HARU-G0057_초롱무_v1.png",
  "HARU-G0058_특가참외_v1.png",
  "HARU-G0059_다진청양고추_v1.png",
  "HARU-G0060_아보카도대과_v1.png",
  "HARU-G0061_용과_v1.png",
  "HARU-G0062_레드자몽특대과_v1.png",
  "HARU-G0063_레드자몽중대과_v1.png",
  "HARU-G0064_애플망고_v1.png",
  "HARU-G0065_국산들깨가루1통250g_v1.png",
  "HARU-G0066_특가참외혼합과_v1.png",
  "HARU-G0067_제스프리골드키위특대과18입선물세트_v1.png",
  "HARU-G0068_제스프리골드키위특대과20입선물세트_v1.png",
  "HARU-G0069_낱발바나나_v1.png",
  "HARU-G0070_파인애플_v1.png",
  "HARU-G0071_특가스테비아방울토마토_v1.png",
  "HARU-G0072_제주애플망고꼬마과_v1.png",
  "HARU-G0073_냉동팩두리안_v1.png",
  "HARU-G0074_냉동깐완두콩_v1.png",
  "HARU-G0075_감자왕특_v1.png",
  "HARU-G0076_노지자두_v1.png",
  "HARU-G0077_미백찰옥수수상품_v1.png",
  "HARU-G0078_미백찰옥수수특품_v1.png",
  "HARU-G0079_제스프리그린키위_v1.png",
  "HARU-G0080_오렌지소과_v1.png",
  "HARU-G0081_오렌지중대과_v1.png",
  "HARU-G0082_오렌지대과_v1.png",
  "HARU-G0083_오렌지특대과_v1.png",
  "HARU-G0084_하우스감귤대과_v1.png",
  "HARU-G0085_샤인머스켓_v1.png",
  "HARU-G0086_레몬특대과_v1.png",
  "HARU-G0087_레몬대과_v1.png",
  "HARU-G0088_레몬중소과_v1.png",
  "HARU-G0089_생체리_v1.png",
  "HARU-G0090_홍무화과_v1.png",
  "HARU-G0091_딱딱이복숭아_v1.png",
  "HARU-G0092_히카마_v1.png",
  "HARU-G0093_청귤_v1.png",
  "HARU-G0094_거반도_v1.png",
  "HARU-G0095_루비에스_v1.png",
  "HARU-G0096_홍로사과가정용소과_v1.png",
  "HARU-G0097_홍로사과가정용중소과_v1.png",
  "HARU-G0098_홍로사과가정용중대과_v1.png",
  "HARU-G0099_홍로사과가정용중과_v1.png",
  "HARU-G0100_홍로사과가정용대과_v1.png",
  "HARU-G0101_홍로사과못난이_v1.png",
  "HARU-G0102_황도복숭아_v1.png",
  "HARU-G0103_표고버섯정품_v1.png",
  "HARU-G0104_꽈리고추정품_v1.png",
  "HARU-G0105_모닝고추정품_v1.png",
  "HARU-G0106_청양고추정품_v1.png",
  "HARU-G0107_오이고추정품_v1.png",
  "HARU-G0108_천도복숭아소과_v1.png",
  "HARU-G0109_프리미엄사과9구선물세트_v1.png",
  "HARU-G0110_프리미엄사과배선물세트_v1.png",
  "HARU-G0111_프리미엄사과배샤인선물세트_v1.png",
  "HARU-G0112_홍옥사과_v1.png",
  "HARU-G0113_사과배선물세트_v1.png",
  "HARU-G0114_배9구선물세트_v1.png",
  "HARU-G0115_황금향선물용_v1.png",
  "HARU-G0116_추희자두_v1.png",
  "HARU-G0117_한입꿀고구마_v1.png",
  "HARU-G0118_한입밤고구마_v1.png",
  "HARU-G0119_청송사과선물세트_v1.png",
  "HARU-G0120_사과3배3선물세트_v1.png",
  "HARU-G0121_대봉곶감24구선물세트_v1.png",
  "HARU-G0122_투뿔한우특수부위선물세트_v1.png",
  "HARU-G0123_사과대추중_v1.png",
  "HARU-G0124_사과대추특_v1.png",
  "HARU-G0125_백도말랑이복숭아_v1.png",
  "HARU-G0126_제스프리썬골드키위중대과_v1.png",
]);

async function hostedThumbnailDataUrl(config, filename) {
  if (!HOSTED_THUMBNAILS.has(filename)) throw new Error("HOSTED_THUMBNAIL_NOT_ALLOWED");
  const response = await fetch(
    new URL(`/assets/thumbnails/${encodeURIComponent(filename)}`, config.appUrl),
  );
  if (!response.ok) throw new Error("HOSTED_THUMBNAIL_FETCH_FAILED");
  const contentType = response.headers.get("content-type") || "image/png";
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${data}`;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const config = getConfig(req);
    const automationAction = req.body?.action;
    if (automationAction === "automation_image_upload" || automationAction === "automation_publish_detail" || automationAction === "automation_rename_product") {
      if (!automationRequestAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
      if (process.env.SYNC_WRITE_ENABLED !== "true") {
        return res.status(409).json({ error: "sync_write_disabled" });
      }

      if (automationAction === "automation_image_upload") {
        const filename = typeof req.body?.filename === "string" ? req.body.filename : "";
        const image = typeof req.body?.image === "string" ? req.body.image : "";
        if (!filename || !image) return res.status(400).json({ error: "filename_and_image_required" });
        const uploaded = await withPersistentCafe24Token(config, (accessToken) =>
          uploadProductThumbnail(config, accessToken, { filename, image }),
        );
        return res.status(200).json({ uploaded });
      }

      const productNo = Number(req.body?.product_no);
      const customProductCode = String(req.body?.custom_product_code || "").toUpperCase();
      if (automationAction === "automation_rename_product") {
        const productName = typeof req.body?.product_name === "string" ? req.body.product_name.trim() : "";
        if (!Number.isInteger(productNo) || productNo < 1 || !customProductCode || !productName) {
          return res.status(400).json({ error: "product_and_name_required" });
        }
        const renamed = await withPersistentCafe24Token(config, async (accessToken) => {
          const products = await fetchMappedCafe24Products(config, accessToken);
          const product = products.find((item) => Number(item.product_no) === productNo);
          if (!product || String(product.custom_product_code || "").toUpperCase() !== customProductCode) {
            const error = new Error("PRODUCT_CODE_MISMATCH");
            error.status = 400;
            throw error;
          }
          await cafe24AdminWriteRequest(config, accessToken, `products/${productNo}`, "PUT", {
            shop_no: config.shopNo,
            request: { product_name: productName },
          });
          return { product_no: productNo, custom_product_code: customProductCode, product_name: productName };
        });
        return res.status(200).json({ renamed });
      }

      const description = typeof req.body?.description === "string" ? req.body.description : "";
      const mobileDescription = typeof req.body?.mobile_description === "string"
        ? req.body.mobile_description
        : description;
      if (!Number.isInteger(productNo) || productNo < 1 || !customProductCode || !description) {
        return res.status(400).json({ error: "product_and_description_required" });
      }
      const published = await withPersistentCafe24Token(config, async (accessToken) => {
        const products = await fetchMappedCafe24Products(config, accessToken);
        const product = products.find((item) => Number(item.product_no) === productNo);
        if (!product || String(product.custom_product_code || "").toUpperCase() !== customProductCode) {
          const error = new Error("PRODUCT_CODE_MISMATCH");
          error.status = 400;
          throw error;
        }
        await cafe24AdminWriteRequest(config, accessToken, `products/${productNo}`, "PUT", {
          shop_no: config.shopNo,
          request: { description, mobile_description: mobileDescription },
        });
        return { product_no: productNo, product_code: product.product_code, custom_product_code: customProductCode };
      });
      return res.status(200).json({ published });
    }

    const browserSession = parseCookies(req).sanji_cafe24_tokens;
    if (!browserSession) return res.status(401).json({ error: "not_connected" });
    openTokens(browserSession, config.encryptionKey);
    if (process.env.SYNC_WRITE_ENABLED !== "true") {
      return res.status(409).json({ error: "sync_write_disabled" });
    }
    if (req.body?.action === "import_missing") {
      const tokens = await loadPersistentTokens(config);
      if (!tokens?.access_token) return res.status(401).json({ error: "persistent_connection_missing" });
      const result = await importMissingProducts(config, tokens.access_token, currentSourceCatalog());
      return res.status(200).json({ created_products: result.created.length, created: result.created });
    }
    if (req.body?.action === "detail_batch") {
      const tokens = await loadPersistentTokens(config);
      if (!tokens?.access_token) return res.status(401).json({ error: "persistent_connection_missing" });
      const result = await applyDetailBatch(config, tokens.access_token, {
        fromProductNo: req.body?.from_product_no,
        limit: req.body?.limit,
      });
      return res.status(200).json({
        updated_products: result.updated.length,
        skipped_products: result.skipped.length,
        next_product_no: result.next_product_no,
        updated: result.updated,
        skipped: result.skipped,
      });
    }
    if (req.body?.action === "image_upload" || req.body?.action === "hosted_image_upload") {
      let tokens = await loadPersistentTokens(config);
      if (!tokens?.access_token || !tokens?.refresh_token) {
        return res.status(401).json({ error: "persistent_connection_missing" });
      }
      const filename = req.body?.filename;
      const image = req.body?.action === "hosted_image_upload"
        ? await hostedThumbnailDataUrl(config, filename)
        : req.body?.image;
      let result;
      try {
        result = await uploadProductThumbnail(config, tokens.access_token, {
          filename,
          image,
        });
      } catch (error) {
        if (error?.status !== 401) throw error;
        tokens = { ...tokens, ...(await refreshTokens(config, tokens.refresh_token)) };
        await savePersistentTokens(config, tokens);
        result = await uploadProductThumbnail(config, tokens.access_token, {
          filename,
          image,
        });
      }
      return res.status(200).json({ uploaded: result });
    }
    const result = await executeProductSync(config, { writeEnabled: true });
    return res.status(200).json(result);
  } catch {
    return res.status(502).json({ error: "product_sync_failed" });
  }
}
