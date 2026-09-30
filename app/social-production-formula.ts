export type WardrobeMode="DEFINE"|"INHERIT_FROM_ANCHOR"|"INTENTIONAL_CHANGE"|"NOT_APPLICABLE";
export type WardrobeData={mode:WardrobeMode|"";top:string;bottom:string;shoes:string;accessories:string;colorPalette:string;materialBehavior:string;wardrobeLogic:string};

const WARDROBE_MODES=new Set<WardrobeMode>(["DEFINE","INHERIT_FROM_ANCHOR","INTENTIONAL_CHANGE","NOT_APPLICABLE"]);
const FULL_WARDROBE_FIELDS:[keyof WardrobeData,string][]=[
 ["top","top"],["bottom","bottom"],["shoes","shoes"],["accessories","accessories"],["colorPalette","colorPalette"],["materialBehavior","materialBehavior"],["wardrobeLogic","wardrobeLogic"]
];
const WARDROBE_BLOCK=/\n?SYSTEM WARDROBE DATA BEGIN[\s\S]*?SYSTEM WARDROBE DATA END\n?/g;

function value(source:any,...keys:string[]){for(const key of keys){const found=source?.[key];if(found!==undefined&&found!==null&&String(found).trim())return String(found)}return"NEEDS CONFIRMATION"}
function field(source:any,...keys:string[]){for(const key of keys){const found=source?.[key];if(found!==undefined&&found!==null)return String(found).trim()}return""}
function hasSections(prompt:string,sections:string[]){const text=String(prompt||"");return sections.every(section=>text.includes(section))}
export function isHumanAbsent(value:any){return/(?:^|\b)(?:human[_\s-]*absent|no[_\s-]*human|environment[_\s-]*only)(?:$|\b)/i.test(String(value||""))}

export function normalizeWardrobe(input:any):WardrobeData{
 const raw=input&&typeof input==="object"?input:{},mode=String(raw.mode||"").toUpperCase()as WardrobeMode;
 return{mode:WARDROBE_MODES.has(mode)?mode:"",top:field(raw,"top"),bottom:field(raw,"bottom"),shoes:field(raw,"shoes"),accessories:field(raw,"accessories"),colorPalette:field(raw,"colorPalette","color_palette"),materialBehavior:field(raw,"materialBehavior","material_behavior"),wardrobeLogic:field(raw,"wardrobeLogic","wardrobe_logic")};
}

function fullWardrobeIssues(wardrobe:WardrobeData){return FULL_WARDROBE_FIELDS.filter(([key])=>!wardrobe[key]).map(([,label])=>`${label} is required when wardrobe.mode=${wardrobe.mode}`)}
export function wardrobeValidationIssues(input:any,options:{assetNumber?:number;subjectPresence?:any;anchorWardrobe?:any;approvedWardrobeChanges?:number[];reel?:boolean}={}){
 const wardrobe=normalizeWardrobe(input),assetNumber=Number(options.assetNumber||1),humanAbsent=isHumanAbsent(options.subjectPresence),issues:string[]=[];
 if(!wardrobe.mode)return["wardrobe.mode must be DEFINE, INHERIT_FROM_ANCHOR, INTENTIONAL_CHANGE or NOT_APPLICABLE"];
 if(humanAbsent&&wardrobe.mode!=="NOT_APPLICABLE")issues.push("wardrobe.mode must be NOT_APPLICABLE when subjectPresence is HUMAN_ABSENT");
 if(!humanAbsent&&wardrobe.mode==="NOT_APPLICABLE")issues.push("wardrobe.mode NOT_APPLICABLE requires subjectPresence HUMAN_ABSENT");
 if(wardrobe.mode==="NOT_APPLICABLE")return issues;
 if(wardrobe.mode==="DEFINE"){
  if(options.reel||assetNumber>1)issues.push("Continuation and Reel assets must use INHERIT_FROM_ANCHOR or INTENTIONAL_CHANGE instead of DEFINE");
  issues.push(...fullWardrobeIssues(wardrobe));return issues;
 }
 if(wardrobe.mode==="INHERIT_FROM_ANCHOR"){
  const anchor=normalizeWardrobe(options.anchorWardrobe);if(anchor.mode!=="DEFINE"||fullWardrobeIssues(anchor).length)issues.push("INHERIT_FROM_ANCHOR requires a valid DEFINE wardrobe on the Content Anchor asset");
  return issues;
 }
 if(wardrobe.mode==="INTENTIONAL_CHANGE"){
  const approved=(options.approvedWardrobeChanges||[]).map(Number);if(!options.reel&&!approved.includes(assetNumber))issues.push(`INTENTIONAL_CHANGE is not approved by the Content Plan for asset ${assetNumber}`);
  issues.push(...fullWardrobeIssues(wardrobe));return issues;
 }
 return issues;
}

export function resolvedWardrobe(input:any,anchorInput?:any){
 const wardrobe=normalizeWardrobe(input);if(wardrobe.mode!=="INHERIT_FROM_ANCHOR")return wardrobe;
 const anchor=normalizeWardrobe(anchorInput);return{...anchor,mode:"INHERIT_FROM_ANCHOR"as WardrobeMode,wardrobeLogic:"INHERIT_FROM_APPROVED_CONTENT_ANCHOR"};
}

export function renderWardrobeBlock(input:any,anchorInput?:any){
 const wardrobe=resolvedWardrobe(input,anchorInput);
 if(wardrobe.mode==="NOT_APPLICABLE")return`SYSTEM WARDROBE DATA BEGIN
Wardrobe logic: NOT_APPLICABLE
No human clothing subject is present. Do not invent garments, shoes or wearable accessories.
SYSTEM WARDROBE DATA END`;
 const continuity=wardrobe.mode==="INHERIT_FROM_ANCHOR"?"Use the approved Content Anchor Image as the exact wardrobe source. Preserve its outfit construction, fit, colors, materials, accessories, seams, folds, drape, sheen and wear without redesign.":wardrobe.mode==="INTENTIONAL_CHANGE"?"This is the Content Plan's approved intentional wardrobe change. Replace only the wardrobe with the specification below and preserve all unrelated continuity.":"This asset defines the Content Anchor wardrobe. Lock this exact specification for later Continuation and Reel assets.";
 return`SYSTEM WARDROBE DATA BEGIN
Wardrobe mode: ${wardrobe.mode||"UNRESOLVED"}
Wardrobe logic: ${wardrobe.wardrobeLogic||wardrobe.mode||"NEEDS CONFIRMATION"}
Top: ${wardrobe.top||"NEEDS CONFIRMATION"}
Bottom: ${wardrobe.bottom||"NEEDS CONFIRMATION"}
Shoes: ${wardrobe.shoes||"NEEDS CONFIRMATION"}
Accessories: ${wardrobe.accessories||"NEEDS CONFIRMATION"}
Color palette: ${wardrobe.colorPalette||"NEEDS CONFIRMATION"}
Material behavior: ${wardrobe.materialBehavior||"NEEDS CONFIRMATION"}
Continuity instruction: ${continuity}
SYSTEM WARDROBE DATA END`;
}

export function injectWardrobeIntoPrompt(prompt:string,wardrobe:any,anchorWardrobe?:any){return`${String(prompt||"").replace(WARDROBE_BLOCK,"").trim()}

${renderWardrobeBlock(wardrobe,anchorWardrobe)}`.trim()}

export function productionPromptIssues(prompt:string,assetNumber=1){
 const required=assetNumber===1?["SECTION 1 — CONTENT INTENT","SECTION 2 — SUBJECT, STYLING & CONTINUITY","SECTION 3 — SCENE & CAPTURE","SECTION 4 — STYLE, QUALITY & OUTPUT RULES"]:["SECTION 1 — REFERENCE CONTINUITY","SECTION 2 — NEW SHOT / DELTA","SECTION 3 — STYLE, QUALITY & OUTPUT RULES"];
 const compiled=String(prompt||"").includes("Hard constraints:")&&/realistic|physical|material|fabric|gravity|contact/i.test(String(prompt||""));
 return hasSections(prompt,required)||compiled?[]:[assetNumber===1?"Structured Anchor compiled prompt":"Structured Continuation compiled prompt"];
}
export function followsProductionImageFormula(prompt:string,assetNumber=1){return productionPromptIssues(prompt,assetNumber).length===0}

export function anchorImagePrompt(source:any,visualNumber=1,assetRole=""){
 const title=value(source,"title"),story=value(source,"story","idea"),message=value(source,"keyMessage","key_message"),presence=value(source,"characterPresence","character_presence"),visual=value(source,"visualRequirement","visual_requirement"),role=assetRole||`Visual ${visualNumber}`;
 return`SECTION 1 — CONTENT INTENT
- Content type / platform use: ${value(source,"contentType","content_type")} — ${role}
- Story moment and intention: ${story}
- Key message: ${message}
- Character presence: ${presence}
- This is the primary Content Anchor Image for “${title}”. Establish one decisive platform-ready visual, not a collage.

SECTION 2 — SUBJECT, STYLING & CONTINUITY
- Main subject / character identity: follow the approved identity and selected reference manifest.
- Hairstyle / makeup / body presentation: define the exact approved appearance and natural presentation when a person is present.
- Pose / action / expression: define a specific pose, hand interaction, eyeline and expression from the approved story moment.
- Wardrobe is supplied by the system-resolved structured wardrobe block; do not replace it with a generic outfit description.

SECTION 3 — SCENE & CAPTURE
- Environment / location: ${visual}
- Framing / composition / camera angle: choose a deliberate platform-native composition supporting the Hook.
- Lens feel: define focal-length character, perspective and depth behavior.
- Lighting direction and quality: use physically motivated key, fill and practical light with natural skin, fabric and prop response.
- Background behavior / realism level: believable depth, scale, shadows, reflections and environmental imperfections.

SECTION 4 — STYLE, QUALITY & OUTPUT RULES
- Visual style / mood / atmosphere: ${visual}
- Prioritize stable identity, natural face and skin detail, accurate materials, believable light and strong composition.
- Use film look, color grading, camera treatment, texture, subtle grain, bloom, contrast, exposure, lens characteristics and intentional filters for visual richness.
- Avoid plastic skin, CGI gloss, identity drift, outfit redesign, warped anatomy, duplicated accessories, false logos, fake text, HDR halos and excessive sharpening.
- Output one 1K, medium-quality, platform-ready image. No collage, contact sheet, split screen, watermark or unintended text.`;
}

export function continuationImagePrompt(source:any,visualNumber:number,assetRole=""){
 const title=value(source,"title"),visual=value(source,"visualRequirement","visual_requirement"),role=assetRole||`Visual ${visualNumber}`;
 return`SECTION 1 — REFERENCE CONTINUITY
- Use the approved Content Anchor Image for “${title}” as the primary continuity reference whenever Image 01 continuity is enabled.
- Preserve the same character identity, face, body proportions, hairstyle, makeup, props, environment, lighting logic and overall treatment.
- Use the system-resolved structured wardrobe block. INHERIT_FROM_ANCHOR carries the Anchor's exact outfit without asking Agent to rewrite it.

SECTION 2 — NEW SHOT / DELTA
- Slide / shot purpose: ${role} — define its specific story function.
- Describe only what changes from the approved anchor: camera angle, framing, pose / action, expression, camera distance, lens feel and viewpoint.
- Keep subject, wardrobe, prop and world definitions anchored unless an INTENTIONAL_CHANGE is approved in the Content Plan.

SECTION 3 — STYLE, QUALITY & OUTPUT RULES
- Maintain the established style and quality from the approved anchor; ${visual}.
- Preserve outfit construction, colors, material behavior, accessories, props and environment unless the structured wardrobe mode explicitly authorizes a change.
- Prioritize identity stability, natural facial detail, accurate materials, believable lighting and strong composition.
- Output one 1K, medium-quality, platform-ready image. No collage, contact sheet, split screen, watermark or unintended text.`;
}

export function lockProductionImagePrompt(prompt:string,source:any,visualNumber:number,assetRole="",wardrobe?:any,anchorWardrobe?:any){const text=String(prompt||"").trim(),base=followsProductionImageFormula(text,visualNumber)?text:visualNumber===1?anchorImagePrompt(source,visualNumber,assetRole):continuationImagePrompt(source,visualNumber,assetRole);return wardrobe===undefined?base:injectWardrobeIntoPrompt(base,wardrobe,anchorWardrobe)}

export function followsReelPromptFormula(prompt:string){return i2vProviderPromptIssues(prompt).length===0}

export function reelVideoPrompt(item:any,batchItem:any={}){return compileI2VPrompt(item,batchItem)}

export function lockReelVideoPrompt(prompt:string,item:any,batchItem:any={},wardrobe?:any,anchorWardrobe?:any){const text=String(prompt||"").trim(),base=followsReelPromptFormula(text)?text:reelVideoPrompt(item,batchItem);return wardrobe===undefined?base:injectWardrobeIntoPrompt(base,wardrobe,anchorWardrobe)}

export const threeSectionImagePrompt=anchorImagePrompt;
export const lockThreeSectionPrompt=lockProductionImagePrompt;
export function followsThreeSectionFormula(prompt:string){return followsProductionImageFormula(prompt,1)||followsProductionImageFormula(prompt,2)}
import{compileI2VPrompt,i2vProviderPromptIssues}from"./video-prompt-architecture";
