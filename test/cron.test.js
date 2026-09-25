import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/cron/refresh-cafe24.js";

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("scheduled refresh rejects requests without the cron secret", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    const res = responseRecorder();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: "unauthorized" });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("scheduled refresh requires a persistent store after authorization", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    const res = responseRecorder();
    await handler(
      { method: "GET", headers: { authorization: "Bearer cron-secret" } },
      res,
    );
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: "persistent_token_store_not_configured" });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
