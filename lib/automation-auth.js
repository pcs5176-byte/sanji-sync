import { timingSafeEqual } from "node:crypto";

function headerValue(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function matchesAutomationSecret(provided, expected = process.env.AUTOMATION_UPLOAD_SECRET) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export function automationRequestAuthorized(req) {
  return matchesAutomationSecret(headerValue(req, "x-sanzi-automation-key"));
}
