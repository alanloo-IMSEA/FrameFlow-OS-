import assert from "node:assert/strict";
import test from "node:test";

import {
  approveVisualAnchor,
  compileVisualPrompt,
  detectVisualShotPurpose,
  mergeRetakeArchitecture,
  normalizeVisualPromptArchitecture,
  referenceTypesFromSwitches,
} from "../app/visual-prompt-architecture.ts";
import { activeFormulaFor } from "../app/formula-library.ts";

const characterSource = {
  title: "Window Morning",
  idea: "A creator pauses beside a window and tidies her hair before starting work.",
  keyMessage: "Quiet confidence",
  visualRequirement: "A lived-in Malaysian apartment with soft morning light.",
};

const wardrobe = {
  mode: "DEFINE",
  top: "ivory linen shirt",
  bottom: "high-waisted charcoal trousers",
  shoes: "black leather loafers",
  accessories: "small gold hoop earrings",
  colorPalette: "ivory, charcoal and warm gold",
  materialBehavior: "linen creases and compresses naturally at the elbows and waist",
  wardrobeLogic: "NEW_ANCHOR_WARDROBE",
};

function characterAnchor() {
  return normalizeVisualPromptArchitecture(
    {
      structuredAnchor: {
        blocks: {
          subjectIdentity: {
            fields: {
              identity: {
                value: "Exact approved Hana identity and face geometry.",
                priority: "P0_LOCK",
              },
            },
          },
          actionPoseInteraction: {
            fields: {
              action: {
                value: "She sits naturally at a desk with both feet grounded.",
                priority: "P2_FLEXIBLE",
              },
            },
          },
        },
      },
    },
    {
      source: characterSource,
      contentId: "content_1",
      assetNumber: 1,
      assetRole: "Lifestyle anchor",
      subjectPresence: "HUMAN_PRESENT",
      wardrobe,
      referenceTypes: ["character", "environment"],
    },
  );
}

test("product shots enable product fields without forcing human wardrobe", () => {
  const product = normalizeVisualPromptArchitecture(
    {},
    {
      source: {
        idea: "A clean hero image of the approved coffee pouch.",
        visualRequirement: "Warm stone counter in the approved cafe.",
      },
      contentId: "content_product",
      assetNumber: 1,
      assetRole: "Product hero shot",
      subjectPresence: "HUMAN_ABSENT",
      wardrobe: { mode: "NOT_APPLICABLE" },
      referenceTypes: ["product", "company_logo", "environment"],
    },
  );

  assert.equal(product.shotType, "PRODUCT");
  assert.equal(product.structuredAnchor.blocks.subjectIdentity.enabled, false);
  assert.equal(product.structuredAnchor.blocks.expressionPerformance.enabled, false);
  assert.equal(
    product.structuredAnchor.blocks.wardrobeProductProps.fields.wardrobeTop,
    undefined,
  );
  assert.match(
    product.structuredAnchor.blocks.wardrobeProductProps.fields.productLockRules.value,
    /Do not redesign packaging, proportions, logo or printing/i,
  );
  assert.deepEqual(referenceTypesFromSwitches(product.referenceSwitches), [
    "product",
    "company_logo",
    "environment",
  ]);
  assert.equal(product.referenceSwitches.character, false);
});

test("an explicit Reference OFF overrides an approved legacy Project reference", () => {
  const product = normalizeVisualPromptArchitecture(
    { referenceSwitches: { character: false, product: true, environment: false } },
    {
      source: { idea: "Approved product-only shot" },
      contentId: "content_product_off",
      assetNumber: 1,
      assetRole: "Product hero",
      subjectPresence: "HUMAN_ABSENT",
      wardrobe: { mode: "NOT_APPLICABLE" },
      referenceTypes: ["character", "product", "environment"],
    },
  );
  assert.equal(product.referenceSwitches.character, false);
  assert.equal(product.referenceSwitches.environment, false);
  assert.deepEqual(referenceTypesFromSwitches(product.referenceSwitches), ["product"]);
  assert.deepEqual(product.sourceLayer.selectedReferenceTypes, ["product"]);
});

test("continuation compiler inherits approved P0/P1 and applies the current P2 shot", () => {
  const approved = approveVisualAnchor(characterAnchor(), { id: 91, version: 1 }, "2026-09-02T00:00:00.000Z");
  const continuation = normalizeVisualPromptArchitecture(
    {
      structuredAnchor: {
        blocks: {
          actionPoseInteraction: {
            fields: {
              action: {
                value: "She stands beside the window and gently tidies her hair.",
                priority: "P2_FLEXIBLE",
              },
            },
          },
          cameraComposition: {
            fields: {
              cameraAngle: {
                value: "Three-quarter side angle at eye level.",
                priority: "P2_FLEXIBLE",
              },
            },
          },
        },
      },
    },
    {
      source: characterSource,
      contentId: "content_1",
      assetNumber: 2,
      assetRole: "Window continuation",
      subjectPresence: "HUMAN_PRESENT",
      wardrobe: { mode: "INHERIT_FROM_ANCHOR" },
      referenceTypes: ["character"],
      approvedAnchor: true,
      anchorArchitecture: approved,
    },
  );

  const prompt = compileVisualPrompt(continuation, approved);
  assert.equal(continuation.generationMode, "CONTINUATION");
  assert.equal(continuation.inheritance.inheritsFromAnchorId, approved.structuredAnchor.anchorId);
  assert.match(prompt, /Exact approved Hana identity and face geometry/i);
  assert.match(prompt, /ivory linen shirt/i);
  assert.match(prompt, /stands beside the window and gently tidies her hair/i);
  assert.match(prompt, /Three-quarter side angle at eye level/i);
  assert.match(prompt.trim().split("\n\n").at(-1), /^Hard constraints:/);
});

test("pose-only retake preserves approved P0 identity and P1 environment", () => {
  const current = approveVisualAnchor(characterAnchor(), { id: 91, version: 1 }, "2026-09-02T00:00:00.000Z");
  const proposed = normalizeVisualPromptArchitecture(
    {
      structuredAnchor: {
        blocks: {
          subjectIdentity: {
            fields: {
              identity: {
                value: "A different face that must never replace the approved identity.",
                priority: "P0_LOCK",
              },
            },
          },
          environment: {
            fields: {
              sceneIdentity: {
                value: "A different studio.",
                priority: "P1_PRESERVE",
              },
            },
          },
          actionPoseInteraction: {
            fields: {
              action: {
                value: "She shifts her weight naturally onto one leg with relaxed shoulders.",
                priority: "P2_FLEXIBLE",
              },
            },
          },
        },
      },
    },
    {
      source: characterSource,
      contentId: "content_1",
      assetNumber: 1,
      assetRole: "Lifestyle anchor",
      subjectPresence: "HUMAN_PRESENT",
      wardrobe,
      referenceTypes: ["character", "environment"],
    },
  );

  const retake = mergeRetakeArchitecture(current, proposed, "Pose 不好，换一个自然一点的姿势。");
  assert.equal(
    retake.structuredAnchor.blocks.subjectIdentity.fields.identity.value,
    "Exact approved Hana identity and face geometry.",
  );
  assert.notEqual(
    retake.structuredAnchor.blocks.environment.fields.sceneIdentity.value,
    "A different studio.",
  );
  assert.match(
    retake.structuredAnchor.blocks.actionPoseInteraction.fields.action.value,
    /shifts her weight naturally/i,
  );
  assert.deepEqual(retake.inheritance.changedBlocks, ["actionPoseInteraction"]);
});

test("legacy assets normalize into the new schema without a SQL migration", () => {
  const migrated = normalizeVisualPromptArchitecture(
    {},
    {
      source: characterSource,
      contentId: "legacy_content",
      assetNumber: 1,
      assetRole: "Legacy visual",
      subjectPresence: "HUMAN_PRESENT",
      wardrobe,
      referenceTypes: ["character"],
    },
  );
  assert.equal(migrated.schemaVersion, "frameflow.visual-prompt.v1");
  assert.equal(migrated.compilerVersion, "FF-PROMPT-COMPILER-1.2");
  assert.equal(migrated.workflowTarget.workflowId, "2102592525269012481");
  assert.ok(migrated.compiledFinalPrompt.length > 100);
});

test("product compiler records one purpose and preserves soft semantic labels", () => {
  const hero = normalizeVisualPromptArchitecture(
    { structuredAnchor: { blocks: { productIdentity: { fields: {
      approvedObjectName: "N-Fillar PLA Spool and Mechanical Gear Assembly",
      geometry: "Standard 1kg spool with 200mm diameter",
      dimensions: "200mm spool diameter",
      materialClass: "PLA filament, molded plastic flanges and printed PLA gear",
      approvedColor: "N-Fillar Signature Blue and Crisp White",
      labelLogoRequirements: "Official batch label, recycling icon and approved N-Fillar logo",
    } } } } },
    { source: { idea: "Introduce the product" }, contentId: "nf_hero", assetNumber: 1,
      assetRole: "Hero introduction product shot", subjectPresence: "HUMAN_ABSENT",
      wardrobe: { mode: "NOT_APPLICABLE" }, referenceTypes: ["product", "company_logo"] },
  );
  assert.equal(hero.shotPurpose, "PRODUCT_HERO");
  assert.equal(hero.compiledFinalPrompt.split("\n\n").length, 3);
  assert.match(hero.compiledFinalPrompt, /Product: N-Fillar PLA Spool/);
  assert.match(hero.compiledFinalPrompt, /Shot purpose: PRODUCT_HERO/);
  assert.match(hero.compiledFinalPrompt, /Composition:/);
  assert.match(hero.compiledFinalPrompt, /Hard constraints:/);
});

test("macro purpose permits a partial product and is not compiled as a cover shot", () => {
  const macro = normalizeVisualPromptArchitecture(
    { shotPurpose: "PRODUCT_DETAIL_MACRO", structuredAnchor: { blocks: {
      productSurfaceManufacturing: { fields: { precisionRequirement: "Resolve flawless parallel winding and gear layer edges." } },
    } } },
    { source: { idea: "Show precision winding" }, contentId: "nf_macro", assetNumber: 2,
      assetRole: "Precision detail macro", subjectPresence: "HUMAN_ABSENT",
      wardrobe: { mode: "NOT_APPLICABLE" }, referenceTypes: ["product"] },
  );
  assert.equal(macro.shotPurpose, "PRODUCT_DETAIL_MACRO");
  assert.match(macro.compiledFinalPrompt, /full-product visibility is not required/i);
  assert.match(macro.compiledFinalPrompt, /flawless parallel winding/i);
  assert.doesNotMatch(macro.compiledFinalPrompt, /single hero object/i);
});

test("comparison purpose requires and labels both variants", () => {
  const comparison = normalizeVisualPromptArchitecture(
    { shotPurpose: "PRODUCT_COMPARISON", structuredAnchor: { blocks: {
      productIdentity: { fields: { variantA: "Signature Blue spool", variantB: "Crisp White spool" } },
      shotPurpose: { fields: { comparisonGoal: "Compare color and surface finish under identical light." } },
    } } },
    { source: { idea: "Compare approved variants" }, contentId: "nf_compare", assetNumber: 2,
      assetRole: "Variant comparison", subjectPresence: "HUMAN_ABSENT",
      wardrobe: { mode: "NOT_APPLICABLE" }, referenceTypes: ["product"] },
  );
  assert.equal(comparison.shotPurpose, "PRODUCT_COMPARISON");
  assert.match(comparison.compiledFinalPrompt, /Variant A: Signature Blue spool/);
  assert.match(comparison.compiledFinalPrompt, /Variant B: Crisp White spool/);
  assert.match(comparison.compiledFinalPrompt, /Comparison target: Compare color and surface finish/);
});

test("FF-07C exposes the system-wide shot purpose taxonomy", () => {
  const formula = activeFormulaFor("content-production", "Internal Social Account");
  const purpose = formula.outputSchema.items[0].assets[0].shotPurpose;
  assert.equal(formula.version, "4.0");
  assert.match(purpose, /CHARACTER_ANCHOR/);
  assert.match(purpose, /PRODUCT_DETAIL_MACRO/);
  assert.match(purpose, /PROP_IN_USE/);
  assert.match(purpose, /ENVIRONMENT_ESTABLISHING/);
  assert.match(purpose, /GENERIC_CONCEPT/);
  assert.doesNotMatch(formula.promptTemplate, /Hana|N-Fillar|PRJ-\d+/i);
});

test("each non-product shot type receives its own purpose and continuity profile", () => {
  assert.equal(detectVisualShotPurpose("CHARACTER_LIFESTYLE", "", "Portrait close-up", 1), "CHARACTER_EXPRESSION");
  assert.equal(detectVisualShotPurpose("PROP", "", "Prop detail macro", 1), "PROP_DETAIL");
  assert.equal(detectVisualShotPurpose("ENVIRONMENT", "", "Establishing space", 1), "ENVIRONMENT_ESTABLISHING");
  assert.equal(detectVisualShotPurpose("GENERIC", "", "Concept image", 1), "GENERIC_CONCEPT");
  const environment = normalizeVisualPromptArchitecture({}, {
    source: { idea: "Approved studio establishing image" }, contentId: "environment_1", assetNumber: 1,
    assetRole: "Environment establishing", subjectPresence: "HUMAN_ABSENT",
    wardrobe: { mode: "NOT_APPLICABLE" }, referenceTypes: ["environment"],
  });
  assert.equal(environment.shotPurpose, "ENVIRONMENT_ESTABLISHING");
  assert.match(environment.compiledFinalPrompt, /Shot purpose: ENVIRONMENT_ESTABLISHING/);
  assert.match(environment.compiledFinalPrompt, /spatial layout, architecture, material palette/i);
});

test("non-product retake can change purpose without changing shot type", () => {
  const current = characterAnchor();
  const next = normalizeVisualPromptArchitecture(
    { shotPurpose: "CHARACTER_EXPRESSION" },
    { source: characterSource, contentId: "content_1", assetNumber: 1,
      assetRole: "Expression portrait", subjectPresence: "HUMAN_PRESENT", wardrobe,
      referenceTypes: ["character", "environment"] },
  );
  const retake = mergeRetakeArchitecture(current, next, "Change shot purpose to an expression close-up.");
  assert.equal(retake.shotType, "CHARACTER_LIFESTYLE");
  assert.equal(retake.shotPurpose, "CHARACTER_EXPRESSION");
  assert.match(retake.compiledFinalPrompt, /Shot purpose: CHARACTER_EXPRESSION/);
});
