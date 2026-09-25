import { loadPersistentTokens, savePersistentTokens } from "./token-store.js";
import { refreshTokens } from "./oauth.js";

export async function withPersistentCafe24Token(config, work) {
  let tokens = await loadPersistentTokens(config);
  if (!tokens?.access_token || !tokens?.refresh_token) {
    const error = new Error("PERSISTENT_CONNECTION_MISSING");
    error.status = 401;
    throw error;
  }

  try {
    return await work(tokens.access_token);
  } catch (error) {
    if (error?.status !== 401) throw error;
    tokens = { ...tokens, ...(await refreshTokens(config, tokens.refresh_token)) };
    await savePersistentTokens(config, tokens);
    return work(tokens.access_token);
  }
}
