import { fetchAdminPlusProducts, fetchAdminPlusToken } from "./adminplus.js";
import { buildLiveCatalog } from "./live-catalog.js";
import {
  applySyncPlan,
  buildSyncPlan,
  buildSyncPreview,
  currentSourceCatalog,
  fetchMappedCafe24Products,
} from "./sync.js";
import { refreshTokens } from "./oauth.js";
import { loadPersistentTokens, savePersistentTokens } from "./token-store.js";

export async function executeProductSync(config, { writeEnabled = false } = {}) {
  const adminPlusToken = await fetchAdminPlusToken();
  const sourceProducts = await fetchAdminPlusProducts(adminPlusToken);
  const catalog = buildLiveCatalog(currentSourceCatalog(), sourceProducts, { writeEnabled });
  let cafe24Tokens = await loadPersistentTokens(config);
  if (!cafe24Tokens?.access_token || !cafe24Tokens?.refresh_token) {
    throw new Error("PERSISTENT_CONNECTION_MISSING");
  }
  let cafe24Products;
  try {
    cafe24Products = await fetchMappedCafe24Products(config, cafe24Tokens.access_token);
  } catch (error) {
    if (error?.status !== 401) throw error;
    cafe24Tokens = { ...cafe24Tokens, ...(await refreshTokens(config, cafe24Tokens.refresh_token)) };
    await savePersistentTokens(config, cafe24Tokens);
    cafe24Products = await fetchMappedCafe24Products(config, cafe24Tokens.access_token);
  }
  const preview = buildSyncPreview(catalog, cafe24Products);
  const plan = buildSyncPlan(catalog, cafe24Products);
  if (!writeEnabled) return { ...preview, planned: plan };
  const applied = await applySyncPlan(config, cafe24Tokens.access_token, plan);
  return {
    ...preview,
    mode: "write",
    write_enabled: true,
    ...applied,
    unmatched_products: plan.unmatched.length,
  };
}
