"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { activeFormulaFor } from "./formula-library";
import { uploadFileInChunks } from "./chunked-upload";
import {
  normalizeWardrobe,
  reelVideoPrompt,
} from "./social-production-formula";
import {
  I2VPromptItem,
  normalizeI2VPromptItem,
} from "./video-prompt-architecture";
import {
  REEL_STYLES,
  reelStyleDefinition,
} from "./reel-production-architecture";
import {
  selectSocialProductionBatch,
  socialBatchAssetKey,
  socialBatchAssetPrefix,
} from "./social-batch-assets";
import {
  normalizeVisualPromptArchitecture,
  referenceTypesFromSwitches,
  type VisualPromptArchitecture,
} from "./visual-prompt-architecture";
import {
  formatProjectDateTime,
  projectTimezone,
  timezoneInputToUtc,
  timezoneInputValue,
} from "./project-timezone";
import {
  canonicalSocialPlatform,
  configuredSchedulePlatforms,
  isAutomaticPublishingPlatform,
  platformAllowedForContent,
} from "./social-scheduling-platforms";

import {readJson} from "./read-json";
type Field = { key: string; label: string; placeholder: string };
const common = (...labels: string[]): Field[] =>
  labels.map((label) => ({
    key: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
    label,
    placeholder: `Write ${label.toLowerCase()}…`,
  }));
const fields: Record<string, Field[]> = {
  "market-research": common(
    "Market situation",
    "Audience insight",
    "Competitor patterns",
    "Current opportunities",
    "Verified references / URLs",
  ),
  "creative-direction": common(
    "Creative concept",
    "Audience response goal",
    "Core communication problem",
    "Selected audience tension / desire",
    "Selected market opportunity",
    "Competitor conventions to avoid",
    "Creative proposition",
    "Story approach",
    "Visual language",
    "Tone, mood and pacing",
    "Execution rules",
    "Continuity requirements",
    "Production boundaries",
    "Reason this direction fits",
  ),
  script: common(
    "Title",
    "Premise",
    "Opening hook",
    "Audience situation / tension",
    "Story outline",
    "Narrative flow",
    "Turning point",
    "Ending / payoff",
    "CTA",
    "Dialogue / voice-over",
    "Meaning",
    "Client-facing rationale",
    "Required characters",
    "Required environments",
    "Required props",
    "Important wardrobe / product requirements",
    "Continuity notes",
    "Production complexity notes",
  ),
  "keyshot-set": common("Keyshot 01"),
  "batch-directions": common(
    "Video list",
    "Creative direction per video",
    "Batch-level comparison",
    "Internal review notes",
  ),
  "idea-hook-story": common(
    "Batch objective",
    "Idea list",
    "Hooks",
    "Stories",
    "Batch gate notes",
  ),
  "strategy-direction": common(
    "Strategic objective",
    "Performance learning",
    "Content pillars",
    "Format mix",
    "Visual direction",
    "Tone of voice",
    "Current direction decision",
    "Management rationale",
    "Next batch testing priorities",
    "Must preserve",
    "Must avoid",
    "AI influencer identity / persona",
    "Character continuity requirements",
  ),
  "content-production": common(
    "Production summary",
    "Asset completion notes",
    "Caption / copy status",
    "Technical notes",
  ),
  "video-generation": common(
    "Generation plan",
    "Approved source assets",
    "Shot / moment progress",
    "Technical notes",
    "Output versions",
  ),
  "final-video": common(
    "Final video version",
    "Client review package",
    "Changes from approved keyshots",
    "Decision notes",
  ),
  "final-delivery": common(
    "Final deliverable list",
    "Delivery method",
    "Delivery confirmation",
    "Handover notes",
  ),
};
type BatchContentItem = {
  id: string;
  publishingOrder: number;
  contentType: string;
  visualAssetCount: number;
  title: string;
  idea: string;
  hook: string;
  story: string;
  keyMessage: string;
  characterPresence: string;
  approvedWardrobeChanges: number[];
  referenceTypes: string[];
  platforms: string[];
  publishingSchedule: {
    platform: string;
    scheduledAt: string;
    order: number;
    socialConnectionId?: string;
    profileHandle?: string;
  }[];
  captionDirection: string;
  cta: string;
  visualRequirement: string;
  strategicReason: string;
  differenceFromRecentContent: string;
};
const referenceCategories = [
  { key: "character", label: "Character" },
  { key: "company_logo", label: "Company Logo" },
  { key: "product", label: "Product" },
  { key: "color_palette", label: "Color Palette" },
  { key: "props", label: "Props" },
  { key: "environment", label: "Environment" },
] as const;
const referenceLabel = (key: string) =>
  referenceCategories.find((item) => item.key === key)?.label ||
  key.replaceAll("_", " ");
function approvedReferenceTypes(p: any) {
  const approved =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "references")
        .at(-1)?.approvedContent || {},
    categories = approved.categories || {};
  return referenceCategories
    .filter((item) => Boolean(categories[item.key]?.enabled))
    .map((item) => item.key);
}
const contentTypeOptions = ["Image", "Reel", "Carousel", "Text Only"];
function normalizeContentType(value: unknown) {
  const type = String(value || "Reel");
  if (type === "Photo") return "Image";
  if (type === "Threads Article") return "Text Only";
  return contentTypeOptions.includes(type) ? type : "Image";
}
function defaultAssetCount(type: string) {
  return type === "Carousel" ? 5 : type === "Text Only" ? 0 : 1;
}
function blankBatchItem(index: number): BatchContentItem {
  return {
    id: `content_${index}`,
    publishingOrder: index,
    contentType: "Reel",
    visualAssetCount: 1,
    title: "",
    idea: "",
    hook: "",
    story: "",
    keyMessage: "",
    characterPresence: "Human Present",
    approvedWardrobeChanges: [],
    referenceTypes: [],
    platforms: [],
    publishingSchedule: [],
    captionDirection: "",
    cta: "",
    visualRequirement: "",
    strategicReason: "",
    differenceFromRecentContent: "",
  };
}
function normalizeBatchItems(value: any): BatchContentItem[] {
  const items = Array.isArray(value?.content_items)
    ? value.content_items
    : Array.isArray(value?.items)
      ? value.items
      : [];
  return items.map((item: any, index: number) => {
    const type = normalizeContentType(item.contentType || item.content_type),
      sourcePlatforms = Array.isArray(item.platforms)
        ? item.platforms
        : Array.isArray(item.plannedPlatforms)
          ? item.plannedPlatforms
          : Array.isArray(item.planned_platforms)
            ? item.planned_platforms
            : [],
      platforms = [
        ...new Set(
          sourcePlatforms
            .map(canonicalSocialPlatform)
            .filter((platform: string) =>
              platformAllowedForContent(platform, type),
            ),
        ),
      ],
      rawSchedule = Array.isArray(item.publishingSchedule)
        ? item.publishingSchedule
        : Array.isArray(item.publishing_schedule)
          ? item.publishing_schedule
          : [];
    return {
      ...blankBatchItem(index + 1),
      ...item,
      id: String(
        item.id || item.contentId || item.content_id || `content_${index + 1}`,
      ),
      publishingOrder: Number(
        item.publishingOrder || item.publishing_order || index + 1,
      ),
      contentType: type,
      visualAssetCount: Math.max(
        0,
        Number(
          item.visualAssetCount ??
            item.visual_asset_count ??
            item.assetCount ??
            defaultAssetCount(type),
        ),
      ),
      keyMessage: String(item.keyMessage || item.key_message || ""),
      characterPresence: String(
        item.characterPresence || item.character_presence || "Human Present",
      ),
      approvedWardrobeChanges: (Array.isArray(item.approvedWardrobeChanges)
        ? item.approvedWardrobeChanges
        : Array.isArray(item.approved_wardrobe_changes)
          ? item.approved_wardrobe_changes
          : []
      ).map(Number),
      referenceTypes: Array.isArray(item.referenceTypes)
        ? item.referenceTypes
        : Array.isArray(item.reference_types)
          ? item.reference_types
          : [],
      platforms: [],
      publishingSchedule: [],
      captionDirection: String(
        item.captionDirection || item.caption_direction || "",
      ),
      visualRequirement: String(
        item.visualRequirement || item.visual_requirement || "",
      ),
      strategicReason: String(
        item.strategicReason ||
          item.strategic_reason ||
          item.strategicPurpose ||
          "",
      ),
      differenceFromRecentContent: String(
        item.differenceFromRecentContent ||
          item.difference_from_recent_content ||
          "",
      ),
    };
  });
}
function recommendedInternalCount(p: any) {
  const text = JSON.stringify({
      p,
      brief:
        (p.approvedSnapshots || [])
          .filter((x: any) => x.phaseKey === "client-brief")
          .at(-1)?.approvedContent || {},
    }),
    range = text.match(
      /(\d+)\s*[-–~]\s*(\d+)[^\n]{0,30}(?:week|weekly|星期|周)/i,
    );
  if (range)
    return Math.max(
      1,
      Math.round((Number(range[1]) + Number(range[2])) / 2) * 2,
    );
  const weekly = text.match(
    /(\d+)[^\n]{0,25}(?:times?|posts?|contents?)[^\n]{0,15}(?:week|weekly|星期|周)/i,
  );
  return weekly ? Math.max(1, Number(weekly[1]) * 2) : 6;
}
function currentReelsBatch(p: any) {
  const batches = (p.batches || [])
    .slice()
    .sort((a: any, b: any) => a.batchNumber - b.batchNumber);
  return (
    batches.find((x: any) => x.status === "Active") ||
    batches.find((x: any) => x.status !== "Completed") ||
    batches[0]
  );
}
function reelsIdeaFields(p: any): Field[] {
  const batch = currentReelsBatch(p),
    count = Math.max(1, Number(batch?.plannedCount || 1));
  return [
    common("Batch objective")[0],
    ...Array.from({ length: count }, (_, i) => ({
      key: `reel_${String(i + 1).padStart(2, "0")}`,
      label: `Reel ${String(i + 1).padStart(2, "0")} — Idea / Hook / Story`,
      placeholder:
        "Autofill or write this Reel's complete Idea, Hook, Story, Payoff and production direction…",
    })),
    common("Batch gate notes")[0],
  ];
}
function isAssetPhase(key: string) {
  return (
    !["reel-video-production", "publishing"].includes(key) &&
    /(keyshot|image|video|production|song|delivery)/.test(key)
  );
}
function source(p: any, key: string) {
  return (
    (p.phaseRecords || []).find((x: any) => x.phaseKey === key)?.data || {}
  );
}
function aiDraft(p: any, key: string) {
  const brief = `${p.projectGoal || "the project goal"}; ${p.keyMessage || "the key message"}`;
  let generated: Record<string, any> = {};
  if (key === "creative-direction")
    generated = {
      creative_concept: `Build one clear creative proposition around ${p.keyMessage || p.projectGoal || "the audience problem"}, using the strongest opportunity identified in the research rather than repeating the brief.`,
      audience_response_goal: `Move ${p.audience || "the target audience"} from recognition of the problem to confidence in the proposed solution.`,
      story_approach:
        "Open with a visually immediate tension, reveal the product or brand as the controlled answer, then finish with a memorable proof point and action.",
      visual_language:
        "Premium cinematic realism with purposeful composition, restrained brand cues and consistent visual continuity.",
      tone_mood_and_pacing:
        "Confident, contemporary and emotionally clear; fast enough to retain attention but with deliberate hero moments.",
      execution_rules:
        "Every shot must advance the story, preserve identity and product accuracy, and avoid generic filler visuals.",
    };
  if (key === "script")
    generated = {
      story_outline: `A concise beginning–development–payoff story built around ${brief}.`,
      narrative_flow:
        "Opening hook establishes the audience tension. The middle demonstrates the transformation through escalating visual proof. The final beat resolves the promise and lands the CTA.",
      script_dialogue:
        "Write only dialogue or voice-over that adds information the image cannot communicate. Keep lines natural, short and timed to the project duration.",
      meaning_and_premise: `The premise turns ${p.projectGoal || "the client objective"} into a human, visually understandable transformation.`,
      client_facing_rationale:
        "This structure protects clarity, retention and brand recall while remaining practical for AI production.",
    };
  if (key === "idea-hook-story") {
    const batch = currentReelsBatch(p),
      count = Math.max(1, Number(batch?.plannedCount || 1)),
      latest = (phaseKey: string) =>
        (p.approvedSnapshots || [])
          .filter((x: any) => x.phaseKey === phaseKey)
          .at(-1)?.approvedContent || {},
      approvedBrief = latest("client-brief"),
      research = latest("market-research"),
      brand =
        approvedBrief.client_brand ||
        approvedBrief.client ||
        p.client ||
        "the brand",
      goal =
        approvedBrief.project_goal ||
        p.projectGoal ||
        "the approved project goal",
      message =
        approvedBrief.key_message_offer ||
        approvedBrief.key_message ||
        p.keyMessage ||
        "the approved key message",
      audience =
        approvedBrief.target_audience || p.audience || "the target audience",
      insight =
        research.audience_insight ||
        research.audience_tensions_desires ||
        "the approved audience need",
      opportunity =
        research.current_opportunities || "the approved market opportunity";
    generated.batch_objective = `Batch ${batch?.batchNumber || 1}: create ${count} distinct Reel${count === 1 ? "" : "s"} that move ${audience} toward ${goal}, while using ${opportunity}.`;
    const patterns = [
      {
        format: "Visual transformation",
        hook: "Open on the audience's recognisable frustration before revealing an unexpected visual change.",
        story:
          "Show the problem in one immediate action, introduce the brand or product as the catalyst, then resolve with a visible before-to-after payoff.",
        difference:
          "Transformation-led; strongest contrast and visual reveal in this Batch.",
      },
      {
        format: "Behavioural observation",
        hook: "Begin with a small real-life behaviour the audience instantly recognises, without explaining it first.",
        story:
          "Follow the behaviour to its consequence, introduce a smarter choice, and end on a satisfying proof moment that makes the message memorable.",
        difference:
          "Observation-led; more relatable and human than the other Batch concepts.",
      },
      {
        format: "Curiosity reveal",
        hook: "Hide the answer in the opening moment and let one unusual detail create immediate curiosity.",
        story:
          "Escalate clues through simple cause and effect, reveal the approved message at the turning point, and close on a clear branded payoff.",
        difference:
          "Mystery-led; uses delayed information rather than direct explanation.",
      },
      {
        format: "Fast demonstration",
        hook: "Start with the result first, then challenge the viewer to understand how it happened.",
        story:
          "Reverse-engineer the result through concise visual steps and finish by reconnecting the proof to the audience need.",
        difference:
          "Proof-led; practical and energetic with minimal narrative complexity.",
      },
    ];
    for (let i = 0; i < count; i++) {
      const pattern = patterns[i % patterns.length],
        number = String(i + 1).padStart(2, "0");
      generated[`reel_${number}`] = [
        `CONTENT TITLE: ${brand} — ${pattern.format}`,
        `IDEA: Turn ${insight} into a short-form ${pattern.format.toLowerCase()} concept that communicates ${message}.`,
        `HOOK: ${pattern.hook}`,
        `STORY: ${pattern.story}`,
        `PAYOFF: The final image makes ${goal} feel achievable and connects it clearly to ${brand}.`,
        `KEY MESSAGE: ${message}`,
        `FORMAT: ${pattern.format} Reel`,
        `ESTIMATED DURATION: Use the confirmed project duration range; NEEDS CONFIRMATION if not set.`,
        `CAPTION DIRECTION: Reinforce the audience insight in natural language without repeating the visual story word for word.`,
        `CTA: Use only the approved CTA or mark NEEDS CONFIRMATION.`,
        `VISUAL REQUIREMENT: One clear location, minimal cast, recognisable action, strong first-frame readability and consistent product/brand continuity.`,
        `CHARACTER PRESENCE: NEEDS CONFIRMATION — choose Human Present, No Face or No Human during handler edit.`,
        `REFERENCE DIRECTION: Use only approved brand, character, product and environment references.`,
        `STRATEGIC REASON: Uses approved Brief and Research to convert ${opportunity} into an executable Reel.`,
        `DIFFERENCE FROM OTHER REELS: ${pattern.difference}`,
      ].join("\n");
    }
    generated.batch_gate_notes =
      "All Idea / Hook / Story items in this 2-Week Batch must receive approval before production begins.";
  }
  if (key === "strategy-direction") {
    const latest = (phaseKey: string) =>
        (p.approvedSnapshots || [])
          .filter((x: any) => x.phaseKey === phaseKey)
          .at(-1)?.approvedContent || {},
      approvedBrief = latest("client-brief"),
      research = latest("market-research"),
      brand =
        approvedBrief.client_brand ||
        approvedBrief.client ||
        p.client ||
        "the account",
      goal =
        approvedBrief.project_goal ||
        p.projectGoal ||
        "the approved account objective",
      audience =
        approvedBrief.target_audience || p.audience || "the approved audience",
      opportunity =
        research.current_opportunities || "the approved market opportunity";
    generated = {
      strategic_objective: `Use the next 2-Week Batch to move ${audience} toward ${goal} while testing ${opportunity}.`,
      performance_learning:
        "NEEDS CONFIRMATION — enter verified performance observations from the previous Batch; do not invent results.",
      content_pillars: `1. Audience value linked to ${goal}\n2. Identity-building content for ${brand}\n3. A controlled creative test based on the approved Research`,
      format_mix:
        "Agent to recommend the most useful mix for this Batch; no fixed monthly quota applies.",
      visual_direction:
        "Preserve the approved account identity and build a recognisable, repeatable visual system across the Batch.",
      tone_of_voice:
        approvedBrief.tone_visual_direction ||
        p.tone ||
        "Follow the approved Brief; NEEDS CONFIRMATION if no tone is approved.",
      current_direction_decision: "KEEP CURRENT DIRECTION",
      management_rationale:
        "No verified previous-Batch performance currently justifies a strategic adjustment. Management must review this decision before Batch ideas are created.",
      next_batch_testing_priorities: `Test one clear opportunity: ${opportunity}. Keep other variables controlled so the result is useful.`,
      must_preserve:
        approvedBrief.must_include ||
        "Approved identity, positioning and continuity.",
      must_avoid:
        approvedBrief.must_avoid ||
        p.restrictions ||
        "Unapproved claims, identity drift and mid-Batch strategy changes.",
      ai_influencer_identity_persona:
        approvedBrief.brand_product_background ||
        "NEEDS CONFIRMATION — define the influencer persona, values and recognisable traits.",
      character_continuity_requirements:
        "Preserve approved face identity, body proportions, signature styling, wardrobe logic and recurring visual markers across all content.",
    };
  }
  if (key === "batch-ideas") {
    const latest = (phaseKey: string) =>
        (p.approvedSnapshots || [])
          .filter((x: any) => x.phaseKey === phaseKey)
          .at(-1)?.approvedContent || {},
      approvedBrief = latest("client-brief"),
      research = latest("market-research"),
      strategy = latest("strategy-direction"),
      brand =
        approvedBrief.client_brand ||
        approvedBrief.client ||
        p.client ||
        "the account",
      goal =
        strategy.strategic_objective ||
        approvedBrief.project_goal ||
        p.projectGoal ||
        "the approved objective",
      pillars = strategy.content_pillars || "the approved content pillars";
    const count = recommendedInternalCount(p),
      targetBatch = selectSocialProductionBatch(p.batches || []),
      timeZone = projectTimezone(p),
      localToday = timezoneInputValue(new Date().toISOString(), timeZone).slice(0, 10),
      tomorrow = new Date(`${localToday}T12:00:00.000Z`),
      tomorrowLocal = (tomorrow.setUTCDate(tomorrow.getUTCDate() + 1), tomorrow.toISOString().slice(0, 10)),
      batchStart = Date.parse(timezoneInputToUtc(`${targetBatch?.startsAt || ""}T20:00`, timeZone)),
      types = ["Reel", "Image", "Carousel", "Text Only"],
      references = approvedReferenceTypes(p),
      hooks = [
        "Open with a visually surprising action before any explanation.",
        "Begin with one recognisable real-life moment the audience immediately understands.",
        "Lead with a curiosity question expressed through the first image.",
        "Show the result first, then reveal how the character arrived there.",
      ],
      stories = [
        "Set up one tension, show one clear change, and finish with a visual payoff.",
        "Follow a relatable moment into a small decision that expresses the approved identity.",
        "Move from hook to useful information and close with a simple CTA.",
        "Use concise cause and effect, then land the key message through action rather than exposition.",
      ];
    const contentItems = Array.from({ length: count }, (_, i) => {
      const type = types[i % types.length],
        referenceTypes = references.filter(
          (key) =>
            key === "color_palette" ||
            key === "character" ||
            (i % 3 === 0 && ["company_logo", "product"].includes(key)) ||
            (i % 2 === 0 && ["props", "environment"].includes(key)),
        ),
        plannedPlatforms: string[] = [];
      return {
        ...blankBatchItem(i + 1),
        contentType: type,
        visualAssetCount: defaultAssetCount(type),
        title: `${brand} — Content ${String(i + 1).padStart(2, "0")}`,
        idea: `Develop one ${type} from the approved pillar set (${String(pillars)}), serving ${goal}.`,
        hook: hooks[i % hooks.length],
        story: stories[i % stories.length],
        keyMessage:
          approvedBrief.key_message_offer ||
          approvedBrief.key_message ||
          p.keyMessage ||
          "NEEDS CONFIRMATION — select an approved key message.",
        referenceTypes,
        platforms: plannedPlatforms,
        publishingSchedule: [],
        captionDirection:
          "Add useful context in natural language; do not simply narrate the visual.",
        cta: "Use only when strategically useful and based on an approved action.",
        visualRequirement:
          strategy.visual_direction ||
          "Preserve approved identity and continuity while varying setting, composition and content purpose.",
        strategicReason: `Supports the approved 2-Week objective: ${goal}.`,
        differenceFromRecentContent: `Use a distinct ${["hook mechanism", "setting", "content purpose", "emotional tone"][i % 4]} from the other items in this Batch.`,
      };
    });
    generated = {
      _productionBatchId: Number(targetBatch?.id) || null,
      batch_objective: goal,
      planned_content_quantity: contentItems.length,
      content_items: contentItems,
      batch_gate_notes:
        "Management approves the complete content plan before production begins. Finished work is delivered as versioned task files.",
    };
  }
  const formula = activeFormulaFor(key, p.projectType || p.type);
  return {
    ...generated,
    _generationMethod: "Rule-based Autofill",
    _formulaId: formula?.id || "",
    _formulaVersion: formula?.version || "",
    _originalGeneratedDraft: generated,
  } as any;
}
function exportText(p: any, phase: any) {
  const latest: Record<string, any> = {};
  for (const row of p.approvedSnapshots || [])
    latest[row.phaseKey] = row.approvedContent || {};
  const section = (title: string, data: any) => [
    title,
    ...Object.entries(data || {})
      .filter(([k]) => !k.startsWith("_"))
      .map(
        ([k, v]) =>
          `${k.replaceAll("_", " ").toUpperCase()}: ${typeof v === "object" ? JSON.stringify(v, null, 2) : v || "—"}`,
      ),
    "",
  ];
  return [
    "FRAMEFLOW PROJECT CONTEXT",
    "",
    "PROJECT METADATA",
    `Project Name: ${p.client}`,
    `Project ID: ${p.id}`,
    `Project Type: ${p.projectType || p.type}`,
    `Mode: ${p.projectMode || p.projectNature || "—"}`,
    `Purpose: ${p.purpose || "—"}`,
    `Duration: ${p.projectDuration || "—"}`,
    `Platforms: ${JSON.stringify(p.projectConfig?.authorizedPlatforms || [])}`,
    `Deliverables: ${p.deliverables || "—"}`,
    "",
    ...section("APPROVED CLIENT BRIEF", latest["client-brief"]),
    ...section(
      "APPROVED MARKET RESEARCH",
      latest["market-research"] || latest["research-style"],
    ),
    ...section("APPROVED PROJECT REFERENCES", latest["references"]),
    ...section(
      "APPROVED CREATIVE DIRECTION",
      latest["creative-direction"] ||
        latest["strategy-direction"] ||
        latest["monthly-direction"] ||
        latest["mv-direction"],
    ),
    ...section(
      "APPROVED SCRIPT / IDEA / SONG / VISUAL CONCEPT",
      latest["script"] ||
        latest["idea-hook-story"] ||
        latest["batch-ideas"] ||
        latest["lyrics-style"] ||
        latest["storyboard-keyshots"],
    ),
    "CURRENT CONTINUITY REQUIREMENTS",
    String(
      (
        latest["creative-direction"] ||
        latest["mv-direction"] ||
        latest["references"] ||
        {}
      ).continuity_requirements ||
        (latest["references"] || {}).referenceRule ||
        "—",
    ),
    "",
    "PRODUCTION CONSTRAINTS",
    `Duration: ${p.projectDuration || "—"}`,
    `Restrictions: ${p.restrictions || "—"}`,
    "",
    "ASSET REFERENCES",
    "Approved Project Reference files are stored by category and linked through the generation manifest.",
    "",
    `CURRENT PHASE\n${phase.label}`,
    "",
    "CURRENT PHASE INPUT CONTEXT",
    "Only the latest Approved upstream snapshots listed above are authoritative.",
  ].join("\n");
}

function BatchPlanEditor({
  p,
  draft,
  setDraft,
  editable,
  reviewing,
  management,
  fieldReviews,
  setFieldReviews,
  feedback,
  acceptedFields,
}: {
  p: any;
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
  reviewing: boolean;
  management: boolean;
  fieldReviews: Record<string, { decision: string; note: string }>;
  setFieldReviews: any;
  feedback: Record<string, string>;
  acceptedFields: string[];
}) {
  const items = normalizeBatchItems(draft),
    objective = String(
      draft.batch_objective || draft["2_week_batch_objective"] || "",
    ),
    availableReferences = approvedReferenceTypes(p);
  const commit = (next: BatchContentItem[]) =>
    setDraft((current: any) => ({
      ...current,
      content_items: next.map((item, index) => ({
        ...item,
        publishingOrder: index + 1,
      })),
      planned_content_quantity: next.length,
    }));
  const update = (index: number, patch: Partial<BatchContentItem>) =>
    commit(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  return (
    <div className="batch-plan-editor">
      <div className="batch-plan-intro">
        <div>
          <small>2-WEEK CONTENT PLAN</small>
          <h4>The Agent decides what to create and which content style fits.</h4>
          <p>
            Choose Image, Reel, Carousel or Text Only. Platform selection and
            this production workflow does not ask for a destination or publishing schedule.
          </p>
        </div>
        <strong>
          {items.length}
          <span>planned contents</span>
        </strong>
      </div>
      <label className="batch-objective">
        <b>Batch objective</b>
        <textarea
          disabled={!editable}
          value={objective}
          onChange={(e) =>
            setDraft((x: any) => ({ ...x, batch_objective: e.target.value }))
          }
          placeholder="What should this 2-Week Batch achieve?"
        />
      </label>
      <div className="batch-plan-heading">
        <div>
          <b>Content order</b>
          <small>Each item becomes a versioned task file after production.</small>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => commit([...items, blankBatchItem(items.length + 1)])}
          >
            ＋ Add content
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="empty-batch-plan">
          <b>No Content Items planned yet.</b>
          <span>
            Use Autofill for a rule-based starting plan, or add the first
            Content Item manually.
          </span>
        </div>
      ) : (
        <div className="batch-content-list">
          {items.map((item, index) => {
            const reviewKey = `content_items.${item.id}`,
              locked = acceptedFields.includes(reviewKey),
              decision = fieldReviews[reviewKey]?.decision;
            return (
              <details
                className={`batch-content-card collapsible-content-card ${decision ? `review-${decision}` : ""} ${locked ? "review-accepted" : ""}`}
                key={`${item.id}-${index}`}
              >
                <summary>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div className="batch-card-summary-title">
                    <b>{item.title || "Untitled Content"}</b>
                    <small>{item.contentType} · {item.visualAssetCount} {item.contentType === "Carousel" ? "slides" : item.contentType === "Reel" ? "keyframe" : item.contentType === "Text Only" ? "visuals" : "image"}</small>
                  </div>
                  <div className="batch-card-summary-copy">
                    <p>
                      <b>Idea</b>
                      {item.idea || "No idea written yet"}
                    </p>
                    <p>
                      <b>Hook</b>
                      {item.hook || "No hook written yet"}
                    </p>
                  </div>
                  <i>⌄</i>
                </summary>
                <div className="batch-content-expanded">
                  <div className="batch-content-fields">
                    <label>
                      <b>Content style</b>
                      <select
                        disabled={!editable || locked}
                        value={item.contentType}
                        onChange={(e) => { const type=e.target.value; update(index,{contentType:type,visualAssetCount:defaultAssetCount(type),platforms:[],publishingSchedule:[]}); }}
                      >
                        {contentTypeOptions.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <b>Content title</b>
                      <input
                        disabled={!editable || locked}
                        value={item.title}
                        onChange={(e) =>
                          update(index, { title: e.target.value })
                        }
                        placeholder="Working title"
                      />
                    </label>
                    <label>
                      <b>
                        {item.contentType === "Carousel"
                          ? "Carousel slides"
                          : item.contentType === "Reel"
                            ? "Keyframe images"
                            : item.contentType === "Text Only"
                              ? "Supporting images (optional)"
                              : "Image count"}
                      </b>
                      <input
                        disabled={!editable || locked}
                        type="number"
                        min={item.contentType === "Text Only" ? 0 : 1}
                        max={
                          item.contentType === "Carousel"
                            ? 20
                            : item.contentType === "Text Only"
                              ? 3
                              : 10
                        }
                        value={item.visualAssetCount}
                        onChange={(e) =>
                          update(index, {
                            visualAssetCount: Math.max(
                              0,
                              Number(e.target.value || 0),
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  <fieldset
                    className="content-reference-selector"
                    disabled={!editable || locked}
                  >
                    <legend>References Agent must use for this Content</legend>
                    {availableReferences.length ? (
                      <>
                        <div className="platform-choice-row">
                          {availableReferences.map((reference) => (
                            <label key={reference}>
                              <input
                                type="checkbox"
                                checked={item.referenceTypes.includes(
                                  reference,
                                )}
                                onChange={(e) =>
                                  update(index, {
                                    referenceTypes: e.target.checked
                                      ? [...item.referenceTypes, reference]
                                      : item.referenceTypes.filter(
                                          (x) => x !== reference,
                                        ),
                                  })
                                }
                              />
                              {referenceLabel(reference)}
                            </label>
                          ))}
                        </div>
                        <small>
                          Leave all unchecked when this Content should be
                          generated freely.
                        </small>
                      </>
                    ) : (
                      <small>
                        No fixed Project References are enabled. Agent may
                        design every visual element freely.
                      </small>
                    )}
                  </fieldset>
                  <div className="batch-content-fields batch-content-copy">
                    <label>
                      <b>Idea</b>
                      <textarea
                        disabled={!editable || locked}
                        value={item.idea}
                        onChange={(e) =>
                          update(index, { idea: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <b>Hook</b>
                      <textarea
                        disabled={!editable || locked}
                        value={item.hook}
                        onChange={(e) =>
                          update(index, { hook: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <b>Story / post structure</b>
                      <textarea
                        disabled={!editable || locked}
                        value={item.story}
                        onChange={(e) =>
                          update(index, { story: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <b>Key message</b>
                      <textarea
                        disabled={!editable || locked}
                        value={item.keyMessage}
                        onChange={(e) =>
                          update(index, { keyMessage: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="batch-content-fields">
                    <label>
                      <b>Character presence</b>
                      <select
                        disabled={!editable || locked}
                        value={item.characterPresence}
                        onChange={(e) =>
                          update(index, { characterPresence: e.target.value })
                        }
                      >
                        {["Human Present", "No Face", "No Human"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <b>Caption direction</b>
                      <input
                        disabled={!editable || locked}
                        value={item.captionDirection}
                        onChange={(e) =>
                          update(index, { captionDirection: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <b>CTA</b>
                      <input
                        disabled={!editable || locked}
                        value={item.cta}
                        onChange={(e) => update(index, { cta: e.target.value })}
                      />
                    </label>
                    <label>
                      <b>Visual requirement</b>
                      <input
                        disabled={!editable || locked}
                        value={item.visualRequirement}
                        onChange={(e) =>
                          update(index, { visualRequirement: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <details className="batch-strategy-notes">
                    <summary>Strategy notes</summary>
                    <div className="batch-content-fields">
                      <label>
                        <b>Strategic reason</b>
                        <textarea
                          disabled={!editable || locked}
                          value={item.strategicReason}
                          onChange={(e) =>
                            update(index, { strategicReason: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <b>Difference from recent content</b>
                        <textarea
                          disabled={!editable || locked}
                          value={item.differenceFromRecentContent}
                          onChange={(e) =>
                            update(index, {
                              differenceFromRecentContent: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  </details>
                  {feedback[reviewKey] && (
                    <div className="field-retake-feedback">
                      <small>
                        RETAKE REVIEW FOR CONTENT{" "}
                        {String(index + 1).padStart(2, "0")}
                      </small>
                      <p>{feedback[reviewKey]}</p>
                    </div>
                  )}
                  {reviewing && management && !locked && (
                    <InlineFieldReview
                      fieldKey={reviewKey}
                      reviewLabel={`Content ${String(index + 1).padStart(2, "0")}`}
                      state={fieldReviews[reviewKey]}
                      setState={(value) =>
                        setFieldReviews((current: any) => ({
                          ...current,
                          [reviewKey]: value,
                        }))
                      }
                    />
                  )}{" "}
                  {reviewing && locked && (
                    <div className="review-locked-note">
                      ✓ Accepted in the previous review · locked
                    </div>
                  )}
                  {editable && !locked && (
                    <button
                      className="remove-content-item"
                      type="button"
                      onClick={() =>
                        commit(items.filter((_, i) => i !== index))
                      }
                    >
                      Remove this Content Item
                    </button>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
      <label className="batch-gate-notes">
        <b>Batch gate notes</b>
        <textarea
          disabled={!editable}
          value={String(draft.batch_gate_notes || "")}
          onChange={(e) =>
            setDraft((x: any) => ({ ...x, batch_gate_notes: e.target.value }))
          }
          placeholder="Management notes for approving the complete Batch plan…"
        />
      </label>
    </div>
  );
}

function ReferenceLibraryEditor({
  draft,
  setDraft,
  editable,
  upload,
  files,
  uploading,
  uploadStatus,
}: {
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
  upload: (
    selected: FileList | null,
    itemKey?: string,
    replaceSet?: boolean,
  ) => Promise<void>;
  files: any[];
  uploading: boolean;
  uploadStatus: string;
}) {
  const categories =
      draft.categories && typeof draft.categories === "object"
        ? draft.categories
        : {},
    update = (key: string, patch: Record<string, any>) =>
      setDraft((current: any) => ({
        ...current,
        categories: {
          ...(current.categories || {}),
          [key]: {
            enabled: false,
            notes: "",
            ...(current.categories?.[key] || {}),
            ...patch,
          },
        },
        referenceRule:
          "Only enabled categories are continuity-locked. Disabled categories may be designed freely by Agent for each Content Item.",
      }));
  return (
    <div className="reference-library">
      <div className="reference-library-intro">
        <div>
          <small>SOCIAL PROJECT REFERENCE LIBRARY · TIER 0–1 CONTROL</small>
          <h4>Switch on only what must stay consistent.</h4>
          <p>
            Enabled references are continuity-locked and available to Agent.
            Tier 0–1 may replace the current image set at any time; older
            versions remain in history and are never sent to new Agent jobs.
          </p>
        </div>
        <strong>
          {
            referenceCategories.filter((item) =>
              Boolean(categories[item.key]?.enabled),
            ).length
          }
          <span>enabled</span>
        </strong>
      </div>
      {uploadStatus && (
        <div
          className={`upload-status ${uploadStatus.startsWith("Upload failed") ? "error" : "success"}`}
        >
          {uploadStatus}
        </div>
      )}
      <div className="reference-category-grid">
        {referenceCategories.map((item) => {
          const state = categories[item.key] || { enabled: false, notes: "" },
            itemKey = `${item.key}-reference`,
            uploaded = files.filter(
              (file) =>
                file.itemKey === itemKey && Number(file.isCurrent) !== 0,
            );
          return (
            <article className={state.enabled ? "enabled" : ""} key={item.key}>
              <header>
                <div>
                  <b>{item.label}</b>
                  <small>{uploaded.length}/4 current HD images</small>
                </div>
                <label className="reference-switch">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={Boolean(state.enabled)}
                    onChange={(e) =>
                      update(item.key, { enabled: e.target.checked })
                    }
                  />
                  <span>{state.enabled ? "Required" : "Free"}</span>
                </label>
              </header>
              <p>
                {state.enabled
                  ? "Agent must preserve and attach this reference when a Content Item selects it."
                  : "Agent may create this element freely when needed."}
              </p>
              {state.enabled && (
                <>
                  <label>
                    <b>Reference guidance</b>
                    <textarea
                      disabled={!editable}
                      value={String(state.notes || "")}
                      onChange={(e) =>
                        update(item.key, { notes: e.target.value })
                      }
                      placeholder={`What must Agent preserve from the ${item.label.toLowerCase()} references?`}
                    />
                  </label>
                  {editable && uploaded.length < 4 && (
                    <label className="canonical-drop compact reference-upload">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(e) => {
                          if (
                            uploaded.length + (e.target.files?.length || 0) >
                            4
                          ) {
                            window.alert(
                              `${item.label} allows a maximum of 4 images.`,
                            );
                            return;
                          }
                          upload(e.target.files, itemKey);
                        }}
                      />
                      <b>
                        {uploading
                          ? "Uploading to FrameFlow + Drive…"
                          : "＋ Add reference images"}
                      </b>
                      <small>PNG, JPG or WEBP · maximum 4 current images</small>
                    </label>
                  )}
                  {editable && uploaded.length > 0 && (
                    <label className="canonical-drop compact reference-upload replace">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(e) => {
                          if ((e.target.files?.length || 0) > 4) {
                            window.alert(
                              `${item.label} allows a maximum of 4 images.`,
                            );
                            return;
                          }
                          upload(e.target.files, itemKey, true);
                        }}
                      />
                      <b>
                        {uploading
                          ? "Replacing current set…"
                          : "↻ Replace current reference set"}
                      </b>
                      <small>
                        Creates new versions · previous files remain in history
                      </small>
                    </label>
                  )}
                  <div className="production-media-grid">
                    {uploaded.map((file) => (
                      <ProductionMediaPreview key={file.id} file={file} />
                    ))}
                  </div>
                  {!uploaded.length && (
                    <div className="production-media-missing">
                      Upload at least one image before submitting this enabled
                      category.
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <div className="reference-library-rule">
        <b>How Agent uses this library</b>
        <span>
          In 2-Week Batch Ideas, every Content Item selects only the reference
          categories it actually needs. Those exact current files then follow
          the Content into image and Reel generation.
        </span>
      </div>
    </div>
  );
}

type ProductionAsset = {
  assetNumber: number;
  assetRole: string;
  subjectPresence: string;
  shotPurpose: string | null;
  wardrobe: ReturnType<typeof normalizeWardrobe>;
  visualPrompt: VisualPromptArchitecture;
  imageGenerationPrompt: string;
  referenceTypes: string[];
  referenceAssets: any[];
  continuityWithFirstImage: boolean;
  generationQuality: "low" | "medium" | "high";
  generationResolution: "512" | "1K";
  maxInputReferences: 2;
};
type ProductionItem = {
  contentId: string;
  contentType: string;
  title: string;
  hook: string;
  caption: string;
  hashtags: string;
  approvedWardrobeChanges: number[];
  referenceTypes: string[];
  assets: ProductionAsset[];
};
function normalizeProductionItems(
  draft: any,
  approved: BatchContentItem[],
): ProductionItem[] {
  const generated = Array.isArray(draft.production_items)
    ? draft.production_items
    : Array.isArray(draft.items)
      ? draft.items
      : [];
  return approved.map((sourceItem, index) => {
    const found =
      generated.find(
        (x: any) => String(x.contentId || x.content_id) === sourceItem.id,
      ) ||
      generated[index] ||
      {};
    const count = Math.max(0, sourceItem.visualAssetCount);
    const existing = Array.isArray(found.assets) ? found.assets : [];
    const referenceTypes = Array.isArray(found.referenceTypes)
        ? found.referenceTypes
        : sourceItem.referenceTypes,
      referenceAssets = Array.isArray(found.referenceAssets)
        ? found.referenceAssets
        : [];
    let anchorArchitecture: VisualPromptArchitecture | null = null;
    return {
      contentId: sourceItem.id,
      contentType: sourceItem.contentType,
      title: String(found.title || sourceItem.title || `Content ${index + 1}`),
      hook: String(found.hook || sourceItem.hook || ""),
      caption: String(found.caption || ""),
      hashtags: String(found.hashtags || ""),
      approvedWardrobeChanges: sourceItem.approvedWardrobeChanges,
      referenceTypes,
      assets: Array.from({ length: count }, (_, assetIndex) => {
        const asset = existing[assetIndex] || {};
        const continuityWithFirstImage =
            assetIndex > 0 &&
            Boolean(
              asset.continuityWithFirstImage ??
              asset.continuity_with_first_image,
            ),
          maxProjectReferences = continuityWithFirstImage ? 1 : 2;
        const wardrobe = normalizeWardrobe(asset.wardrobe),
          subjectPresence = String(
            asset.subjectPresence ||
              asset.subject_presence ||
              sourceItem.characterPresence,
          ),
          visualPrompt = normalizeVisualPromptArchitecture(
            {
              ...asset.visualPrompt,
              shotPurpose:
                asset.shotPurpose ||
                asset.shot_purpose ||
                asset.visualPrompt?.shotPurpose,
            },
            {
              source: sourceItem as any,
              contentId: sourceItem.id,
              assetNumber: assetIndex + 1,
              assetRole: String(asset.assetRole || asset.asset_role || ""),
              subjectPresence,
              wardrobe,
              referenceTypes: Array.isArray(asset.referenceTypes)
                ? asset.referenceTypes
                : referenceTypes,
              approvedAnchor: continuityWithFirstImage,
              anchorArchitecture,
            },
          );
        if (assetIndex === 0) anchorArchitecture = visualPrompt;
        return {
          assetNumber: assetIndex + 1,
          assetRole: String(
            asset.assetRole ||
              asset.asset_role ||
              (sourceItem.contentType === "Carousel"
                ? `Slide ${assetIndex + 1}`
                : sourceItem.contentType === "Reel"
                  ? "Hero keyframe"
                  : `Photo ${assetIndex + 1}`),
          ),
          subjectPresence,
          shotPurpose: visualPrompt.shotPurpose,
          wardrobe,
          visualPrompt,
          imageGenerationPrompt: visualPrompt.compiledFinalPrompt,
          referenceTypes: (() => {
            const selected = referenceTypesFromSwitches(
              visualPrompt.referenceSwitches,
            );
            return selected.includes("character")
              ? ["character"]
              : selected.slice(0, maxProjectReferences);
          })(),
          referenceAssets: Array.isArray(asset.referenceAssets)
            ? asset.referenceAssets
            : referenceAssets,
          continuityWithFirstImage,
          generationQuality:
            asset.generationQuality === "high" ||
            asset.generation_quality === "high"
              ? "high"
              : asset.generationQuality === "medium" ||
                  asset.generation_quality === "medium"
                ? "medium"
                : "low",
          generationResolution: "1K",
          maxInputReferences: 2,
        };
      }),
    };
  });
}
function ProductionMediaPreview({ file }: { file: any }) {
  const src = `/api/uploads?file=${encodeURIComponent(file.storageKey)}`,
    mime = String(file.mimeType || ""),
    name = String(file.fileName || ""),
    image = mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name),
    video = mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(name),
    upscale = String(file.upscaleStatus || "");
  return (
    <figure className="production-media-preview">
      {image ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={file.fileName} />
        </a>
      ) : video ? (
        <video controls preload="metadata" src={src} />
      ) : (
        <a
          className="production-file-only"
          href={src}
          target="_blank"
          rel="noreferrer"
        >
          Open file
        </a>
      )}
      <figcaption>
        <span>{file.fileName}</span>
        <small>
          v{file.version} ·{" "}
          {file.assetPurpose === "UPSCALED_MASTER"
            ? "Upscaled master"
            : upscale
              ? upscale.replaceAll("_", " ")
              : file.driveSyncStatus}
        </small>
        {file.upscaleError && (
          <small className="error">{file.upscaleError}</small>
        )}
        <small>{file.uploadedBy ? `Uploaded by ${file.uploadedBy}` : "FrameFlow task file"}{file.createdAt ? ` · ${new Date(file.createdAt).toLocaleDateString()}` : ""}</small>
        <a className="task-file-download" href={src} download={file.fileName}>Download file ↓</a>
      </figcaption>
    </figure>
  );
}
function ContentProductionEditor({
  p,
  draft,
  setDraft,
  editable,
  files,
  uploadStatus,
  reviewing,
  management,
  fieldReviews,
  setFieldReviews,
  feedback,
  acceptedFields,
  act,
}: {
  p: any;
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
  files: any[];
  uploadStatus: string;
  reviewing: boolean;
  management: boolean;
  fieldReviews: Record<string, { decision: string; note: string }>;
  setFieldReviews: any;
  feedback: Record<string, string>;
  acceptedFields: string[];
  act: (id: string, b: Record<string, string>) => void;
}) {
  const approved =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "batch-ideas")
        .at(-1)?.approvedContent || {},
    referenceSnapshot =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "references")
        .at(-1)?.approvedContent || {},
    availableReferences = Object.entries(referenceSnapshot.categories || {})
      .filter(([, value]: any) => Boolean(value?.enabled))
      .map(([key]) => key),
    sources = normalizeBatchItems(approved),
    items = normalizeProductionItems(draft, sources),
    stage =
      draft._imageReviewStage === "remaining_images"
        ? "remaining_images"
        : "first_images",
    commit = (next: ProductionItem[]) =>
      setDraft((current: any) => ({ ...current, production_items: next })),
    updateItem = (index: number, patch: Partial<ProductionItem>) =>
      commit(
        items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      ),
    updateAsset = (
      contentIndex: number,
      assetIndex: number,
      patch: Partial<ProductionAsset>,
    ) =>
      commit(
        items.map((item, i) =>
          i === contentIndex
            ? {
                ...item,
                assets: item.assets.map((asset, j) =>
                  j === assetIndex ? { ...asset, ...patch } : asset,
                ),
              }
            : item,
        ),
      );
  const saveReferences = (item: ProductionItem, asset: ProductionAsset) =>
    act(p.id, {
      action: "updateProductionReferences",
      phaseKey: "content-production",
      contentId: item.contentId,
      assetNumber: String(asset.assetNumber),
      referenceTypes: JSON.stringify(asset.referenceTypes),
      continuityWithFirstImage: String(asset.continuityWithFirstImage),
      generationQuality: asset.generationQuality,
    });
  return (
    <div className="production-guide production-editor">
      <div className={`image-review-stage ${stage}`}>
        <small>
          {stage === "first_images"
            ? "CONTENT ANCHOR QUALITY GATE"
            : "CONTINUATION VISUALS GATE"}
        </small>
        <b>
          {stage === "first_images"
            ? "Review one approved anchor per Content"
            : "Content anchors approved · review the continuation images"}
        </b>
        <span>
          Prompts are Agent production instructions and are not separate Review
          items.
        </span>
      </div>
      <div className="production-storage-strip">
        <div>
          <b>RunningHub Qwen Image 2.1</b>
          <span>
            1K generation · two role-scoped references. Character Anchors use
            the full-body diagram plus facial identity; Continuations use the
            facial identity plus the approved first Anchor.
          </span>
        </div>
        {p.driveUrl && (
          <a href={p.driveUrl} target="_blank" rel="noreferrer">
            Open linked Drive folder ↗
          </a>
        )}
      </div>
      {uploadStatus && (
        <div
          className={`upload-status ${uploadStatus.startsWith("Upload failed") ? "error" : "success"}`}
        >
          {uploadStatus}
        </div>
      )}
      <p>
        <b>Hook, Title and Caption remain separate.</b> Reference switches and
        their role instructions apply only to the next generation or Retake.
      </p>
      <div className="production-content-list">
        {items.map((item, index) => {
          const source = sources[index],
            copyKey = `production_items.${item.contentId}.copy`,
            copyLocked = acceptedFields.includes(copyKey),
            reviewCopy = stage === "first_images";
          return (
            <details
              className="production-content-card"
              open={index === 0}
              key={item.contentId}
            >
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{item.title}</b>
                  <small>
                    {item.contentType} · {item.assets.length} visual asset
                    {item.assets.length === 1 ? "" : "s"}
                  </small>
                  <p>{source?.idea || "Approved Content Idea"}</p>
                </div>
                <i>⌄</i>
              </summary>
              <div className="production-content-body">
                <div
                  className={`production-copy-review ${fieldReviews[copyKey]?.decision ? `review-${fieldReviews[copyKey].decision}` : ""} ${copyLocked ? "review-accepted" : ""}`}
                >
                  <div className="production-copy-grid">
                    <label>
                      <b>Post title</b>
                      <input disabled value={item.title} />
                    </label>
                    <label>
                      <b>Approved Hook</b>
                      <textarea disabled value={item.hook} />
                    </label>
                    <label>
                      <b>Final caption</b>
                      <textarea disabled value={item.caption} />
                    </label>
                    <label>
                      <b>Optional tags / keywords</b>
                      <textarea disabled value={item.hashtags} />
                    </label>
                  </div>
                  {feedback[copyKey] && (
                    <div className="field-retake-feedback">
                      <small>RETAKE REVIEW · CONTENT COPY</small>
                      <p>{feedback[copyKey]}</p>
                    </div>
                  )}
                  {reviewing && management && reviewCopy && !copyLocked && (
                    <InlineFieldReview
                      fieldKey={copyKey}
                      reviewLabel={`Content ${String(index + 1).padStart(2, "0")} · Copy`}
                      state={fieldReviews[copyKey]}
                      setState={(value) =>
                        setFieldReviews((current: any) => ({
                          ...current,
                          [copyKey]: value,
                        }))
                      }
                    />
                  )}{" "}
                  {copyLocked && (
                    <div className="review-locked-note">
                      ✓ Copy accepted in the Content Anchor Review · locked
                    </div>
                  )}
                </div>
                <div className="production-asset-list">
                  {item.assets.map((asset, assetIndex) => {
                    const itemKey = socialBatchAssetKey(
                        selectSocialProductionBatch(p.batches || []),
                        `${item.contentId}-asset-${asset.assetNumber}`,
                      ),
                      reviewKey = `production_items.${item.contentId}.asset.${asset.assetNumber}`,
                      uploaded = files.filter(
                        (file) =>
                          file.itemKey === itemKey &&
                          Number(file.isCurrent) !== 0,
                      ),
                      locked = acceptedFields.includes(reviewKey),
                      reviewAsset =
                        stage === "first_images"
                          ? asset.assetNumber === 1
                          : asset.assetNumber > 1,
                      queued =
                        stage === "first_images" && asset.assetNumber > 1,
                      canConfigure =
                        ((reviewing && management) || editable) && !locked,
                      projectReferenceLimit =
                        asset.assetNumber > 1 && asset.continuityWithFirstImage
                          ? 1
                          : 2,
                      promptType =
                        asset.assetNumber === 1
                          ? "Anchor Prompt"
                          : "Continuation Prompt";
                    return (
                      <article
                        className={`${fieldReviews[reviewKey]?.decision ? `review-${fieldReviews[reviewKey].decision}` : ""} ${locked ? "review-accepted" : ""} ${queued ? "generation-queued" : ""}`}
                        key={itemKey}
                      >
                        <header>
                          <div>
                            <small>
                              {promptType.toUpperCase()} ·{" "}
                              {item.contentType === "Carousel"
                                ? "CAROUSEL SLIDE"
                                : item.contentType === "Reel"
                                  ? "REEL KEYFRAME"
                                  : "PHOTO"}{" "}
                              {String(asset.assetNumber).padStart(2, "0")}
                            </small>
                            <b>{asset.assetRole}</b>
                          </div>
                          <span>
                            {queued
                              ? "Waiting for anchor approval"
                              : uploaded[0]?.assetPurpose === "UPSCALED_MASTER"
                                ? "Upscaled master ready"
                                : uploaded[0]?.upscaleStatus?.replaceAll(
                                    "_",
                                    " ",
                                  ) || `${uploaded.length} generated`}
                          </span>
                        </header>
                        <fieldset
                          className="generation-reference-controls"
                          disabled={!canConfigure}
                        >
                          <legend>
                            Generation references ·{" "}
                            {asset.referenceTypes.includes("character")
                              ? 2
                              : asset.referenceTypes.length +
                                (asset.continuityWithFirstImage ? 1 : 0)}
                            /2 reference roles
                          </legend>
                          <div className="platform-choice-row">
                            {availableReferences.map((reference) => (
                              <label key={reference}>
                                <input
                                  type="checkbox"
                                  checked={asset.referenceTypes.includes(
                                    reference,
                                  )}
                                  onChange={(e) => {
                                    if (
                                      e.target.checked &&
                                      reference !== "character" &&
                                      asset.referenceTypes.includes("character")
                                    ) {
                                      window.alert(
                                        "Character already uses both slots: full-body diagram and facial identity.",
                                      );
                                      return;
                                    }
                                    if (
                                      e.target.checked &&
                                      asset.referenceTypes.length >=
                                        projectReferenceLimit
                                    ) {
                                      window.alert(
                                        `FrameFlow currently uses two references${asset.continuityWithFirstImage ? "; the approved Anchor already uses one slot" : ""}.`,
                                      );
                                      return;
                                    }
                                    updateAsset(index, assetIndex, {
                                      referenceTypes: e.target.checked
                                        ? reference === "character"
                                          ? ["character"]
                                          : [...asset.referenceTypes, reference]
                                        : asset.referenceTypes.filter(
                                            (value) => value !== reference,
                                          ),
                                    });
                                  }}
                                />
                                {referenceLabel(reference)}
                              </label>
                            ))}
                          </div>
                          {asset.assetNumber > 1 && (
                            <label className="first-image-continuity">
                              <input
                                type="checkbox"
                                checked={asset.continuityWithFirstImage}
                                onChange={(e) =>
                                  updateAsset(index, assetIndex, {
                                    continuityWithFirstImage: e.target.checked,
                                    referenceTypes: e.target.checked
                                      ? asset.referenceTypes.includes("character")
                                        ? ["character"]
                                        : asset.referenceTypes.slice(0, 1)
                                      : asset.referenceTypes,
                                  })
                                }
                              />
                              Use approved Content Anchor Image 01 as the
                              primary continuity reference
                            </label>
                          )}
                          {canConfigure && (
                            <button
                              type="button"
                              onClick={() => saveReferences(item, asset)}
                            >
                              Save generation settings
                            </button>
                          )}
                          <small>
                            Default: lowest image size + Medium thinking + 2
                            core references. Uncheck Character for prop shots,
                            product details or any visual without a person.
                          </small>
                        </fieldset>
                        <details className="production-prompt-disclosure">
                          <summary>View Agent {promptType}</summary>
                          <textarea
                            disabled
                            value={asset.imageGenerationPrompt}
                          />
                        </details>
                        {queued && (
                          <div className="production-media-waiting">
                            Agent generates this only after every Content Anchor
                            Image is approved.
                          </div>
                        )}
                        {reviewing && reviewAsset && !uploaded.length && (
                          <div className="production-media-missing">
                            Generation output is missing. Resume the Agent task;
                            do not submit manually.
                          </div>
                        )}
                        <div className="production-media-grid">
                          {uploaded.map((file) => (
                            <ProductionMediaPreview key={file.id} file={file} />
                          ))}
                        </div>
                        {feedback[reviewKey] && (
                          <div className="field-retake-feedback">
                            <small>RETAKE REVIEW · THIS IMAGE</small>
                            <p>{feedback[reviewKey]}</p>
                          </div>
                        )}
                        {reviewing &&
                          management &&
                          reviewAsset &&
                          !locked &&
                          uploaded.length > 0 && (
                            <InlineFieldReview
                              fieldKey={reviewKey}
                              reviewLabel={`Content ${String(index + 1).padStart(2, "0")} · Image ${String(asset.assetNumber).padStart(2, "0")}`}
                              state={fieldReviews[reviewKey]}
                              setState={(value) =>
                                setFieldReviews((current: any) => ({
                                  ...current,
                                  [reviewKey]: value,
                                }))
                              }
                            />
                          )}{" "}
                        {locked && (
                          <div className="review-locked-note">
                            ✓ Image accepted in the previous Review · locked
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
type ReelVideoItem = I2VPromptItem & {
  reelStyle?: string;
  workflowId?: string | null;
  subjectPresence: string;
  firstFrame?: any;
  reference?: any;
  generationStatus?: string;
};
function fallbackVideoPrompt(item: any, batch: any) {
  const source = (normalizeBatchItems(batch).find(
    (x) => x.id === String(item.contentId),
  ) || {}) as any;
  return reelVideoPrompt(item, source);
}
function normalizeReelVideoItems(
  draft: any,
  production: any,
  batch: any,
): ReelVideoItem[] {
  const generated = Array.isArray(draft.reel_video_items)
      ? draft.reel_video_items
      : Array.isArray(draft.items)
        ? draft.items
        : [],
    reels = (
      Array.isArray(production.production_items)
        ? production.production_items
        : []
    ).filter(
      (item: any) =>
        String(item.contentType || item.content_type).toLowerCase() === "reel",
    );
  return reels.map((source: any, index: number) => {
    const found =
        generated.find(
          (x: any) =>
            String(x.contentId || x.content_id) ===
            String(source.contentId || source.content_id),
        ) ||
        generated[index] ||
        {},
      contentId = String(
        source.contentId || source.content_id || `content_${index + 1}`,
      ),
      batchSource = (normalizeBatchItems(batch).find(
        (x) => x.id === contentId,
      ) || {}) as any,
      subjectPresence = String(
        found.subjectPresence ||
          found.subject_presence ||
          source.assets?.[0]?.subjectPresence ||
          source.assets?.[0]?.subject_presence ||
          batchSource.characterPresence ||
          "HUMAN_PRESENT",
      ),
      approvedDefault =
        source.assets?.[0]?.visualPrompt?.approvedAnchorImage ||
        source.assets?.[0]?.visual_prompt?.approved_anchor_image ||
        null,
      firstFrame = found.firstFrame || found.first_frame || approvedDefault,
      reference =
        found.reference ||
        found.characterReference ||
        found.character_reference ||
        null,
      style = reelStyleDefinition(found.reelStyle || found.reelType),
      hasAgentPrompt = Boolean(
        String(
          found.compiledVideoPrompt || found.compiled_video_prompt || "",
        ).trim(),
      ),
      normalized = normalizeI2VPromptItem(found, {
        contentId,
        title: String(found.title || source.title || `Reel ${index + 1}`),
        contentIntent: batchSource,
        subjectPresence,
        firstFrameAssetId:
          Number(
            found.firstFrameAssetId ||
              found.first_frame_asset_id ||
              firstFrame?.id,
          ) || null,
        referenceAssetId:
          Number(
            found.referenceAssetId ||
              found.reference_asset_id ||
              found.characterReferenceAssetId ||
              found.character_reference_asset_id ||
              reference?.id,
          ) || null,
        referenceRole: String(
          found.referenceRole ||
            found.reference_role ||
            reference?.itemKey ||
            "PROJECT_REFERENCE",
        ),
        sourceWidth:
          Number(
            found.sourceWidth || found.source_width || firstFrame?.width,
          ) || undefined,
        sourceHeight:
          Number(
            found.sourceHeight || found.source_height || firstFrame?.height,
          ) || undefined,
      });
    return {
      ...normalized,
      compiledVideoPrompt: hasAgentPrompt ? normalized.compiledVideoPrompt : "",
      reelStyle: style?.key || "",
      workflowId: found.workflowId || style?.workflowId || null,
      subjectPresence,
      firstFrame,
      reference,
      generationStatus: String(
        found.generationStatus ||
          found.generation_status ||
          (style
            ? hasAgentPrompt && draft._reelStage === "generation"
              ? "Approved prompt · Ready for provider"
              : hasAgentPrompt
                ? "Agent prompt ready"
                : "Awaiting Agent prompt"
            : "Awaiting Tier 0–1 Reel Style selection"),
      ),
    };
  });
}
function ReelPromptReview({
  prompt,
  title,
}: {
  prompt: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false),
    [copied, setCopied] = useState(false),
    promptWordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  if (!prompt)
    return (
      <div className="reel-prompt-waiting">
        <b>Agent prompt not generated yet</b>
        <span>
          Select the Reel Style first. The Agent output will appear here for
          Tier 0–1 approval.
        </span>
      </div>
    );
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <section className="reel-prompt-review">
      <header>
        <div>
          <small>AGENT OUTPUT · PROVIDER-READY MOTION DIRECTION</small>
          <b>{title}</b>
          <span>{promptWordCount} words · first frame → performance → camera → continuity</span>
        </div>
        <span>
          <button type="button" onClick={copy}>
            {copied ? "Copied" : "Copy prompt"}
          </button>
          <button type="button" onClick={() => setExpanded(true)}>
            Full screen
          </button>
        </span>
      </header>
      <pre>{prompt}</pre>
      {expanded && (
        <div className="reel-prompt-overlay" role="dialog" aria-modal="true">
          <article>
            <header>
              <b>{title} · Full Agent Prompt</b>
              <button type="button" onClick={() => setExpanded(false)}>
                Close
              </button>
            </header>
            <pre>{prompt}</pre>
          </article>
        </div>
      )}
    </section>
  );
}
function ReelVideoProductionEditor({
  p,
  draft,
  setDraft,
  editable,
  upload,
  files,
  uploading,
  uploadStatus,
  reviewing,
  management,
  fieldReviews,
  setFieldReviews,
  feedback,
  acceptedFields,
}: {
  p: any;
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
  upload: (selected: FileList | null, itemKey?: string) => Promise<void>;
  files: any[];
  uploading: boolean;
  uploadStatus: string;
  reviewing: boolean;
  management: boolean;
  fieldReviews: Record<string, { decision: string; note: string }>;
  setFieldReviews: any;
  feedback: Record<string, string>;
  acceptedFields: string[];
}) {
  const referenceFallback = Array.isArray(p.projectReferences)
      ? p.projectReferences
      : [],
    sortReferences = (assets: any[]) =>
      assets
        .filter((asset: any) =>
          String(asset.mimeType || "").startsWith("image/"),
        )
        .sort(
          (a: any, b: any) =>
            Number(b.isCurrent) - Number(a.isCurrent) ||
            Number(b.version) - Number(a.version),
        ),
    [projectReferences, setProjectReferences] = useState<any[]>(
      sortReferences(referenceFallback),
    );
  useEffect(() => {
    setProjectReferences(sortReferences(referenceFallback));
    fetch(`/api/uploads?projectId=${encodeURIComponent(p.id)}&phase=references`)
      .then((r) => {
        if (!r.ok) throw new Error(`Reference request failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        const fetched = sortReferences(data.assets || []);
        if (fetched.length) setProjectReferences(fetched);
      })
      .catch(() => undefined);
  }, [p.id]);
  const production =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "content-production")
        .at(-1)?.approvedContent || {},
    batch =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "batch-ideas")
        .at(-1)?.approvedContent || {},
    items = normalizeReelVideoItems(draft, production, batch),
    commit = (next: ReelVideoItem[]) =>
      setDraft((current: any) => ({ ...current, reel_video_items: next })),
    update = (index: number, patch: Partial<ReelVideoItem>) => {
      const promptInputs = new Set([
          "durationSeconds",
          "shotCount",
          "shots",
          "dialogueMode",
          "musicDirection",
          "sceneContinuity",
          "physicalRealism",
          "hardConstraints",
          "referenceRole",
        ]),
        recompilePrompt = Object.keys(patch).some((key) =>
          promptInputs.has(key),
        ),
        timingChanged =
          Object.prototype.hasOwnProperty.call(patch, "durationSeconds") ||
          Object.prototype.hasOwnProperty.call(patch, "shotCount");
      commit(
        items.map((item, i) =>
          i === index
            ? {
                ...item,
                ...normalizeI2VPromptItem(
                  {
                    ...item,
                    ...patch,
                    ...(timingChanged
                      ? {
                          shots: Array.from(
                            {
                              length: Number(
                                patch.shotCount ?? item.shotCount,
                              ),
                            },
                            (_, shotIndex) => {
                              const duration = Number(
                                  patch.durationSeconds ?? item.durationSeconds,
                                ),
                                count = Number(
                                  patch.shotCount ?? item.shotCount,
                                ),
                                start = Number(
                                  ((duration * shotIndex) / count).toFixed(1),
                                ),
                                end = Number(
                                  (
                                    (duration * (shotIndex + 1)) /
                                    count
                                  ).toFixed(1),
                                );
                              return {
                                ...(item.shots[shotIndex] || {}),
                                timing: `${start.toFixed(1)}–${end.toFixed(1)}s`,
                              };
                            },
                          ),
                        }
                      : {}),
                    ...(recompilePrompt ? { compiledVideoPrompt: "" } : {}),
                  },
                  {
                    contentId: item.contentId,
                    title: item.title,
                    contentIntent: (normalizeBatchItems(batch).find(
                      (x) => x.id === item.contentId,
                    ) || {}) as any,
                    subjectPresence: item.subjectPresence,
                    firstFrameAssetId: item.firstFrameAssetId,
                    referenceAssetId:
                      patch.referenceAssetId ?? item.referenceAssetId,
                    referenceRole: patch.referenceRole ?? item.referenceRole,
                    sourceWidth: item.firstFrame?.width,
                    sourceHeight: item.firstFrame?.height,
                  },
                ),
                ...patch,
              }
            : item,
        ),
      );
    };
  return (
    <div className="production-guide production-editor reel-video-editor">
      {uploadStatus && (
        <div
          className={`upload-status ${uploadStatus.startsWith("Upload failed") ? "error" : "success"}`}
        >
          {uploadStatus}
        </div>
      )}
      <p>
        <b>Tier 0–1 selects the Reel Style before the Agent writes a prompt.</b>{" "}
        IMAGE_TO_VIDEO uses the approved Content Anchor as first_frame.
        Management selects ref_image_0 during Prompt Review.
      </p>
      <div className="production-content-list">
        {items.map((item, index) => {
          const itemKey = socialBatchAssetKey(
              selectSocialProductionBatch(p.batches || []),
              `${item.contentId}-video`,
            ),
            reviewKey = `reel_video_items.${item.contentId}`,
            uploaded = files.filter(
              (file) =>
                file.itemKey === itemKey && Number(file.isCurrent) !== 0,
            ),
            locked = acceptedFields.includes(reviewKey);
          return (
            <article
              className={`production-content-card reel-video-card ${locked ? "review-accepted" : ""}`}
              key={item.contentId}
            >
              <div className="reel-video-head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.reelType} · FF-VIDEO-I2V-01</small>
                  <b>{item.title}</b>
                </div>
                <em>
                  {uploaded.length
                    ? "Generated Reel ready"
                    : item.generationStatus}
                </em>
              </div>
              <div className="production-content-body">
                <div className="production-copy-grid">
                  <label>
                    <b>Reel Style · Tier 0–1 decision</b>
                    <select
                      disabled={!management || reviewing || locked}
                      value={item.reelStyle || ""}
                      onChange={(e) => {
                        const style = reelStyleDefinition(e.target.value);
                        update(index, {
                          reelStyle: style?.key || "",
                          workflowId: style?.workflowId || null,
                          reelType: (style?.key || "IMAGE_TO_VIDEO") as any,
                        });
                      }}
                    >
                      <option value="">Select before Agent prompt</option>
                      {REEL_STYLES.map((style) => (
                        <option
                          key={style.key}
                          value={style.key}
                          disabled={!style.executionReady}
                        >
                          {style.label}
                          {style.executionReady
                            ? ""
                            : " · workflow not registered"}
                        </option>
                      ))}
                    </select>
                    <small>
                      {item.workflowId
                        ? `Locked workflow ${item.workflowId}`
                        : "No execution workflow registered"}
                    </small>
                  </label>
                  <label>
                    <b>Duration · Agent selected</b>
                    <input
                      type="number"
                      min={8}
                      max={15}
                      disabled={!(editable || (management && reviewing)) || locked}
                      value={item.durationSeconds}
                      onChange={(e) =>
                        update(index, {
                          durationSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <b>Inherited Aspect Ratio · read-only</b>
                    <input
                      readOnly
                      value={
                        item.aspectRatio ||
                        "Waiting for approved first_frame dimensions"
                      }
                    />
                  </label>
                  <label>
                    <b>Agent-selected Shot Count</b>
                    <select
                      disabled={!(editable || (management && reviewing)) || locked}
                      value={item.shotCount}
                      onChange={(e) =>
                        update(index, { shotCount: Number(e.target.value) })
                      }
                    >
                      <option value={1}>1 shot</option>
                      <option value={2}>2 shots</option>
                      <option value={3}>3 shots</option>
                    </select>
                  </label>
                  <label>
                    <b>Dialogue Mode</b>
                    <input
                      disabled={!editable || locked}
                      value={item.dialogueMode}
                      onChange={(e) =>
                        update(index, { dialogueMode: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <b>Music Direction</b>
                    <input
                      disabled={!editable || locked}
                      value={item.musicDirection}
                      onChange={(e) =>
                        update(index, { musicDirection: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="reference-manifest">
                  <b>Approved First Frame</b>
                  <small>
                    {item.firstFrame?.fileName ||
                      (item.firstFrameAssetId
                        ? `Asset ${item.firstFrameAssetId}`
                        : "Missing · approve/generate the Reel Anchor Image first")}
                  </small>
                  <b>Selected Project Reference · ref_image_0</b>
                  {management && (reviewing || editable) ? (
                    <select
                      value={item.referenceAssetId || ""}
                      onChange={(e) => {
                        const asset = projectReferences.find(
                          (row: any) =>
                            Number(row.id) === Number(e.target.value),
                        );
                        update(index, {
                          referenceAssetId: Number(e.target.value) || null,
                          referenceRole: String(asset?.itemKey || "PROJECT_REFERENCE").replace(/-reference$/i, "").replaceAll("-", "_").toUpperCase(),
                          reference: asset || null,
                        });
                      }}
                    >
                      <option value="">
                        Select Project Reference for ref_image_0
                      </option>
                      {projectReferences.map((asset: any) => (
                        <option key={asset.id} value={asset.id}>
                          {referenceLabel(String(asset.itemKey || "project-reference").replace(/-reference$/i, ""))} · {asset.fileName} · v{asset.version}{Number(asset.isCurrent) === 0 ? " · previous upload" : " · current"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <small>
                      {item.reference?.fileName ||
                        (item.referenceAssetId
                          ? `Asset ${item.referenceAssetId}`
                          : "Management selects any uploaded Project Reference during Prompt Review")}
                    </small>
                  )}
                </div>
                {item.shots.map((shot, shotIndex) => (
                  <details
                    className="production-prompt-disclosure"
                    open={shotIndex === 0}
                    key={shotIndex}
                  >
                    <summary>
                      Shot {shotIndex + 1} · {shot.timing} · {shot.purpose}
                    </summary>
                    <textarea
                      disabled
                      value={`PERFORMANCE: ${shot.subjectPerformance}\nEXPRESSION / GAZE: ${shot.expressionGaze}\nCAMERA FRAMING: ${shot.cameraFraming}\nCAMERA MOVEMENT: ${shot.cameraMovement}\nSECONDARY MOTION: ${shot.secondaryMotion}`}
                    />
                  </details>
                ))}
                <ReelPromptReview prompt={item.compiledVideoPrompt} title={item.title} />
                <div className="production-media-grid">
                  {uploaded.map((file) => (
                    <ProductionMediaPreview key={file.id} file={file} />
                  ))}
                </div>
                {editable && !locked && !uploaded.length && (
                  <label className="canonical-drop compact production-upload-box">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      onChange={(e) => upload(e.target.files, itemKey)}
                    />
                    <b>
                      {uploading
                        ? "Uploading Reel video…"
                        : "Upload provider output only if automatic retrieval needs recovery"}
                    </b>
                    <small>
                      Normal path: existing Orchestrator → RunningHub MiniMax H3
                      → versioned FrameFlow Reel
                    </small>
                  </label>
                )}
                {feedback[reviewKey] && (
                  <div className="field-retake-feedback">
                    <small>RETAKE REVIEW · THIS REEL</small>
                    <p>{feedback[reviewKey]}</p>
                  </div>
                )}
                {reviewing &&
                  management &&
                  !locked &&
                  (draft._reelStage === "prompt_review" ||
                    uploaded.length > 0) && (
                  <InlineFieldReview
                    fieldKey={reviewKey}
                    reviewLabel={
                      draft._reelStage === "prompt_review"
                        ? `Reel ${String(index + 1).padStart(2, "0")} · Prompt + References`
                        : `Reel ${String(index + 1).padStart(2, "0")} · Motion + Generated Reel`
                    }
                    state={fieldReviews[reviewKey]}
                    setState={(value) =>
                      setFieldReviews((current: any) => ({
                        ...current,
                        [reviewKey]: value,
                      }))
                    }
                  />
                )}{" "}
                {reviewing && locked && (
                  <div className="review-locked-note">
                    ✓ Generated Reel accepted · locked
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!items.length && (
        <div className="empty-batch-plan">
          <b>No Reel items in this approved Batch</b>
          <span>
            Photo, Carousel and Threads items do not enter IMAGE_TO_VIDEO
            production.
          </span>
        </div>
      )}
    </div>
  );
}
const publishingApis: Record<
  string,
  { api: string; post: string; edit: string; performance: string }
> = {
  Instagram: {
    api: "Meta Instagram API",
    post: "API",
    edit: "Supported media management",
    performance: "Instagram Media Insights",
  },
  Facebook: {
    api: "Meta Graph API · Pages",
    post: "API",
    edit: "API",
    performance: "Page / Post Insights",
  },
  Threads: {
    api: "Threads API",
    post: "API",
    edit: "Platform-dependent",
    performance: "Threads Insights",
  },
  TikTok: {
    api: "Content Posting API + Display API",
    post: "API",
    edit: "Open in TikTok",
    performance: "Display / approved data access",
  },
  YouTube: {
    api: "YouTube Data API v3 + Analytics API",
    post: "API",
    edit: "Metadata API",
    performance: "YouTube Analytics",
  },
  Xiaohongshu: {
    api: "Partner / approved Open Platform",
    post: "Manual until approved",
    edit: "Open in Xiaohongshu",
    performance: "Manual / partner data",
  },
  X: {
    api: "X API v2",
    post: "API",
    edit: "Recent own Posts · eligibility applies",
    performance: "Post metrics",
  },
};
export function BatchPerformanceLearningCard({
  data,
  management,
  working,
  action,
}: {
  data: any;
  management: boolean;
  working: string;
  action: (action: string, payload?: any) => Promise<void>;
}) {
  const batch = data?.batchPerformance,
    current = batch?.currentBatch,
    totals = batch?.totals || {},
    comparison = batch?.comparison || {},
    maturity = batch?.dataMaturity || {},
    candidate = batch?.learningCandidate,
    input = batch?.nextBatchLearningInput,
    format = (value: any) => Number(value || 0).toLocaleString(),
    delta = (key: string) => {
      const value = comparison?.[key]?.percent;
      return value === null || value === undefined
        ? "No previous baseline"
        : `${value > 0 ? "+" : ""}${value}% vs previous Batch`;
    };
  if (!current)
    return (
      <section className="publishing-performance batch-performance-standard">
        <div className="empty-batch-plan">
          <b>No recurring Batch is available</b>
          <span>
            Create the Project's Two-week Batch before measuring Performance.
          </span>
        </div>
      </section>
    );
  return (
    <section className="publishing-performance batch-performance-standard">
      <header>
        <div>
          <small>BATCH PERFORMANCE · PROJECT-SCOPED</small>
          <h4>
            Batch {String(current.batchNumber).padStart(2, "0")} · Performance &
            Learning
          </h4>
          <p>
            {current.startsAt || "—"} → {current.endsAt || "—"} ·{" "}
            {(batch.platforms || []).join(" + ") ||
              "No publishing destination yet"}
          </p>
        </div>
        <div className="batch-performance-actions">
          <span>
            {current.publishedCount}/
            {current.recordCount || current.plannedCount || 0} published ·{" "}
            {current.syncedCount} synced
          </span>
          {management && (
            <button
              disabled={working === "sync_performance"}
              onClick={() =>
                action("sync_performance", { batchId: current.id })
              }
            >
              {working === "sync_performance" ? "Syncing…" : "Sync this Batch"}
            </button>
          )}
        </div>
      </header>
      <div className="performance-metric-grid">
        {[
          ["Views", totals.views],
          ["Reach", totals.reach],
          ["Engagement", totals.engagement],
          ["Likes", totals.likes],
          ["Saves", totals.saves],
          ["Shares", totals.shares],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <small>{label}</small>
            <b>{format(value)}</b>
          </article>
        ))}
      </div>
      <div className="batch-performance-grid">
        <article>
          <b>Top Content</b>
          {(batch.topContent || []).map((row: any, index: number) => (
            <p key={row.id}>
              <span>
                #{index + 1} {row.platform} · {row.contentKey}
              </span>
              <strong>
                {format(row.metrics?.views || row.metrics?.reach)} views / reach
              </strong>
            </p>
          ))}
          {!batch.topContent?.length && (
            <small>
              Verified rankings appear after this Batch's first Performance
              Sync.
            </small>
          )}
        </article>
        <article>
          <b>Batch Trend</b>
          {(batch.trend || []).slice(-5).map((point: any) => (
            <p key={point.capturedAt}>
              <span>{point.capturedAt}</span>
              <strong>
                {format(point.views)} views · {format(point.engagement)}{" "}
                engagement
              </strong>
            </p>
          ))}
          {!batch.trend?.length && (
            <small>
              Trend uses the latest provider snapshot per post and never adds
              duplicate snapshots.
            </small>
          )}
        </article>
        <article>
          <b>Previous Batch Comparison</b>
          {batch.previousBatch ? (
            <>
              {[
                ["Views", "views"],
                ["Reach", "reach"],
                ["Engagement", "engagement"],
              ].map(([label, key]) => (
                <p key={key}>
                  <span>{label}</span>
                  <strong>{delta(key)}</strong>
                </p>
              ))}
            </>
          ) : (
            <small>This is the first measurable Batch for this Project.</small>
          )}
        </article>
        <article>
          <b>Data Maturity</b>
          <strong
            className={`maturity-badge maturity-${String(maturity.code || "").toLowerCase()}`}
          >
            {maturity.label || "Waiting for data"}
          </strong>
          <small>{maturity.description}</small>
          <p>
            <span>24h / 72h</span>
            <strong>
              {maturity.windows?.h24 || 0} / {maturity.windows?.h72 || 0} posts
            </strong>
          </p>
          <p>
            <span>7d / 14d</span>
            <strong>
              {maturity.windows?.d7 || 0} / {maturity.windows?.d14 || 0} posts
            </strong>
          </p>
        </article>
        <article className="batch-learning-panel">
          <b>Agent Learning</b>
          {candidate ? (
            <div className="learning-candidate">
              <small>PENDING REVIEW · EVIDENCE ONLY</small>
              <p>
                <span>KEEP</span>
                {candidate.keep.join(" ")}
              </p>
              <p>
                <span>IMPROVE</span>
                {candidate.improve.join(" ")}
              </p>
              <p>
                <span>TEST NEXT</span>
                {candidate.testNext.join(" ")}
              </p>
              {management && (
                <button
                  disabled={working === `approve_batch_learning${candidate.id}`}
                  onClick={() =>
                    action("approve_batch_learning", {
                      learningId: candidate.id,
                    })
                  }
                >
                  {working === `approve_batch_learning${candidate.id}`
                    ? "Approving…"
                    : "Approve as Learned Memory"}
                </button>
              )}
            </div>
          ) : input ? (
            <>
              <small>APPROVED / READY</small>
              <p>
                <span>KEEP</span>
                {input.keep.join(" ")}
              </p>
              <p>
                <span>IMPROVE</span>
                {input.improve.join(" ")}
              </p>
              <p>
                <span>TEST NEXT</span>
                {input.testNext.join(" ")}
              </p>
            </>
          ) : (
            <small>No Learning Candidate exists for this Batch yet.</small>
          )}
        </article>
        <article className="batch-learning-panel">
          <b>Next Batch Learning Input</b>
          {input ? (
            <>
              <small>APPROVED LEARNED MEMORY · SAME PROJECT</small>
              <p>
                <span>KEEP</span>
                {input.keep.join(" ")}
              </p>
              <p>
                <span>IMPROVE</span>
                {input.improve.join(" ")}
              </p>
              <p>
                <span>TEST NEXT</span>
                {input.testNext.join(" ")}
              </p>
            </>
          ) : (
            <small>
              Pending or unreviewed evidence is excluded. Approve this Batch's
              Learning before it can influence the next Batch.
            </small>
          )}
        </article>
      </div>
      <footer className="batch-scope-rule">
        <b>Scope boundary</b>
        <span>
          {batch.projectId} · Batch{" "}
          {String(current.batchNumber).padStart(2, "0")} only. Other Projects
          and Batches are excluded.
        </span>
      </footer>
    </section>
  );
}
function BatchPerformanceLearningPhase({
  p,
  management,
}: {
  p: any;
  management: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [working, setWorking] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const response = await fetch(
        `/api/publishing?projectId=${encodeURIComponent(p.id)}`,
      ),
      result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Batch Performance is unavailable.");
    setData(result);
  }
  useEffect(() => {
    let active = true;
    load().catch((error) => active && setMessage(error.message));
    const timer = setInterval(() => active && load().catch((error) => setData((current:any)=>({...current,error:error.message}))), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [p.id]);
  async function action(name: string, payload: any = {}) {
    setWorking(name + String(payload.learningId || ""));
    setMessage("");
    const response = await fetch("/api/publishing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: p.id, action: name, ...payload }),
      }),
      result = await response.json();
    setWorking("");
    if (!response.ok) {
      setMessage(result.error || "Batch Performance action failed.");
      return;
    }
    setData(result);
    setMessage(
      name === "sync_performance"
        ? `Synced ${result.synced || 0} post${result.synced === 1 ? "" : "s"} from this Batch.`
        : "Learning approved for this Project's next Batch.",
    );
  }
  return (
    <div className="batch-performance-phase">
      {message && <div className="upload-status success">{message}</div>}
      {data ? (
        <BatchPerformanceLearningCard
          data={data}
          management={management}
          working={working}
          action={action}
        />
      ) : (
        <div className="loading">Loading this Batch's Performance…</div>
      )}
    </div>
  );
}
function ManualPostConfirmation({recordId,working,onSave}:{recordId:number;working:boolean;onSave:(payload:any)=>void}) {
  const [postUrl,setPostUrl]=useState("");
  return <div><label>Live post URL<input type="url" placeholder="https://…" value={postUrl} onChange={event=>setPostUrl(event.target.value)}/></label><small>Confirm only after you have published this post yourself.</small><button type="button" disabled={working||!postUrl.trim()} onClick={()=>onSave({recordId,postUrl:postUrl.trim()})}>{working?"Saving…":"Mark as published"}</button></div>;
}
function InstagramPublishingEditor({
  p,
  draft,
  setDraft,
  editable,
  management,
}: {
  p: any;
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
  management: boolean;
}) {
  const [data, setData] = useState<any>({
      loading: true,
      connections: [],
      queue: [],
      performance: { totals: {}, topContent: [], trend: [] },
      learning: null,
      learningCandidate: null,
      mediaDelivery: {},
    }),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(""),
    [selectedBatchId, setSelectedBatchId] = useState<number | null>(null),
    [platformFilter, setPlatformFilter] = useState("All");
  const requestVersion = useRef(0);
  async function load(batchId: number | null = selectedBatchId) {
    const version = ++requestVersion.current;
    const [connections, publishing] = await Promise.all([
      readJson(`/api/social-connections?projectId=${encodeURIComponent(p.id)}`),
      readJson(`/api/publishing?projectId=${encodeURIComponent(p.id)}${batchId ? `&batchId=${batchId}` : ""}`),
    ]);
    if (version !== requestVersion.current) return;
    const next = { loading: false, error: null, ...connections, ...publishing };
    setData(next);
    if (publishing.selectedBatchId)
      setSelectedBatchId(Number(publishing.selectedBatchId));
    setDraft((current: any) => ({
      ...current,
      publishing_state: "Durable Publishing Records",
      publishing_record_count: next.queue.length,
      publishing_notes: current.publishing_notes || "",
    }));
  }
  useEffect(() => {
    let active = true;
    load().catch(
      (error) =>
        active &&
        setData((current: any) => ({
          ...current,
          loading: false,
          error: error.message,
        })),
    );
    const timer = setInterval(
      () =>
        active &&
        load().catch((error) =>
          setData((current: any) => ({
            ...current,
            loading: false,
            error: error.message,
          })),
        ),
      30000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [p.id, selectedBatchId]);
  async function connectionAction(
    platform: string,
    action: string,
    socialConnectionId?: string,
  ) {
    setWorking(`${action}:${socialConnectionId || platform}`);
    setMessage("");
    const response = await fetch("/api/social-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: p.id,
          platform,
          action,
          socialConnectionId,
        }),
      }),
      result = await response.json();
    setWorking("");
    if (!response.ok) {
      setMessage(result.error || "Connection action failed.");
      return;
    }
    setMessage(`${platform} ${action.replaceAll("_", " ")} completed.`);
    await load();
  }
  async function publishingAction(action: string, payload: any = {}) {
    setWorking(
      action +
        String(payload.jobId || payload.recordId || payload.learningId || ""),
    );
    setMessage("");
    const response = await fetch("/api/publishing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: p.id,
          batchId: selectedBatchId,
          action,
          ...payload,
        }),
      }),
      result = await response.json();
    setWorking("");
    if (result.queue)
      setData((current: any) => ({ ...current, ...result, loading: false }));
    if (!response.ok) {
      setMessage(result.error || "Publishing action failed.");
      return;
    }
    setData((current: any) => ({ ...current, ...result, loading: false }));
    setMessage(
      action === "sync_performance"
        ? `Synced ${result.synced || 0} published post${result.synced === 1 ? "" : "s"}. Learning remains a candidate until Management approves it.`
        : action === "approve_batch_learning"
          ? "Batch Learning approved. It may now enter future Agent Context."
          : action === "publish_now"
            ? "Published now. Provider IDs, published time and Live Post URL were saved."
            : action === "mark_manual_published"
              ? "Manual publish confirmed. The live link and published time were saved."
              : "Publishing record updated.",
    );
  }
  const timeZone = projectTimezone(p),
    connected = (data.connections || [])
      .flatMap((row: any) => row.profiles || [])
      .filter((profile: any) => profile.status === "Connected").length,
    formatStatus = (status: string) =>
      String(status || "READY").replaceAll("_", " "),
    dateInput = (value: string) => timezoneInputValue(value, timeZone),
    displayTime = (value: string) => formatProjectDateTime(value, timeZone),
    availableBatches = (data.batchPerformance?.availableBatches || []).filter(
      (batch: any) => ["Active", "Overdue", "Completed"].includes(batch.status),
    ),
    selectedBatch = availableBatches.find(
      (batch: any) => Number(batch.id) === Number(selectedBatchId),
    ),
    visibleQueue = (data.queue || []).filter(
      (row: any) => platformFilter === "All" || row.platform === platformFilter,
    ),
    queuePlatforms = [
      "All",
      ...["Instagram", "TikTok", "Threads", "Facebook Page"].filter(
        (platform) =>
          (data.queue || []).some((row: any) => row.platform === platform),
      ),
    ];
  if (data.loading || (data.error && !data.selectedBatchId)) return <div className="project-load-error" role={data.error ? "alert" : "status"}><b>{data.error ? "Publishing could not load" : "Loading publishing records…"}</b><p>{data.error || "Loading saved Batches and connected Profiles."}</p>{data.error && <button type="button" onClick={()=>{setData((current:any)=>({...current,loading:true,error:null}));load().catch(error=>setData((current:any)=>({...current,loading:false,error:error.message})))}}>Retry Publishing</button>}</div>;
  return (
    <div className="publishing-editor project-publishing-workspace">
      <section className="publishing-intro">
        <div>
          <small>PROJECT SOCIAL OPERATIONS</small>
          <h4>Schedule → Auto publish → Measure → Learn</h4>
          <p>
            Connector availability, connected Profiles and this Batch's
            destinations remain separate. Dates come from the approved Batch
            plan in the Project timezone; Management may reschedule them.
          </p>
        </div>
        <strong>
          {connected}
          <span>profiles connected</span>
        </strong>
      </section>
      {data.error && (
        <div className="instagram-connection-error">{data.error}</div>
      )}
      {message && <div className="upload-status success">{message}</div>}
      <div className="publishing-api-grid">
        {(data.connections || []).map((row: any) => {
          const profiles = row.profiles || [],
            platform = row.platform,
            configured = row.configured,
            connectPath = platform.toLowerCase().replace(" page", ""),
            connectUrl = `/api/${connectPath}/connect?projectId=${encodeURIComponent(p.id)}`;
          return (
            <article
              className={
                profiles.some((profile: any) => profile.status === "Connected")
                  ? "instagram-connector-card is-connected"
                  : "instagram-connector-card"
              }
              key={platform}
            >
              <header>
                <div>
                  <b>{platform}</b>
                  <small>
                    {row.availability}
                    {platform === "Instagram"
                      ? " · Photo / Carousel / Reel"
                      : platform === "Threads"
                        ? " · Text / Image / Video"
                        : platform === "TikTok"
                          ? " · Login Kit only; Content Posting API not connected"
                        : ""}
                  </small>
                </div>
                <em
                  className={
                    profiles.some(
                      (profile: any) => profile.status === "Connected",
                    )
                      ? "connected"
                      : "pending"
                  }
                >
                  {profiles.length
                    ? `${profiles.length} Profile${profiles.length === 1 ? "" : "s"}`
                    : "Not connected"}
                </em>
              </header>
              <div className="connector-profile-stack">
                {profiles.map((profile: any) => (
                  <div key={profile.socialConnectionId}>
                    <b>{profile.handle}</b>
                    <small>
                      {profile.accountType || "Creator"} · {profile.status}
                      {profile.isDefault ? " · Default" : ""}
                    </small>
                    {management && (
                      <span>
                        {!profile.isDefault &&
                          profile.status === "Connected" && (
                            <button
                              onClick={() =>
                                connectionAction(
                                  platform,
                                  "set_default",
                                  profile.socialConnectionId,
                                )
                              }
                            >
                              Make default
                            </button>
                          )}
                        <a
                          href={
                            configured
                              ? `${connectUrl}&connectionId=${encodeURIComponent(profile.socialConnectionId)}`
                              : undefined
                          }
                        >
                          Reconnect
                        </a>
                        <button
                          onClick={() =>
                            connectionAction(
                              platform,
                              "check",
                              profile.socialConnectionId,
                            )
                          }
                        >
                          Check
                        </button>
                        <button
                          onClick={() =>
                            connectionAction(
                              platform,
                              "disconnect",
                              profile.socialConnectionId,
                            )
                          }
                        >
                          Disconnect
                        </button>
                      </span>
                    )}
                  </div>
                ))}
                {!profiles.length && (
                  <small>No Project Profile connected.</small>
                )}
              </div>
              {management && (
                <div className="publishing-connection-actions">
                  <a
                    className={`instagram-connect-button ${!configured ? "disabled" : ""}`}
                    aria-disabled={!configured}
                    href={configured ? connectUrl : undefined}
                  >
                    {profiles.length
                      ? `＋ Connect another ${platform} Profile`
                      : `Connect ${platform}`}
                  </a>
                </div>
              )}
              {!management && profiles.length > 0 && (
                <small className="publishing-credential-note">
                  Connection managed by Tier 0–1. Tokens and credentials are
                  never shown.
                </small>
              )}
              {!configured && (
                <small className="publishing-credential-note">
                  Connector visible for planning; system setup is not available
                  yet.
                </small>
              )}
            </article>
          );
        })}
      </div>
      <div className="publishing-flow">
        <span>Approved</span>
        <i>→</i>
        <span>Ready</span>
        <i>→</i>
        <span>Scheduled</span>
        <i>→</i>
        <span>Publishing</span>
        <i>→</i>
        <span>Published</span>
        <i>→</i>
        <span>Learning</span>
      </div>
      <div className="publishing-engine-ready">
        <b>Temporary Publishing Storage · automatic</b>
        <span>
          At the scheduled time, FrameFlow creates a short-lived public copy for
          Meta / Threads. Original Project assets remain private.
        </span>
      </div>
      <section className="publishing-scope-controls">
        <label>
          View Batch
          <select
            value={selectedBatchId || ""}
            onChange={(event) => {
              ++requestVersion.current;
              setData((current:any)=>({...current,loading:true,error:null}));
              setPlatformFilter("All");
              setSelectedBatchId(Number(event.target.value));
            }}
          >
            {availableBatches.map((batch: any) => (
              <option key={batch.id} value={batch.id}>
                Batch {String(batch.batchNumber).padStart(2, "0")} · {batch.startsAt} → {batch.endsAt} · {batch.publishedCount}/{batch.recordCount} published
              </option>
            ))}
          </select>
          <small>
            Only one Batch is shown at a time. Choose an older Batch here to review its status and live posts.
          </small>
        </label>
        <div>
          <small>PLATFORM</small>
          <span>
            {queuePlatforms.map((platform) => (
              <button
                type="button"
                className={platformFilter === platform ? "active" : ""}
                key={platform}
                onClick={() => setPlatformFilter(platform)}
              >
                {platform}
              </button>
            ))}
          </span>
        </div>
      </section>
      <section className="publishing-queue">
        <header>
          <div>
            <small>DURABLE RECORDS · CONTENT ORDER</small>
            <h4>Publishing queue</h4>
          </div>
          <span>
            {
              visibleQueue.filter(
                (row: any) => row.status === "PUBLISHED",
              ).length
            }
            /{visibleQueue.length} published
          </span>
        </header>
        {visibleQueue.map((row: any) => {
          const profiles =
              (data.connections || [])
                .find((item: any) => item.platform === row.platform)
                ?.profiles?.filter(
                  (profile: any) => profile.status === "Connected",
                ) || [],
            publishKey = `publish_now${row.jobId}`,
            automatic = isAutomaticPublishingPlatform(row.platform),
            canPublishNow =
              data.canPublishNow &&
              automatic &&
              Boolean(row.socialConnectionId) &&
              (row.status === "SCHEDULED" ||
                row.errorCode === "MISSED_SCHEDULE");
          return (
            <article
              className={`publishing-record status-${String(row.status).toLowerCase()}`}
              key={row.id}
            >
              <div className="publishing-content-identity">
                <small>
                  CONTENT{" "}
                  {String(
                    row.publishingOrder ||
                      row.contentKey?.match(/\d+/)?.[0] ||
                      "",
                  ).padStart(2, "0")}
                </small>
                <b>{row.caption || row.contentKey || "Approved content"}</b>
                <span>
                  {row.platform} ·{" "}
                  {row.connectedHandle || "Profile not selected"}
                </span>
                <em>{formatStatus(row.status)}</em>
              </div>
              <div className="publishing-destination">
                <label>
                  Destination Profile
                  <select
                    disabled={!management || row.status === "PUBLISHED"}
                    value={row.socialConnectionId || ""}
                    onChange={(e) =>
                      publishingAction("assign_profile", {
                        jobId: row.jobId,
                        socialConnectionId: e.target.value,
                      })
                    }
                  >
                    <option value="">Select profile</option>
                    {profiles.map((profile: any) => (
                      <option
                        key={profile.socialConnectionId}
                        value={profile.socialConnectionId}
                      >
                        {profile.handle}
                        {profile.isDefault ? " · Default" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Approved Batch schedule
                  <input
                    disabled={!management || row.status === "PUBLISHED"}
                    type="datetime-local"
                    value={dateInput(row.scheduledAt)}
                    onChange={(e) =>
                      e.target.value &&
                      publishingAction("override_schedule", {
                        jobId: row.jobId,
                        scheduledAt: timezoneInputToUtc(
                          e.target.value,
                          timeZone,
                        ),
                      })
                    }
                  />
                  <small>{timeZone} · overdue Batches can be rescheduled to a future date without changing Batch history</small>
                </label>
              </div>
              <div className="publishing-record-result">
                <small>
                  {row.publishedAt
                    ? `${row.result?.source==="MANAGEMENT_CONFIRMED_MANUAL_PUBLISH"?"Manually confirmed":"Published"} ${displayTime(row.publishedAt)}`
                    : (row.errorCode === "MISSED_SCHEDULE" || (row.scheduledAt && Date.parse(row.scheduledAt)<Date.now()))
                      ? `Overdue · ${displayTime(row.scheduledAt)}`
                    : row.scheduledAt
                      ? `Scheduled · ${displayTime(row.scheduledAt)}`
                      : "Waiting for Agent schedule · API blocked"}
                </small>
                {row.lastError && <strong>{row.lastError}</strong>}
                {automatic && !row.socialConnectionId && row.status !== "PUBLISHED" && (
                  <span>Choose a connected Destination Profile before publishing.</span>
                )}
                {row.providerPostId && (
                  <span>Post ID · {row.providerPostId}</span>
                )}
                {row.providerMediaId &&
                  row.providerMediaId !== row.providerPostId && (
                    <span>Media ID · {row.providerMediaId}</span>
                  )}
                {row.postUrl && (
                  <a href={row.postUrl} target="_blank" rel="noreferrer">
                    Open Live Post ↗
                  </a>
                )}
                {canPublishNow && (
                  <div>
                    <button
                      className="publish-now-test"
                      disabled={working === publishKey}
                      onClick={() =>
                        window.confirm(
                          `This will publish CONTENT ${String(row.publishingOrder || "").padStart(2, "0")} as a real live ${row.platform} post on ${row.connectedHandle}. Continue?`,
                        ) &&
                        publishingAction("publish_now", {
                          jobId: row.jobId,
                        })
                      }
                    >
                      {working === publishKey
                        ? "Publishing live…"
                        : "Publish now"}
                    </button>
                  </div>
                )}
                {management && ["NEEDS_ATTENTION", "MANUAL_EXCEPTION", "MANUAL_REQUIRED"].includes(row.status) && (
                  <div>
                    {row.status === "NEEDS_ATTENTION" && !["CONNECTOR_NOT_SUPPORTED", "LIVE_PUBLISHING_NOT_IMPLEMENTED", "MISSED_SCHEDULE"].includes(row.errorCode) && (
                      <button
                        disabled={working === `retry${row.jobId}`}
                        onClick={() =>
                          publishingAction("retry", { jobId: row.jobId })
                        }
                      >
                        Retry
                      </button>
                    )}
                    {!automatic && (
                      <div className="manual-publishing-tools"><p>Publish on {row.platform}, then save its live link here.</p><button type="button" onClick={()=>navigator.clipboard.writeText(row.caption||"")}>Copy caption</button>{(row.assets||[]).filter((asset:any)=>asset.storageKey).map((asset:any,index:number)=><a key={asset.storageKey} href={`/api/uploads?file=${encodeURIComponent(asset.storageKey)}`} target="_blank" rel="noreferrer">Download {asset.mimeType?.startsWith("video/")?"video":"asset"} {index+1}</a>)}<a href={row.platform==="TikTok"?"https://www.tiktok.com/tiktokstudio/upload":"https://www.facebook.com/"} target="_blank" rel="noreferrer">Open {row.platform} ↗</a>
                      <ManualPostConfirmation recordId={row.id} working={working===`mark_manual_published${row.id}`} onSave={payload=>publishingAction("mark_manual_published",payload)}/></div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!data.loading && !visibleQueue.length && (
          <div className="empty-batch-plan">
            <b>No Publishing Records for {selectedBatch ? `Batch ${String(selectedBatch.batchNumber).padStart(2, "0")}` : "this Batch"}</b>
            <span>
              Records are created automatically from the approved Two-week Batch
              schedule after Production approval.
            </span>
          </div>
        )}
      </section>
      <BatchPerformanceLearningCard
        data={data}
        management={management}
        working={working}
        action={publishingAction}
      />
      <label className="publishing-notes">
        <b>Publishing notes</b>
        <textarea
          disabled={!editable}
          value={String(draft.publishing_notes || "")}
          onChange={(e) =>
            setDraft((current: any) => ({
              ...current,
              publishing_state: "Durable Publishing Records",
              publishing_notes: e.target.value,
            }))
          }
          placeholder="Disclosure notes, exceptions or escalation instructions…"
        />
      </label>
    </div>
  );
}
function PublishingEditor({
  p,
  draft,
  setDraft,
  editable,
}: {
  p: any;
  draft: Record<string, any>;
  setDraft: any;
  editable: boolean;
}) {
  const configured =
      Array.isArray(p.projectConfig?.authorizedPlatforms) &&
      p.projectConfig.authorizedPlatforms.length
        ? p.projectConfig.authorizedPlatforms
        : ["Instagram"],
    production =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "content-production")
        .at(-1)?.approvedContent || {},
    batch =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "batch-ideas")
        .at(-1)?.approvedContent || {},
    batchItems = normalizeBatchItems(batch),
    productionItems = Array.isArray(production.production_items)
      ? production.production_items
      : [],
    connections = Array.isArray(draft.platform_connections)
      ? draft.platform_connections
      : configured.map((platform: string) => ({
          platform,
          profileUrl: "",
          handle: "",
          connectionMode:
            platform === "Xiaohongshu" ? "manual" : "official_api",
          status: "Not connected",
        })),
    queue = Array.isArray(draft.publishing_queue)
      ? draft.publishing_queue
      : productionItems.flatMap((item: any, index: number) => {
          const source =
              batchItems.find(
                (row) => row.id === String(item.contentId || item.content_id),
              ) || batchItems[index],
            platforms = source?.platforms?.length
              ? source.platforms
              : configured;
          return platforms
            .filter((platform: string) => configured.includes(platform))
            .map((platform: string) => ({
              contentId: String(
                item.contentId || item.content_id || `content_${index + 1}`,
              ),
              title: String(
                item.title || source?.title || `Content ${index + 1}`,
              ),
              platform,
              scheduledAt: "",
              status: "Ready",
              postUrl: "",
              platformPostId: "",
              lastPerformanceSync: "",
            }));
        }),
    commitConnections = (next: any[]) =>
      setDraft((current: any) => ({
        ...current,
        platform_connections: next,
        publishing_queue: Array.isArray(current.publishing_queue)
          ? current.publishing_queue
          : queue,
        publishing_notes: current.publishing_notes || "",
      })),
    commitQueue = (next: any[]) =>
      setDraft((current: any) => ({
        ...current,
        platform_connections: Array.isArray(current.platform_connections)
          ? current.platform_connections
          : connections,
        publishing_queue: next,
        publishing_notes: current.publishing_notes || "",
      }));
  return (
    <div className="publishing-editor">
      <section className="publishing-intro">
        <div>
          <small>PUBLISHING CONTROL</small>
          <h4>Connect each approved profile before Agent publishes.</h4>
          <p>
            Profile links and publishing records stay with this Project. API
            credentials belong in Tier 0 System Connections.
          </p>
        </div>
        <strong>
          {connections.filter((row: any) => row.status === "Connected").length}/
          {connections.length}
          <span>API connected</span>
        </strong>
      </section>
      <div className="publishing-api-grid">
        {connections.map((connection: any, index: number) => {
          const definition = publishingApis[connection.platform] || {
            api: "Official platform API",
            post: "Check",
            edit: "Check",
            performance: "Check",
          };
          return (
            <article key={connection.platform}>
              <header>
                <div>
                  <b>{connection.platform}</b>
                  <small>{definition.api}</small>
                </div>
                <em
                  className={
                    connection.status === "Connected" ? "connected" : "pending"
                  }
                >
                  {connection.status}
                </em>
              </header>
              <label>
                Profile URL
                <input
                  disabled={!editable}
                  type="url"
                  value={connection.profileUrl || ""}
                  onChange={(e) =>
                    commitConnections(
                      connections.map((row: any, i: number) =>
                        i === index
                          ? { ...row, profileUrl: e.target.value }
                          : row,
                      ),
                    )
                  }
                  placeholder="https://platform.com/your-profile"
                />
              </label>
              <label>
                Account / handle
                <input
                  disabled={!editable}
                  value={connection.handle || ""}
                  onChange={(e) =>
                    commitConnections(
                      connections.map((row: any, i: number) =>
                        i === index ? { ...row, handle: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="@account or channel ID"
                />
              </label>
              <div className="publishing-capabilities">
                <span>Post · {definition.post}</span>
                <span>Edit · {definition.edit}</span>
                <span>Performance · {definition.performance}</span>
              </div>
              <label>
                Connection mode
                <select
                  disabled={!editable}
                  value={connection.connectionMode || "official_api"}
                  onChange={(e) =>
                    commitConnections(
                      connections.map((row: any, i: number) =>
                        i === index
                          ? {
                              ...row,
                              connectionMode: e.target.value,
                              status:
                                e.target.value === "manual"
                                  ? "Manual profile"
                                  : "Not connected",
                            }
                          : row,
                      ),
                    )
                  }
                >
                  <option value="official_api">Official API / OAuth</option>
                  <option value="manual">Manual publishing fallback</option>
                  <option value="partner_api">Approved partner API</option>
                </select>
              </label>
              <small className="publishing-credential-note">
                {connection.connectionMode === "manual"
                  ? "Post manually, then record the live URL below."
                  : "Tier 0 completes OAuth in System Connections."}
              </small>
            </article>
          );
        })}
      </div>
      <section className="publishing-queue">
        <header>
          <div>
            <small>APPROVED CONTENT</small>
            <h4>Publishing queue</h4>
          </div>
          <span>
            {queue.filter((row: any) => row.status === "Published").length}/
            {queue.length} published
          </span>
        </header>
        {queue.map((row: any, index: number) => (
          <article key={`${row.contentId}-${row.platform}`}>
            <div>
              <small>
                {row.platform} · {row.contentId}
              </small>
              <b>{row.title}</b>
            </div>
            <label>
              Schedule
              <input
                disabled={!editable}
                type="datetime-local"
                value={row.scheduledAt || ""}
                onChange={(e) =>
                  commitQueue(
                    queue.map((item: any, i: number) =>
                      i === index
                        ? { ...item, scheduledAt: e.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Status
              <select
                disabled={!editable}
                value={row.status || "Ready"}
                onChange={(e) =>
                  commitQueue(
                    queue.map((item: any, i: number) =>
                      i === index ? { ...item, status: e.target.value } : item,
                    ),
                  )
                }
              >
                <option>Ready</option>
                <option>Scheduled</option>
                <option>Published</option>
                <option>Needs Attention</option>
              </select>
            </label>
            <label>
              Live post URL
              <input
                disabled={!editable}
                type="url"
                value={row.postUrl || ""}
                onChange={(e) =>
                  commitQueue(
                    queue.map((item: any, i: number) =>
                      i === index ? { ...item, postUrl: e.target.value } : item,
                    ),
                  )
                }
                placeholder="Required after publishing"
              />
            </label>
            {row.postUrl && (
              <a href={row.postUrl} target="_blank" rel="noreferrer">
                Open / edit on platform ↗
              </a>
            )}
          </article>
        ))}
      </section>
      <label className="publishing-notes">
        <b>Publishing notes</b>
        <textarea
          disabled={!editable}
          value={String(draft.publishing_notes || "")}
          onChange={(e) =>
            setDraft((current: any) => ({
              ...current,
              platform_connections: connections,
              publishing_queue: queue,
              publishing_notes: e.target.value,
            }))
          }
          placeholder="Account restrictions, preferred posting windows, disclosures or escalation notes…"
        />
      </label>
    </div>
  );
}
function formulaFields(
  phaseKey: string,
  projectType: string,
): Field[] | undefined {
  const formula = activeFormulaFor(phaseKey, projectType);
  if (!formula) return undefined;
  return Object.keys(formula.outputSchema).map((key) => ({
    key: key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
    label: key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (x) => x.toUpperCase()),
    placeholder: "Autofill or write the approved project-specific content…",
  }));
}
function InlineFieldReview({
  fieldKey,
  reviewLabel,
  state,
  setState,
}: {
  fieldKey: string;
  reviewLabel?: string;
  state?: { decision: string; note: string };
  setState: (value: { decision: string; note: string }) => void;
}) {
  const value = state || { decision: "", note: "" };
  return (
    <div className={`inline-field-review ${value.decision || "pending"}`}>
      <small>MANAGEMENT REVIEW · {reviewLabel || "THIS FIELD"}</small>
      <div>
        <button
          type="button"
          className={value.decision === "accept" ? "selected accept" : ""}
          onClick={() => setState({ decision: "accept", note: "" })}
        >
          ✓ Accept
        </button>
        <button
          type="button"
          className={value.decision === "retake" ? "selected retake" : ""}
          onClick={() => setState({ decision: "retake", note: value.note })}
        >
          × Retake
        </button>
      </div>
      {value.decision === "retake" && (
        <textarea
          value={value.note}
          onChange={(e) =>
            setState({ decision: "retake", note: e.target.value })
          }
          placeholder={`Describe exactly what must change in ${reviewLabel || fieldKey.replaceAll("_", " ")}…`}
        />
      )}
    </div>
  );
}
function RevisionAuthorityPanel({
  p,
  phaseKey,
  phase,
  feedbackText,
}: {
  p: any;
  phaseKey: string;
  phase: any;
  feedbackText: string;
}) {
  const approved = (p.approvedSnapshots || [])
    .filter((row: any) => row.phaseKey === phaseKey)
    .at(-1);
  return (
    <div className="revision-authority-panel">
      <div>
        <small>LAST APPROVED VERSION</small>
        <b>
          {approved
            ? `Version ${approved.version} · for reference only`
            : "No approved version exists for this Phase"}
        </b>
        <span>It remains in history and cannot override this revision.</span>
      </div>
      <div className="authoritative">
        <small>REVISION COMMENTS</small>
        <b>Authoritative revision instructions</b>
        <p>{feedbackText || "No revision comment recorded."}</p>
      </div>
      <div>
        <small>CURRENT WORKING VERSION</small>
        <b>Editable / not approved</b>
        <span>
          {phase.status === "Reviewing"
            ? "Agent submitted the revised working version below for Review."
            : "The fields below are the active working version."}
        </span>
      </div>
    </div>
  );
}

function TaskFilesEditor({ p }: { p: any }) {
  const [files, setFiles] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const batches = [...(p.batches || [])]
    .filter((batch: any) => batch.status !== "Locked")
    .sort((a: any, b: any) => Number(b.batchNumber) - Number(a.batchNumber));
  const defaultBatch = batches.find((batch: any) => batch.status === "Active") || batches.find((batch: any) => batch.status === "Completed") || batches[0] || null;
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(() => Number(p._selectedBatchId || defaultBatch?.id) || null);
  const selectedBatch = batches.find((batch: any) => Number(batch.id) === Number(selectedBatchId)) || defaultBatch;
  useEffect(() => {
    if (p._selectedBatchId) setSelectedBatchId(Number(p._selectedBatchId));
  }, [p._selectedBatchId, p.id]);
  useEffect(() => {
    let active = true;
    Promise.all(
      ["content-production", "reel-video-production"].map((phase) =>
        readJson(`/api/uploads?projectId=${encodeURIComponent(p.id)}&phase=${phase}`),
      ),
    )
      .then((results) => {
        if (!active) return;
        const prefix = socialBatchAssetPrefix(selectedBatch);
        const current = results
          .flatMap((result: any) => result.assets || [])
          .filter((file: any) => Number(file.isCurrent) !== 0)
          .filter((file: any) => !selectedBatch || String(file.itemKey || "").startsWith(prefix) || (Number(selectedBatch.batchNumber) === 1 && !String(file.itemKey || "").startsWith("batch-")))
          .sort((a: any, b: any) => String(a.itemKey).localeCompare(String(b.itemKey)));
        setFiles(current);
      })
      .catch((reason) => active && setError(String(reason?.message || reason)));
    return () => { active = false; };
  }, [p.id, selectedBatchId]);
  return (
    <section className="task-files-panel">
      <header>
        <div>
          <p className="eyebrow">FINAL TASK OUTPUT</p>
          <h3>Task Files</h3>
          <p>FrameFlow keeps current approved output files here, separated by Batch.</p>
        </div>
        <span className="phase-status-badge">{files?.length || 0} current file{files?.length === 1 ? "" : "s"}</span>
      </header>
      {batches.length > 0 && <div className="batch-history-selector"><label><span>View Batch files</span><select value={selectedBatchId || ""} onChange={(event) => { setFiles(null); setSelectedBatchId(Number(event.target.value)); }}>{batches.map((batch: any) => <option value={batch.id} key={batch.id}>Batch {String(batch.batchNumber).padStart(2, "0")} · {batch.startsAt} → {batch.endsAt} · {batch.status}</option>)}</select></label></div>}
      <div className="task-file-delivery-summary">
        <div><small>DELIVERY SCOPE</small><b>{selectedBatch ? `Batch ${String(selectedBatch.batchNumber).padStart(2, "0")}` : "Project"}</b><span>{selectedBatch?.status || "Current approved output"}</span></div>
        <div><small>AVAILABLE FILES</small><b>{files?.length || 0}</b><span>Current approved version only</span></div>
        <div><small>TELEGRAM NOTICE</small><b>Completion notice active</b><span>Sent when Agent work finishes</span></div>
      </div>
      {error ? <div className="project-load-error" role="alert"><b>Task files could not load</b><p>{error}</p></div> : files === null ? <p>Loading task files…</p> : files.length ? (
        <div className="production-media-grid task-file-delivery-grid">
          {files.map((file) => <article className="task-file-delivery" key={file.id}><ProductionMediaPreview file={file} /><div className="task-file-meta"><span><small>ITEM</small>{String(file.itemKey || "Approved output").replaceAll("-", " ")}</span><span><small>VERSION</small>v{file.version || 1}</span><span><small>DRIVE</small>{file.driveSyncStatus || "Stored in FrameFlow"}</span></div></article>)}
        </div>
      ) : (
        <div className="production-media-missing">No completed task files yet. Finish Content Production or Reel Video Production first.</div>
      )}
      <div className="reference-library-rule"><b>Completion notification</b><span>When Agent work finishes, FrameFlow keeps sending the existing Telegram completion notification. The file itself stays in this Project.</span></div>
    </section>
  );
}

export default function CanonicalPhaseWorkspace({
  p,
  phaseKey,
  tier,
  act,
}: {
  p: any;
  phaseKey: string;
  tier: number;
  act: (id: string, b: Record<string, string>) => void;
}) {
  const phase = (p.phaseRecords || []).find(
      (x: any) => x.phaseKey === phaseKey,
    ),
    projectType = p.projectType || p.type,
    baseSchema =
      phaseKey === "idea-hook-story"
        ? reelsIdeaFields(p)
        : fields[phaseKey] ||
          formulaFields(phaseKey, projectType) ||
          common(
            "Phase objective",
            "Work completed",
            "References / evidence",
            "Notes",
          ),
    [draft, setDraft] = useState<Record<string, any>>({}),
    [note, setNote] = useState(""),
    [fieldReviews, setFieldReviews] = useState<
      Record<string, { decision: string; note: string }>
    >({}),
    [files, setFiles] = useState<any[]>([]),
    [uploading, setUploading] = useState(false),
    [uploadStatus, setUploadStatus] = useState(""),
    [generating, setGenerating] = useState(false),
    [autoTriggered, setAutoTriggered] = useState(false),
    [autofillStatus, setAutofillStatus] = useState(""),
    [reviewSubmitting, setReviewSubmitting] = useState(false);
  const schema = useMemo(
    () =>
      phaseKey !== "keyshot-set"
        ? baseSchema
        : Object.keys(draft)
            .filter((k) => /^keyshot_\d+$/.test(k))
            .sort()
            .map((key, i) => ({
              key,
              label: `Keyshot ${String(i + 1).padStart(2, "0")}`,
              placeholder:
                "Describe one decisive visual state and its independent image prompt…",
            }))
            .concat(
              Object.keys(draft).some((k) => /^keyshot_\d+$/.test(k))
                ? []
                : baseSchema,
            ),
    [phaseKey, draft, baseSchema],
  );
  useEffect(() => {
    setDraft(phase?.data || {});
    setNote("");
    setFieldReviews({});
    setReviewSubmitting(false);
  }, [phaseKey, phase?.version, phase?.status]);
  useEffect(() => {
    setAutoTriggered(false);
  }, [p.id, phaseKey]);
  useEffect(() => {
    if (
      !isAssetPhase(phaseKey) &&
      !["reel-video-production", "references"].includes(phaseKey)
    )
      return;
    let active = true;
    const load = () =>
        fetch(
          `/api/uploads?projectId=${encodeURIComponent(p.id)}&phase=${encodeURIComponent(phaseKey)}${["content-production", "reel-video-production"].includes(phaseKey) ? `&itemKeyPrefix=${encodeURIComponent(socialBatchAssetPrefix(selectSocialProductionBatch(p.batches || [])))}` : ""}`,
        )
          .then((r) => r.json())
          .then((d) => active && setFiles(d.assets || []))
          .catch(() => active && setFiles([]));
    load();
    const activeProduction = [
        "content-production",
        "reel-video-production",
      ].includes(phaseKey),
      timer = activeProduction ? setInterval(load, 30000) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [p.id, phaseKey]);
  const frozen = ["Reviewing", "Client Reviewing"].includes(phase?.status),
    approved = phase?.status === "Approved",
    management = tier <= 1,
    editable =
      phaseKey !== "batch-learning" &&
      ((!frozen && !approved && phase?.status !== "Locked") ||
        (phaseKey === "references" && approved && management)),
    reviewCount = useMemo(
      () => Number(phase?.reviewSessionsUsed || 0),
      [phaseKey, phase?.reviewSessionsUsed],
    ),
    millaAssigned = useMemo(() => {
      if (
        !["Internal Social Account", "Client Social Account"].includes(
          projectType,
        ) ||
        phaseKey === "references"
      )
        return false;
      try {
        return JSON.parse(p.assignmentMembers || "[]")
          .map((x: string) => x.toLowerCase())
          .includes("agent:milla-im");
      } catch {
        return false;
      }
    }, [phaseKey, projectType, p.assignmentMembers]),
    hasDraft = useMemo(
      () =>
        Object.entries(phase?.data || {}).some(
          ([key, value]) =>
            !key.startsWith("_") &&
            !["reviewNote", "reviewFeedback"].includes(key) &&
            String(value ?? "").trim(),
        ),
      [phase?.data],
    ),
    legacyImageHandoff =
      phaseKey === "content-production" &&
      phase?.status === "In Progress" &&
      millaAssigned &&
      hasDraft &&
      !phase?.data?._imageReviewStage &&
      p.assignmentStatus === "Upload Media & Submit Review";
  useEffect(() => {
    if (
      !phase ||
      phase.status !== "In Progress" ||
      hasDraft ||
      millaAssigned ||
      autoTriggered ||
      !activeFormulaFor(phaseKey, projectType)
    )
      return;
    const timer = setTimeout(() => {
      setAutoTriggered(true);
      autofill();
    }, 150);
    return () => clearTimeout(timer);
  }, [
    p.id,
    phaseKey,
    phase?.status,
    hasDraft,
    millaAssigned,
    autoTriggered,
    projectType,
  ]);
  useEffect(() => {
    if (!legacyImageHandoff || autoTriggered) return;
    const timer = setTimeout(() => {
      setAutoTriggered(true);
      setAutofillStatus(
        "Agent is continuing the existing Production task · generating first images…",
      );
      autofill();
    }, 250);
    return () => clearTimeout(timer);
  }, [p.id, phaseKey, legacyImageHandoff, autoTriggered]);
  if (!phase)
    return (
      <section className="panel canonical-phase">
        <h3>Phase unavailable</h3>
      </section>
    );
  if (phaseKey.includes("payment")) {
    const paid = Number(p.paymentPercentage || phase.data?.percentage || 0);
    return (
      <section className="panel canonical-phase payment-phase compact">
        <header>
          <div>
            <p className="eyebrow">PAYMENT GATE</p>
            <h3>{phase.label}</h3>
            <p>Production opens at 25% or 50%. Final Delivery requires 100%.</p>
          </div>
          <span
            className={`phase-status-badge ${paid === 100 ? "approved" : "in-progress"}`}
          >
            {paid === 100 ? "✓" : `${paid}%`}
          </span>
        </header>
        <div className="payment-options">
          {[25, 50, 100].map((value) => (
            <button
              key={value}
              disabled={!management}
              className={paid === value ? "selected" : ""}
              onClick={() =>
                act(p.id, {
                  action: "setPaymentProgress",
                  phaseKey,
                  percentage: String(value),
                })
              }
            >
              <strong>{value}%</strong>
              <span>
                {value === 100 ? "Final delivery unlocked" : "Payment received"}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (phaseKey === "project-completion")
    return <CompletionPanel p={p} management={management} act={act} />;
  async function upload(
    selected: FileList | null,
    itemKey = "phase-assets",
    replaceSet = false,
  ) {
    if (!selected?.length) return;
    setUploading(true);
    setUploadStatus("");
    let completed = 0,
      replacePending = replaceSet;
    const errors: string[] = [];
    try {
      for (const file of Array.from(selected)) {
        try {
          await uploadFileInChunks({
            file,
            projectId: p.id,
            phase: phaseKey,
            itemKey: ["content-production", "reel-video-production"].includes(
              phaseKey,
            )
              ? socialBatchAssetKey(
                  selectSocialProductionBatch(p.batches || []),
                  itemKey.replace(/^batch-[^-]+-/, ""),
                )
              : itemKey,
            replaceSet: replacePending,
            onProgress: (percent) =>
              setUploadStatus(
                `${replaceSet ? "Replacing" : "Uploading"} ${file.name} · ${percent}%`,
              ),
          });
          completed++;
          replacePending = false;
        } catch (error: any) {
          errors.push(`${file.name}: ${error?.message || "Upload failed"}`);
        }
      }
      const response = await fetch(
          `/api/uploads?projectId=${encodeURIComponent(p.id)}&phase=${encodeURIComponent(phaseKey)}${["content-production", "reel-video-production"].includes(phaseKey) ? `&itemKeyPrefix=${encodeURIComponent(socialBatchAssetPrefix(selectSocialProductionBatch(p.batches || [])))}` : ""}`,
        ),
        result = await response.json();
      setFiles(result.assets || []);
      setUploadStatus(
        errors.length
          ? `Upload failed · ${errors.join(" · ")}`
          : `${completed} file${completed === 1 ? "" : "s"} ${replaceSet ? "saved as the current reference set" : "uploaded"} and queued for Google Drive`,
      );
    } catch (error: any) {
      setUploadStatus(
        `Upload failed · ${error?.message || "Please try again"}`,
      );
    } finally {
      setUploading(false);
    }
  }
  async function autofill() {
    setGenerating(true);
    setAutofillStatus("");
    try {
      if (millaAssigned) {
        const response = await fetch("/api/agent-runner", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "run", projectId: p.id }),
          }),
          result = await response
            .json()
            .catch(() => ({
              error: `Agent Runner failed (${response.status})`,
            }));
        if (response.ok) {
          setAutofillStatus(
            result.phaseKey === "content-production" &&
              result.status === "Reviewing"
              ? result.imageProduction?.stage === "first_images"
                ? `Agent generated the first image for ${result.imageProduction?.totalCount || 0} Content items · submitted for Review`
                : `Agent generated ${result.imageProduction?.totalCount || 0} remaining images · submitted for final Content Review`
              : result.phaseKey === "reel-video-production"
                ? `Agent completed ${result.phaseLabel} prompts · standing by for video generation/upload`
                : `Agent completed ${result.phaseLabel} · auto-saved · submitted for approval`,
          );
          window.dispatchEvent(
            new CustomEvent("frameflow:refresh", {
              detail: { projectId: p.id },
            }),
          );
        } else
          setAutofillStatus(
            result.error || "Agent could not start this Agent task",
          );
        return;
      }
      const response = await fetch("/api/autofill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: p.id, phaseKey }),
        }),
        result = await response
          .json()
          .catch(() => ({ error: `Autofill failed (${response.status})` }));
      if (response.ok) {
        setDraft((x) => ({ ...x, ...result.draft }));
        setAutofillStatus(
          `${result.provider} · ${result.model} · ${result.formula.id} v${result.formula.version} · Draft auto-saved`,
        );
        window.dispatchEvent(
          new CustomEvent("frameflow:refresh", { detail: { projectId: p.id } }),
        );
      } else if (result.code === "PROVIDER_NOT_CONFIGURED") {
        setDraft((x) => ({ ...x, ...aiDraft(p, phaseKey) }));
        setAutofillStatus(
          "Rule-based Autofill · LLM not connected yet · press Save draft",
        );
      } else setAutofillStatus(result.error || "Autofill could not complete");
    } catch (error: any) {
      setAutofillStatus(error?.message || "Agent task connection failed");
    } finally {
      setGenerating(false);
    }
  }
  function send(action: string) {
    let payload = draft;
    if (phaseKey === "content-production") {
      const approvedBatch =
        (p.approvedSnapshots || [])
          .filter((x: any) => x.phaseKey === "batch-ideas")
          .at(-1)?.approvedContent || {};
      payload = {
        ...draft,
        production_items: normalizeProductionItems(
          draft,
          normalizeBatchItems(approvedBatch),
        ),
      };
    }
    if (phaseKey === "reel-video-production") {
      const production =
          (p.approvedSnapshots || [])
            .filter((x: any) => x.phaseKey === "content-production")
            .at(-1)?.approvedContent || {},
        batch =
          (p.approvedSnapshots || [])
            .filter((x: any) => x.phaseKey === "batch-ideas")
            .at(-1)?.approvedContent || {};
      payload = {
        ...draft,
        reel_video_items: normalizeReelVideoItems(draft, production, batch),
      };
    }
    act(p.id, { action, phaseKey, payload: JSON.stringify(payload) });
  }
  const context = exportText(p, phase),
    scriptSource =
      (p.approvedSnapshots || [])
        .filter((x: any) => x.phaseKey === "script")
        .at(-1)?.approvedContent || {};
  const appliedFeedback =
      phase.data?.reviewFeedback ||
      phase.data?.reviewNote ||
      phase.data?._revisionFeedbackApplied,
    feedbackText =
      typeof appliedFeedback === "object"
        ? Object.entries(appliedFeedback || {})
            .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
            .join("\n")
        : String(appliedFeedback || ""),
    feedbackByKey =
      typeof phase.data?.reviewFeedback === "object"
        ? phase.data.reviewFeedback
        : {},
    acceptedReviewFields = Array.isArray(phase.data?._acceptedReviewFields)
      ? phase.data._acceptedReviewFields
      : [];
  const reviewKeys =
    phaseKey === "batch-ideas"
      ? normalizeBatchItems(draft).map((item) => `content_items.${item.id}`)
      : phaseKey === "content-production"
        ? (() => {
            const approvedBatch =
                (p.approvedSnapshots || [])
                  .filter((x: any) => x.phaseKey === "batch-ideas")
                  .at(-1)?.approvedContent || {},
              sources = normalizeBatchItems(approvedBatch),
              stage =
                draft._imageReviewStage === "remaining_images"
                  ? "remaining_images"
                  : "first_images";
            return normalizeProductionItems(draft, sources).flatMap((item) =>
              stage === "first_images"
                ? [
                    `production_items.${item.contentId}.copy`,
                    ...item.assets
                      .filter((asset) => asset.assetNumber === 1)
                      .map(
                        (asset) =>
                          `production_items.${item.contentId}.asset.${asset.assetNumber}`,
                      ),
                  ]
                : item.assets
                    .filter((asset) => asset.assetNumber > 1)
                    .map(
                      (asset) =>
                        `production_items.${item.contentId}.asset.${asset.assetNumber}`,
                    ),
            );
          })()
        : phaseKey === "reel-video-production"
          ? (() => {
              const production =
                  (p.approvedSnapshots || [])
                    .filter((x: any) => x.phaseKey === "content-production")
                    .at(-1)?.approvedContent || {},
                batch =
                  (p.approvedSnapshots || [])
                    .filter((x: any) => x.phaseKey === "batch-ideas")
                    .at(-1)?.approvedContent || {};
              return normalizeReelVideoItems(draft, production, batch).map(
                (item) => `reel_video_items.${item.contentId}`,
              );
            })()
          : schema.map((field) => field.key);
  async function submitReview(payload: Record<string, string>) {
    if (reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      await act(p.id, payload);
    } finally {
      setReviewSubmitting(false);
    }
  }
  async function submitFieldRetakes() {
    const retakes = Object.fromEntries(
        Object.entries(fieldReviews)
          .filter(
            ([, value]) => value.decision === "retake" && value.note.trim(),
          )
          .map(([key, value]) => [key, value.note.trim()]),
      ),
      accepted = Array.from(
        new Set([
          ...acceptedReviewFields,
          ...Object.entries(fieldReviews)
            .filter(([, value]) => value.decision === "accept")
            .map(([key]) => key),
        ]),
      );
    if (
      !Object.keys(retakes).length ||
      !reviewKeys.every(
        (key) =>
          accepted.includes(key) ||
          Object.prototype.hasOwnProperty.call(retakes, key),
      )
    )
      return;
    await submitReview({
      action: "reviewCanonicalPhase",
      phaseKey,
      decision: "retake",
      reviewNote: Object.entries(retakes)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n"),
      fieldReviews: JSON.stringify(retakes),
      acceptedFields: JSON.stringify(accepted),
    });
  }
  const hasFieldRetake = Object.values(fieldReviews).some(
      (value) => value.decision === "retake" && value.note.trim(),
    ),
    allReviewBlocksDecided =
      reviewKeys.length > 0 &&
      reviewKeys.every(
        (key) =>
          acceptedReviewFields.includes(key) ||
          fieldReviews[key]?.decision === "accept" ||
          (fieldReviews[key]?.decision === "retake" &&
            fieldReviews[key]?.note.trim()),
      ),
    structuredFieldReview = phaseKey !== "references";
  return (
    <section
      className={`panel canonical-phase ${frozen ? "frozen" : ""} ${approved ? "approved" : ""}`}
    >
      <header>
        <div>
          <p className="eyebrow">
            {phaseKey === "publishing"
              ? "PROJECT FILE ARCHIVE"
              : phase.reviewKind === "client"
              ? "CLIENT REVIEW"
              : phase.reviewKind === "internal"
                ? "INTERNAL REVIEW"
                : "PRODUCTION PHASE"}
          </p>
          <h3>{phaseKey === "publishing" ? "Task Files" : phaseKey === "client-publishing-approval" ? "Final Content Approval" : phase.label}</h3>
          <p>
            {phaseKey === "publishing"
              ? "Choose a Batch to view only that Batch’s current output files."
              : phase.maxReviews
              ? `${phase.maxReviews} included formal Review Sessions.`
              : "Phase status and history are recorded independently."}
          </p>
        </div>
        <span
          className={`phase-status-badge ${phase.status.toLowerCase().replaceAll(" ", "-")}`}
        >
          {approved ? "✓" : phase.status}
        </span>
      </header>
      {phaseKey !== "publishing" && <div className="context-tools">
        <div>
          <b>Phase Context Export</b>
          <small>
            Brief, research source and this phase in one AI-ready text file.
          </small>
        </div>
        <button onClick={() => navigator.clipboard.writeText(context)}>
          Copy context
        </button>
        <button
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(
              new Blob([context], { type: "text/plain" }),
            );
            a.download = `${p.id}-${phaseKey}.txt`;
            a.click();
          }}
        >
          Download .txt
        </button>
        {editable &&
          !millaAssigned &&
          Boolean(activeFormulaFor(phaseKey, p.projectType || p.type)) && (
            <button
              className="ai-draft"
              disabled={generating || legacyImageHandoff}
              onClick={autofill}
            >
              {generating || legacyImageHandoff
                ? "Agent generating…"
                : hasDraft
                  ? "↻ Regenerate Draft"
                  : "✦ Generate Draft"}
            </button>
          )}
        {editable &&
          millaAssigned &&
          Boolean(activeFormulaFor(phaseKey, p.projectType || p.type)) && (
            <small className="autofill-status agent-control-handoff">
              Agent automation is managed in Workload → Agent Work.
            </small>
          )}
        {autofillStatus && (
          <small className="autofill-status">{autofillStatus}</small>
        )}
      </div>}
      {["idea-hook-story", "strategy-direction", "batch-ideas"].includes(
        phaseKey,
      ) && (
        <div className="reels-autofill-source">
          <b>Approved-context Autofill</b>
          <span>
            Uses only the latest Approved upstream context. It remains editable
            and is labelled rule-based until an LLM provider is securely
            connected.
          </span>
        </div>
      )}
      {phaseKey === "keyshot-set" && (
        <div className="keyshot-story-source">
          <small>APPROVED SCRIPT SOURCE</small>
          <h4>
            {scriptSource.story_outline ||
              "Key visual moments extracted from the approved story"}
          </h4>
          <p>
            {scriptSource.narrative_flow ||
              "Complete the Script first. The Keyshot set will translate its opening, development, turning point and payoff into reviewable images."}
          </p>
        </div>
      )}
      {appliedFeedback && (
        <RevisionAuthorityPanel
          p={p}
          phaseKey={phaseKey}
          phase={phase}
          feedbackText={feedbackText}
        />
      )}
      {phaseKey === "references" ? (
        <ReferenceLibraryEditor
          draft={draft}
          setDraft={setDraft}
          editable={editable}
          upload={upload}
          files={files}
          uploading={uploading}
          uploadStatus={uploadStatus}
        />
      ) : phaseKey === "batch-ideas" ? (
        <BatchPlanEditor
          p={p}
          draft={draft}
          setDraft={setDraft}
          editable={editable}
          reviewing={frozen}
          management={management}
          fieldReviews={fieldReviews}
          setFieldReviews={setFieldReviews}
          feedback={feedbackByKey}
          acceptedFields={acceptedReviewFields}
        />
      ) : phaseKey === "content-production" ? (
        <ContentProductionEditor
          p={p}
          draft={draft}
          setDraft={setDraft}
          editable={editable}
          files={files}
          uploadStatus={uploadStatus}
          reviewing={frozen}
          management={management}
          fieldReviews={fieldReviews}
          setFieldReviews={setFieldReviews}
          feedback={feedbackByKey}
          acceptedFields={acceptedReviewFields}
          act={act}
        />
      ) : phaseKey === "reel-video-production" ? (
        <ReelVideoProductionEditor
          p={p}
          draft={draft}
          setDraft={setDraft}
          editable={editable}
          upload={upload}
          files={files}
          uploading={uploading}
          uploadStatus={uploadStatus}
          reviewing={frozen}
          management={management}
          fieldReviews={fieldReviews}
          setFieldReviews={setFieldReviews}
          feedback={feedbackByKey}
          acceptedFields={acceptedReviewFields}
        />
      ) : phaseKey === "publishing" ? (
        <TaskFilesEditor p={p} />
      ) : phaseKey === "batch-learning" ? (
        <BatchPerformanceLearningPhase p={p} management={management} />
      ) : (
        <div
          className={`canonical-field-grid ${phaseKey === "keyshot-set" ? "keyshot-grid" : ""} ${phaseKey === "idea-hook-story" ? "reels-idea-grid" : ""}`}
        >
          {schema.map((field, i) => (
            <label key={field.key}>
              <b>{field.label}</b>
              {field.key === "current_direction_decision" ? (
                <select
                  disabled={
                    !editable || acceptedReviewFields.includes(field.key)
                  }
                  value={draft[field.key] || ""}
                  onChange={(e) =>
                    setDraft((x) => ({ ...x, [field.key]: e.target.value }))
                  }
                >
                  <option value="">Choose one decision</option>
                  <option>KEEP CURRENT DIRECTION</option>
                  <option>PROPOSE ADJUSTMENT</option>
                </select>
              ) : (
                <textarea
                  disabled={
                    !editable || acceptedReviewFields.includes(field.key)
                  }
                  value={draft[field.key] || ""}
                  onChange={(e) =>
                    setDraft((x) => ({ ...x, [field.key]: e.target.value }))
                  }
                  placeholder={
                    phaseKey === "keyshot-set"
                      ? `Describe one decisive cinematic moment: subject, action, environment, framing, lens, lighting, continuity and story purpose.`
                      : field.placeholder
                  }
                />
              )}
              {phase.status === "Retake" &&
                phase.data?.reviewFeedback?.[field.key] && (
                  <div className="field-retake-feedback">
                    <small>RETAKE REVIEW FOR THIS FIELD</small>
                    <p>{phase.data.reviewFeedback[field.key]}</p>
                  </div>
                )}
              {frozen && management && (
                <InlineFieldReview
                  fieldKey={field.key}
                  state={fieldReviews[field.key]}
                  setState={(value) =>
                    setFieldReviews((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                />
              )}
              {phaseKey === "keyshot-set" && (
                <>
                  <label className="mini-upload">
                    {uploading
                      ? "Uploading…"
                      : "＋ Upload multiple keyshot images"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={!editable}
                      onChange={(e) => upload(e.target.files, field.key)}
                    />
                  </label>
                  <div className="mini-files">
                    {files
                      .filter((x) => x.itemKey === field.key)
                      .map((x) => (
                        <a
                          key={x.id}
                          target="_blank"
                          href={`/api/uploads?file=${encodeURIComponent(x.storageKey)}`}
                        >
                          {x.fileName}
                        </a>
                      ))}
                  </div>
                </>
              )}
            </label>
          ))}
        </div>
      )}
      {isAssetPhase(phaseKey) &&
        !["keyshot-set", "content-production"].includes(phaseKey) && (
          <div className="canonical-assets">
            <div>
              <b>Phase files</b>
              <small>
                Images, video, audio and documents are versioned in this phase.
              </small>
            </div>
            {editable && (
              <label className="canonical-drop">
                <input
                  type="file"
                  multiple
                  onChange={(e) => upload(e.target.files)}
                />
                {uploading ? "Uploading…" : "Drop or choose files"}
              </label>
            )}
            <div className="canonical-file-list">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={`/api/uploads?file=${encodeURIComponent(file.storageKey)}`}
                  target="_blank"
                >
                  <span>{file.fileName}</span>
                  <small>
                    v{file.version} · {file.driveSyncStatus}
                  </small>
                </a>
              ))}
            </div>
          </div>
        )}
      {editable && (
        <footer>
          {phaseKey === "references" && approved ? (
            <button
              className="create-btn"
              onClick={() => send("updateApprovedReferences")}
            >
              Save Approved Reference Library
            </button>
          ) : phaseKey === "content-production" && millaAssigned ? (
            <div className="agent-managed-submit">
              <b>Agent owns image generation and Review submission.</b>
              <span>
                {legacyImageHandoff
                  ? "Existing Production detected · Agent is automatically generating the first-image Review package now."
                  : hasDraft
                    ? "Agent continues automatically after each approval. Resume is shown only if a provider or generation job needs attention."
                    : "Agent will prepare the Content and generate one first image for every visual Content before Review."}
              </span>
            </div>
          ) : (
            <>
              <button onClick={() => send("saveCanonicalPhase")}>
                {phaseKey === "reel-video-production"
                  ? "Save Reel Setup"
                  : "Save draft"}
              </button>
              <button
                className="create-btn"
                onClick={() => send("submitCanonicalPhase")}
              >
                {phaseKey === "reel-video-production"
                  ? draft._reelStage === "generation"
                    ? draft.reviewFeedback || draft.reviewNote
                      ? "Continue Reel Prompt Revision"
                      : "Continue Approved Reel Generation"
                    : draft._workingDraftStatus === "Needs Correction"
                      ? "Continue Prompt Correction"
                    : draft._reelStage === "prompt_review"
                      ? "Return to Reel Prompt Review"
                      : "Save Reel Setup & Request Prompts"
                  : phase.reviewKind === "client"
                  ? "Submit for Internal Review"
                  : phase.reviewKind === "internal"
                    ? "Submit for Internal Review"
                    : "Complete phase & continue"}{" "}
                →
              </button>
            </>
          )}
        </footer>
      )}
      {phase.data?.externalReviewUrl && (
        <div className="external-review-ready">
          <div>
            <b>Client Review Link ready</b>
            <small>Active for 3 days. Send this link to the client.</small>
          </div>
          <a href={phase.data.externalReviewUrl} target="_blank">
            Open review link ↗
          </a>
        </div>
      )}
      {frozen && management && structuredFieldReview && (
        <div className="field-review-submit">
          <span>
            {phaseKey === "content-production"
              ? draft._imageReviewStage === "remaining_images"
                ? "Review only the remaining generated images. First images and accepted copy stay locked."
                : "Review each Content copy and its first generated image. Prompts are not Review items."
              : phaseKey === "batch-ideas"
                ? "Review every Content block. Accepted blocks stay locked if any Retake is sent."
                : phaseKey === "reel-video-production"
                  ? draft._reelStage === "prompt_review"
                    ? "Review each Reel prompt, approved first_frame and selected ref_image_0. Accept it or choose Retake to write an exact correction comment."
                    : "Review each generated Reel. Accept it or choose Retake to write an exact correction comment."
                : "Accept or Retake directly below each field."}
          </span>
          <button
            className="revise"
            disabled={reviewSubmitting || !hasFieldRetake || !allReviewBlocksDecided}
            onClick={submitFieldRetakes}
          >
            Send selected Retakes
          </button>
          <button
            className="approve"
            disabled={reviewSubmitting || reviewKeys.length === 0 || hasFieldRetake}
            onClick={() =>
              submitReview({
                action: "reviewCanonicalPhase",
                phaseKey,
                decision: "approve",
                ...(phaseKey === "reel-video-production"
                  ? {
                      payload: JSON.stringify({
                        reel_video_items: normalizeReelVideoItems(
                          draft,
                          (p.approvedSnapshots || [])
                            .filter(
                              (x: any) => x.phaseKey === "content-production",
                            )
                            .at(-1)?.approvedContent || {},
                          (p.approvedSnapshots || [])
                            .filter((x: any) => x.phaseKey === "batch-ideas")
                            .at(-1)?.approvedContent || {},
                        ),
                      }),
                    }
                  : {}),
              })
            }
          >
            {phaseKey === "content-production" &&
            draft._imageReviewStage !== "remaining_images"
              ? "✓ Approve first images & continue"
              : phaseKey === "reel-video-production" &&
                  draft._reelStage === "prompt_review"
                ? "✓ Approve prompts & generate Reels"
                : phaseKey === "reel-video-production"
                  ? "✓ Approve generated Reels"
                  : "✓ Approve all reviewed items"}
          </button>
        </div>
      )}
      {frozen && (
        <div className="review-freeze">
          <b>Content frozen during {phase.status}</b>
          {management && !structuredFieldReview && (
            <div>
              <label>
                Review comment
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Required for Retake"
                />
              </label>
              <button
                className="revise"
                disabled={reviewSubmitting || !note.trim()}
                onClick={() =>
                  submitReview({
                    action: "reviewCanonicalPhase",
                    phaseKey,
                    decision: "retake",
                    reviewNote: note,
                  })
                }
              >
                × Retake
              </button>
              <button
                className="approve"
                disabled={reviewSubmitting}
                onClick={() =>
                  submitReview({
                    action: "reviewCanonicalPhase",
                    phaseKey,
                    decision: "approve",
                  })
                }
              >
                ✓
              </button>
            </div>
          )}
        </div>
      )}
      {approved && (
        <div className="approved-change">
          <b>✓ Approved version {phase.version || 1}</b>
          {phaseKey !== "references" && (
            <button
              onClick={() => {
                const requestNote = prompt("Describe the requested change");
                if (requestNote)
                  act(p.id, { action: "requestChange", phaseKey, requestNote });
              }}
            >
              Request Change
            </button>
          )}
        </div>
      )}
      {reviewCount > 0 && <small>{reviewCount} Review Sessions used</small>}
    </section>
  );
}
function CompletionPanel({
  p,
  management,
  act,
}: {
  p: any;
  management: boolean;
  act: (id: string, b: Record<string, string>) => void;
}) {
  return (
    <section className="panel canonical-phase completion-panel">
      <header>
        <div>
          <p className="eyebrow">MANUAL COMPLETION GATE</p>
          <h3>Project Completion</h3>
        </div>
        <span className="phase-status-badge">{p.projectStatus}</span>
      </header>
      <div className="completion-checks">
        <button
          disabled={!management || p.deliveryConfirmed}
          onClick={() => act(p.id, { action: "confirmDelivery" })}
        >
          {p.deliveryConfirmed ? "✓" : "○"} Final files manually delivered
        </button>
        <button
          disabled={!management || p.paymentCleared}
          onClick={() => act(p.id, { action: "confirmPaymentCleared" })}
        >
          {p.paymentCleared ? "✓" : "○"} Payment fully cleared
        </button>
      </div>
    </section>
  );
}
