import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compileQwenReferencePrompt,
  inspectRunningHubQwenImageGraph,
  runningHubQwenNodeInfo,
  RUNNINGHUB_QWEN_IMAGE_WORKFLOW_ID,
} from "../app/api/runninghub/image-contract.ts";
import {
  FRAMEFLOW_IMAGE_REFERENCE_LIMIT,
  selectFrameFlowImageReferences,
} from "../app/api/runninghub/image-reference-policy.ts";

const exportedGraph = {
  "484": { class_type: "TextEncodeQwenImage21", inputs: { prompt: ["511", 0], "images.image_1": ["490", 0], "images.image_6": ["491", 0] } },
  "485": { class_type: "SaveImage", inputs: { images: ["480", 0] } },
  "486": { class_type: "PrimitiveStringMultiline", inputs: { value: "prompt" } },
  "490": { class_type: "LoadImage", inputs: { image: "one.png" } },
  "491": { class_type: "LoadImage", inputs: { image: "six.png" } },
  "499": { class_type: "ResolutionSelector", inputs: { aspect_ratio: "9:16 (Portrait Widescreen)" } },
  "511": { class_type: "YYZPack_QwenPromptEnhancer", inputs: { user_idea: ["486", 0], system_prompt: "legacy", extra_instructions: "", temperature: 0.8 } },
};

test("uploaded Qwen graph distinguishes six configured nodes from currently enabled switches", () => {
  const inspected = inspectRunningHubQwenImageGraph(exportedGraph);
  assert.equal(inspected.workflowId, RUNNINGHUB_QWEN_IMAGE_WORKFLOW_ID);
  assert.deepEqual(inspected.connectedImageSlots, [1, 6]);
  assert.equal(inspected.referenceCapacity, 6);
  assert.equal(inspected.configuredReferenceCapacity, 6);
  assert.equal(inspected.activeReferenceCapacity, 2);
  assert.equal(inspected.workflowContractVerified, true);
});

test("disabled reference switches produce an actionable error instead of a false two-slot limit", () => {
  const { mapping } = inspectRunningHubQwenImageGraph(exportedGraph);
  assert.throws(() => compileQwenReferencePrompt("shot", [{}, {}, {}], mapping.imageSlots), error => {
    assert.equal(error.code, "RUNNINGHUB_QWEN_REFERENCE_SWITCH_DISABLED");
    assert.match(error.message, /designed for six references/i);
    assert.match(error.message, /current API-format graph has only 2 reference switches enabled/i);
    return true;
  });
});

test("every submitted reference receives a strict purpose in the Qwen prompt", () => {
  const { mapping } = inspectRunningHubQwenImageGraph(exportedGraph);
  const prompt = compileQwenReferencePrompt("Create a rainy medium shot.", [
    { referenceRole: "character" },
    { referenceRole: "environment" },
  ], mapping.imageSlots);
  assert.match(prompt, /<image1> — Character identity/);
  assert.match(prompt, /<image6> — Environment/);
  assert.match(prompt, /do not inherit pose, crop, wardrobe/i);
  assert.match(prompt, /do not import people, pose or wardrobe/i);
  assert.match(prompt, /FINAL IMAGE DIRECTION:\nCreate a rainy medium shot/);
});

test("Character Anchor uses full-body diagram then facial identity", () => {
  const references = [
    { id: 11, itemKey: "character-reference", version: 1, fileName: "hana-full-body-diagram.png" },
    { id: 12, itemKey: "character-reference", version: 2, fileName: "hana-face-features.png" },
    { id: 13, itemKey: "environment-reference", version: 1, fileName: "studio.png" },
  ];
  const selected = selectFrameFlowImageReferences({ references, referenceTypes: ["character", "environment"], continuityWithFirstImage: false });
  assert.equal(FRAMEFLOW_IMAGE_REFERENCE_LIMIT, 2);
  assert.deepEqual(selected.map(asset => asset.id), [11, 12]);
  const { mapping } = inspectRunningHubQwenImageGraph(exportedGraph);
  const prompt = compileQwenReferencePrompt("Create the first Anchor.", selected, mapping.imageSlots);
  assert.match(prompt, /<image1> — Full-body character diagram/);
  assert.match(prompt, /<image6> — Facial identity reference/);
  assert.match(prompt, /do not copy the diagram layout/i);
});

test("Character continuation uses facial identity then approved first Anchor", () => {
  const references = [
    { id: 11, itemKey: "character-reference", version: 1, fileName: "character-sheet.png" },
    { id: 12, itemKey: "character-reference", version: 2, fileName: "facial-identity.png" },
  ];
  const selected = selectFrameFlowImageReferences({ references, referenceTypes: ["character"], continuityWithFirstImage: true, approvedAnchor: { id: 99, fileName: "approved-anchor.png" } });
  assert.deepEqual(selected.map(asset => asset.id), [12, 99]);
  const { mapping } = inspectRunningHubQwenImageGraph(exportedGraph);
  const prompt = compileQwenReferencePrompt("Create the continuation.", selected, mapping.imageSlots);
  assert.match(prompt, /<image1> — Facial identity reference/);
  assert.match(prompt, /<image6> — Approved first Content Anchor/);
});

test("RunningHub node payload uses only graph-verified editable fields", () => {
  const { mapping } = inspectRunningHubQwenImageGraph(exportedGraph);
  const nodes = runningHubQwenNodeInfo(mapping, { fileNames: ["api/a.png", "api/b.png"], prompt: "mapped prompt", aspectRatio: "9:16" });
  assert.deepEqual(nodes, [
    { nodeId: "490", fieldName: "image", fieldValue: "api/a.png" },
    { nodeId: "491", fieldName: "image", fieldValue: "api/b.png" },
    { nodeId: "486", fieldName: "value", fieldValue: "mapped prompt" },
    { nodeId: "511", fieldName: "system_prompt", fieldValue: nodes[3].fieldValue },
    { nodeId: "511", fieldName: "extra_instructions", fieldValue: "Reference-role lines are authoritative P0 constraints and must remain explicit in the output." },
    { nodeId: "511", fieldName: "temperature", fieldValue: 0.3 },
    { nodeId: "499", fieldName: "aspect_ratio", fieldValue: "9:16 (Portrait Widescreen)" },
  ]);
  assert.match(String(nodes[3].fieldValue), /Preserve every <imageN> label/);
});

test("image orchestrator is locked to RunningHub Qwen and no longer calls OpenRouter", async () => {
  const orchestrator = await readFile(new URL("../app/api/orchestrator/service.ts", import.meta.url), "utf8");
  const agent = await readFile(new URL("../app/api/agent-runner/service.ts", import.meta.url), "utf8");
  const contract = await readFile(new URL("../app/api/runninghub/image-contract.ts", import.meta.url), "utf8");
  assert.match(orchestrator, /dispatchRunningHubQwenImage/);
  assert.doesNotMatch(orchestrator, /openrouter\.ai|openrouter-image/);
  assert.match(contract, /2102592525269012481/);
  assert.match(agent, /RUNNINGHUB_QWEN_IMAGE_WORKFLOW_ID/);
  assert.match(agent, /max_input_references:FRAMEFLOW_IMAGE_REFERENCE_LIMIT/);
});
