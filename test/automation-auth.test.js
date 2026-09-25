import test from "node:test";
import assert from "node:assert/strict";
import { matchesAutomationSecret } from "../lib/automation-auth.js";

test("automation secret accepts only the exact key", () => {
  assert.equal(matchesAutomationSecret("correct-key", "correct-key"), true);
  assert.equal(matchesAutomationSecret("wrong-key", "correct-key"), false);
  assert.equal(matchesAutomationSecret("correct-key", ""), false);
});
