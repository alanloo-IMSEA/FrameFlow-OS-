import assert from "node:assert/strict";
import test from "node:test";

import { parseProviderJsonObject } from "../app/provider-json.ts";

test("parses a normal provider JSON object", () => {
  assert.deepEqual(parseProviderJsonObject('{"items":[{"id":"content_1"}]}'), {
    items: [{ id: "content_1" }],
  });
});

test("extracts the first complete JSON object when provider appends commentary", () => {
  const result = parseProviderJsonObject(
    '```json\n{"items":[{"copy":"brace } and escaped \\\" quote"}]}\n```\nGeneration complete.',
  );
  assert.equal(result.items[0].copy, 'brace } and escaped " quote');
});

test("does not accept a genuinely truncated provider object", () => {
  assert.throws(() => parseProviderJsonObject('{"items":[{"id":"content_1"}'), SyntaxError);
});

test("does not accept an array as the structured response", () => {
  assert.throws(
    () => parseProviderJsonObject('[{"id":"content_1"}] trailing'),
    /Unexpected|invalid structured result/,
  );
});
