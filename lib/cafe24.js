export function buildAdminApiUrl(config, path, params = {}) {
  const url = new URL(`https://${config.mallId}.cafe24api.com/api/v2/admin/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

export async function cafe24AdminRequest(config, accessToken, path, params = {}) {
  const response = await fetch(buildAdminApiUrl(config, path, params), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const error = new Error("CAFE24_API_REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function cafe24AdminWriteRequest(config, accessToken, path, method, body) {
  const response = await fetch(buildAdminApiUrl(config, path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error("CAFE24_API_WRITE_FAILED");
    error.status = response.status;
    throw error;
  }
  return response.json();
}
