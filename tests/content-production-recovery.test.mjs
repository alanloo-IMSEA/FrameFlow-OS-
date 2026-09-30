import assert from "node:assert/strict";
import test from "node:test";

import { recoverMissingProductionAssets } from "../app/content-production-recovery.ts";
import {
  normalizeVisualPromptArchitecture,
  visualPromptIssues,
} from "../app/visual-prompt-architecture.ts";
import {
  compactContentProductionRevisionDraft,
  contentProductionRetakeContentIds,
  mergeContentProductionRevisionItems,
} from "../app/content-production-revision.ts";

const source = {
  id: "content_2",
  contentType: "Carousel",
  visualAssetCount: 4,
  characterPresence: "No Human",
  referenceTypes: ["product"],
  story: "Slide 1: Cover. Slide 2: Compare reflections. Slide 3: Explain use cases. Slide 4: Summary and CTA.",
  idea: "Compare Standard and Matte PLA.",
  keyMessage: "Choose the right finish.",
};

function productAnchor() {
  return normalizeVisualPromptArchitecture({}, {
    source,
    contentId: "content_2",
    assetNumber: 1,
    assetRole: "Cover",
    subjectPresence: "No Human",
    wardrobe: { mode: "NOT_APPLICABLE" },
    referenceTypes: ["product"],
  });
}

test("missing continuation visuals are restored from the approved Batch plan", () => {
  const current = {
    production_items: [{
      contentId: "content_2",
      caption: "Caption",
      hashtags: "#nfillar",
      assets: [{
        assetNumber: 1,
        assetRole: "Cover",
        subjectPresence: "No Human",
        wardrobe: { mode: "NOT_APPLICABLE" },
        visualPrompt: productAnchor(),
        referenceTypes: ["product"],
        continuityWithFirstImage: false,
        generationQuality: "low",
        generationResolution: "512",
        maxInputReferences: 2,
      }],
    }],
  };

  const recovered = recoverMissingProductionAssets(current, { content_items: [source] });
  const assets = recovered.data.production_items[0].assets;
  assert.deepEqual(assets.map((asset) => asset.assetNumber), [1, 2, 3, 4]);
  assert.deepEqual(recovered.recoveredItemKeys, [
    "content_2-asset-2",
    "content_2-asset-3",
    "content_2-asset-4",
  ]);
  assert.match(assets[1].imageGenerationPrompt, /Compare reflections/i);
  assert.match(assets[3].imageGenerationPrompt, /Summary and CTA/i);
  assert.equal(assets[1].continuityWithFirstImage, true);
  assert.deepEqual(visualPromptIssues(assets[1].visualPrompt), []);
});

test("irrelevant empty human blocks are disabled for product shots", () => {
  const architecture = normalizeVisualPromptArchitecture({
    structuredAnchor: { blocks: {
      expressionPerformance: { enabled: true, fields: {} },
      actionPoseInteraction: {
        enabled: true,
        fields: { action: "", poseInteraction: "" },
      },
    } },
  }, {
    source,
    contentId: "content_2",
    assetNumber: 1,
    assetRole: "Product cover",
    subjectPresence: "No Human",
    wardrobe: { mode: "NOT_APPLICABLE" },
    referenceTypes: ["product"],
  });

  assert.equal(architecture.structuredAnchor.blocks.expressionPerformance.enabled, false);
  assert.equal(architecture.structuredAnchor.blocks.actionPoseInteraction.enabled, false);
  assert.deepEqual(visualPromptIssues(architecture), []);
});

test("Content Production Retake input keeps every item without provider and execution payload", () => {
  const huge = "compiled provider prose ".repeat(500);
  const current = {
    production_summary: "Keep the existing summary",
    technical_notes: "Keep the existing notes",
    _imageGenerationJobIds: ["job_1"],
    _originalGeneratedDraft: { duplicate: huge },
    production_items: ["content_1", "content_2", "content_3", "content_4"].map((contentId, index) => ({
      contentId,
      title: `Content ${index + 1}`,
      caption: "Caption",
      assets: [{
        assetNumber: 1,
        assetRole: "ANCHOR",
        subjectPresence: "HUMAN_PRESENT",
        wardrobe: { mode: "DEFINE", top: "Top" },
        referenceAssets: [{ storageKey: "private/reference.png", metadata: huge }],
        imageGenerationPrompt: huge,
        visualPrompt: {
          generationMode: "ANCHOR",
          shotPurpose: "CHARACTER_ANCHOR",
          referenceSwitches: { character: true },
          structuredAnchor: { shotType: "CHARACTER_LIFESTYLE", blocks: { creativeIntent: { fields: { storyMoment: "Morning" } } } },
          compiledFinalPrompt: huge,
        },
      }],
    })),
  };

  const compact = compactContentProductionRevisionDraft(current);
  assert.deepEqual(compact.items.map((item) => item.contentId), ["content_1", "content_2", "content_3", "content_4"]);
  assert.equal(compact.productionSummary, "Keep the existing summary");
  assert.equal(compact.technicalNotes, "Keep the existing notes");
  assert.equal(compact.items[0].assets[0].structuredVisualAnchor.shotType, "CHARACTER_LIFESTYLE");
  assert.doesNotMatch(JSON.stringify(compact), /compiled provider prose|storageKey|imageGenerationPrompt|_imageGenerationJobIds|_originalGeneratedDraft/);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(current).length / 4);
});

test("multi-item Retake is partitioned by Content and merged without losing untouched items", () => {
  const current = {
    production_summary: "Summary",
    technical_notes: "Notes",
    production_items: ["content_1", "content_2", "content_3", "content_4"].map((contentId) => ({
      contentId,
      title: contentId,
      caption: `old ${contentId}`,
      assets: [{ assetNumber: 1, visualPrompt: { structuredAnchor: { shotType: "CHARACTER_LIFESTYLE" } } }],
    })),
  };
  const feedback = {
    "production_items.content_2.asset.1": "Change content 2",
    "production_items.content_4.asset.1": "Change content 4",
  };
  assert.deepEqual(contentProductionRetakeContentIds(feedback, current), ["content_2", "content_4"]);
  const revised = [
    { ...compactContentProductionRevisionDraft(current).items[1], caption: "new content_2" },
    { ...compactContentProductionRevisionDraft(current).items[3], caption: "new content_4" },
  ];
  const merged = mergeContentProductionRevisionItems(current, revised);
  assert.deepEqual(merged.items.map((item) => item.contentId), ["content_1", "content_2", "content_3", "content_4"]);
  assert.deepEqual(merged.items.map((item) => item.caption), ["old content_1", "new content_2", "old content_3", "new content_4"]);
  assert.equal(merged.productionSummary, "Summary");
  assert.equal(merged.technicalNotes, "Notes");
});
