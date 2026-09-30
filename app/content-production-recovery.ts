import { plannedVisualCount } from "./social-production-plan.ts";
import {
  normalizeVisualPromptArchitecture,
  referenceTypesFromSwitches,
} from "./visual-prompt-architecture.ts";

function idOf(value: any, fallback = "") {
  return String(value?.contentId || value?.content_id || value?.id || fallback);
}

function sourceItems(batch: any) {
  return Array.isArray(batch?.content_items)
    ? batch.content_items
    : Array.isArray(batch?.items)
      ? batch.items
      : [];
}

function slideRequirement(source: any, assetNumber: number) {
  const story = String(source?.story || source?.idea || "").trim();
  const marker = new RegExp(
    `(?:^|\\s)Slide\\s*${assetNumber}\\s*:\\s*([\\s\\S]*?)(?=\\s+Slide\\s*${assetNumber + 1}\\s*:|$)`,
    "i",
  );
  return (
    story.match(marker)?.[1]?.trim() ||
    `Create visual ${assetNumber} as a distinct continuation of the approved Content idea without changing locked product, identity, logo, wardrobe or scene facts.`
  );
}

/**
 * Restores a continuation plan when an older/partial provider response contains
 * only the already-reviewed first image. No image bytes or approved snapshots
 * are changed here; the normal image queue still creates every missing output.
 */
export function recoverMissingProductionAssets(currentData: any, approvedBatch: any) {
  const data = structuredClone(currentData || {});
  const items = Array.isArray(data.production_items) ? data.production_items : [];
  const sources = sourceItems(approvedBatch);
  const recoveredItemKeys: string[] = [];

  for (const [itemIndex, item] of items.entries()) {
    const contentId = idOf(item, `content_${itemIndex + 1}`);
    const source = sources.find((row: any) => idOf(row) === contentId) || sources[itemIndex] || {};
    const expected = plannedVisualCount(source);
    const assets = Array.isArray(item.assets) ? item.assets : (item.assets = []);
    const first = assets.find((asset: any, index: number) =>
      Number(asset?.assetNumber ?? asset?.asset_number ?? index + 1) === 1,
    );
    if (!first || expected <= 1) continue;

    const subjectPresence = String(
      first.subjectPresence || first.subject_presence || source.characterPresence || source.character_presence || "HUMAN_PRESENT",
    );
    const humanAbsent = /human[_\s-]*absent|no[_\s-]*human/i.test(subjectPresence);
    const referenceTypes = (Array.isArray(first.referenceTypes)
      ? first.referenceTypes
      : Array.isArray(source.referenceTypes)
        ? source.referenceTypes
        : Array.isArray(source.reference_types)
          ? source.reference_types
          : []).map(String);
    const anchorArchitecture = normalizeVisualPromptArchitecture(first.visualPrompt, {
      source,
      contentId,
      assetNumber: 1,
      assetRole: String(first.assetRole || first.asset_role || "Content Anchor"),
      subjectPresence,
      wardrobe: first.wardrobe,
      referenceTypes,
      approvedAnchor: false,
    });

    for (let assetNumber = 2; assetNumber <= expected; assetNumber += 1) {
      if (assets.some((asset: any, index: number) =>
        Number(asset?.assetNumber ?? asset?.asset_number ?? index + 1) === assetNumber,
      )) continue;

      const requirement = slideRequirement(source, assetNumber);
      const referenceSwitches = {
        ...anchorArchitecture.referenceSwitches,
        approvedAnchor: true,
      };
      const wardrobe = humanAbsent
        ? { mode: "NOT_APPLICABLE", wardrobeLogic: "NOT_APPLICABLE" }
        : { mode: "INHERIT_FROM_ANCHOR", wardrobeLogic: "INHERIT_FROM_APPROVED_CONTENT_ANCHOR" };
      const architecture = normalizeVisualPromptArchitecture(
        {
          referenceSwitches,
          structuredAnchor: {
            blocks: {
              creativeIntent: {
                enabled: true,
                priority: "P2_FLEXIBLE",
                fields: {
                  storyMoment: { value: requirement, priority: "P2_FLEXIBLE" },
                },
              },
              actionPoseInteraction: {
                enabled: true,
                priority: "P2_FLEXIBLE",
                fields: {
                  action: { value: requirement, priority: "P2_FLEXIBLE" },
                  poseInteraction: {
                    value: "Arrange the approved subjects and objects with believable support, contact, scale and occlusion for this visual.",
                    priority: "P2_FLEXIBLE",
                  },
                },
              },
              cameraComposition: {
                enabled: true,
                priority: "P2_FLEXIBLE",
                fields: {
                  subjectPlacement: { value: requirement, priority: "P2_FLEXIBLE" },
                },
              },
            },
          },
        },
        {
          source,
          contentId,
          assetNumber,
          assetRole: `Visual ${assetNumber} continuation`,
          subjectPresence,
          wardrobe,
          referenceTypes,
          approvedAnchor: true,
          anchorArchitecture,
        },
      );

      assets.push({
        assetNumber,
        assetRole: `Visual ${assetNumber} continuation`,
        subjectPresence,
        wardrobe,
        visualPrompt: architecture,
        imageGenerationPrompt: architecture.compiledFinalPrompt,
        referenceTypes: referenceTypesFromSwitches(architecture.referenceSwitches),
        referenceAssets: [],
        continuityWithFirstImage: true,
        generationQuality: "low",
        generationResolution: "1K",
        maxInputReferences: 2,
      });
      recoveredItemKeys.push(`${contentId}-asset-${assetNumber}`);
    }
    assets.sort((a: any, b: any) => Number(a.assetNumber || 0) - Number(b.assetNumber || 0));
  }

  return { data, recoveredItemKeys };
}
