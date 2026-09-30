export const FRAMEFLOW_I2V_FORMULA_ID="FF-VIDEO-I2V-01" as const;
export const FRAMEFLOW_I2V_FORMULA_NAME="Image-to-Video with First Frame + Project Reference" as const;
export const FRAMEFLOW_I2V_REEL_TYPE="IMAGE_TO_VIDEO" as const;
export const RUNNINGHUB_H3_WORKFLOW_ID="2096500485405868034" as const;

export type I2VShot={
 timing:string;purpose:string;subjectPerformance:string;expressionGaze:string;
 cameraFraming:string;cameraMovement:string;secondaryMotion:string;
};

export type I2VPromptItem={
 contentId:string;title:string;reelType:typeof FRAMEFLOW_I2V_REEL_TYPE;reelStyle:typeof FRAMEFLOW_I2V_REEL_TYPE;workflowId:string;
 durationSeconds:number;aspectRatio:string;videoWidth:number;videoHeight:number;
 shotCount:number;shots:I2VShot[];dialogueMode:string;musicDirection:string;
 sceneContinuity:string;physicalRealism:string;hardConstraints:string[];
 referenceRequired:boolean;firstFrameAssetId:number|null;
 referenceAssetId:number|null;referenceRole:string;compiledVideoPrompt:string;
};

const clean=(value:unknown,fallback="NEEDS CONFIRMATION")=>String(value??"").trim()||fallback;
const integer=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Math.trunc(Number(value)):fallback;
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):Math.abs(a);
const lcm=(a:number,b:number)=>Math.abs(a*b)/gcd(a,b);
const H3_SUPPORTED_ASPECT_RATIOS=[[1,1],[2,3],[3,2],[3,4],[4,3],[9,16],[16,9],[21,9]] as const;
const wordCount=(value:unknown)=>String(value??"").trim().split(/\s+/).filter(Boolean).length;
const sentence=(value:unknown,fallback="")=>{const text=clean(value,fallback).replace(/\s+/g," ").replace(/^[\s–—:;,.]+|[\s]+$/g,"");return text&&!/[.!?]$/.test(text)?`${text}.`:text};
const limitedSentence=(value:unknown,maxWords:number,fallback="")=>{
 const text=clean(value,fallback).replace(/\s+/g," ").replace(/^[\s–—:;,.]+|[\s]+$/g,"");
 const words=text.split(/\s+/).filter(Boolean),limited=words.length>maxWords?words.slice(0,maxWords).join(" "):text;
 return sentence(limited);
};

export function aspectRatioFromDimensions(width:unknown,height:unknown){
 const w=integer(width,0),h=integer(height,0);if(w<1||h<1)return"";const divisor=gcd(w,h);return`${w/divisor}:${h/divisor}`;
}

export function compatibleVideoDimensions(width:unknown,height:unknown,maxEdge=1024){
 const w=integer(width,0),h=integer(height,0);if(w<1||h<1)return{width:0,height:0,aspectRatio:""};
 const sourceRatio=w/h,[ratioWidth,ratioHeight]=H3_SUPPORTED_ASPECT_RATIOS.reduce((best,candidate)=>Math.abs(Math.log(sourceRatio/(candidate[0]/candidate[1])))<Math.abs(Math.log(sourceRatio/(best[0]/best[1])))?candidate:best),limit=Math.max(ratioWidth,ratioHeight),requiredScale=lcm(32/gcd(ratioWidth,32),32/gcd(ratioHeight,32)),rawScale=Math.floor(Math.max(32,maxEdge)/limit),scale=Math.floor(rawScale/requiredScale)*requiredScale;
 if(scale<requiredScale)return{width:0,height:0,aspectRatio:`${ratioWidth}:${ratioHeight}`};
 return{width:ratioWidth*scale,height:ratioHeight*scale,aspectRatio:`${ratioWidth}:${ratioHeight}`};
}

function defaultShots(count:number,duration:number,source:any):I2VShot[]{
 const story=clean(source?.story||source?.idea,"the approved story moment"),hook=clean(source?.hook,"the approved opening behavior");
 return Array.from({length:count},(_,index)=>{
  const start=Number((duration*index/count).toFixed(1)),end=Number((duration*(index+1)/count).toFixed(1)),last=index===count-1;
  return{
   timing:`${start.toFixed(1)}–${end.toFixed(1)}s`,
   purpose:index===0?`Make ${hook} immediately readable through behavior`:last?"Resolve the action into a natural edit-ready final state":"Develop the approved action without changing the scene",
   subjectPerformance:index===0?`Keep the opening pose for a brief stable beat. Move the eyes first toward an interaction point already visible in first_frame, let the head and shoulders follow, then begin an observable action that expresses ${story}`:last?"Complete the already-started action, release unnecessary tension in the shoulders and hands, and settle into a natural continuation rather than a camera-facing pose":"Continue the same action through a clear cause-and-response beat, with natural weight transfer and hands remaining consistent with visible objects",
   expressionGaze:index===0?"Begin from the exact visible expression; shift the eyeline for a scene-motivated reason, then let the face respond after the gaze change":last?"Let the reaction soften into a residual expression while the gaze remains engaged with the established scene":"Use a readable reaction to the established scene cue, with natural blinking and no direct-to-camera performance unless already present",
   cameraFraming:index===0?"Begin at the exact first_frame framing and perspective":"Maintain the established subject scale and believable perspective",
   cameraMovement:index===0?"Track laterally 30–50 cm at walking-slow speed, preserving the opening lens perspective and ending with the subject slightly off-centre":"Continue the same low-amplitude lateral path without a cut, abrupt zoom or orbit",
   secondaryMotion:"Preserve subtle breathing and only the hair, fabric, people, props and environmental movement already supported by first_frame"
  };
 });
}

function normalizedShots(item:any,contentIntent:any,duration:number,shotCount:number){
 const incoming=Array.isArray(item?.shots)?item.shots:[],defaults=defaultShots(shotCount,duration,contentIntent);
 return defaults.map((fallback,index)=>{const shot=incoming[index]||{},performance=clean(shot.subjectPerformance||shot.subject_performance,fallback.subjectPerformance),expression=clean(shot.expressionGaze||shot.expression_gaze,fallback.expressionGaze),camera=clean(shot.cameraMovement||shot.camera_movement,fallback.cameraMovement);return{
  timing:clean(shot.timing,fallback.timing),purpose:clean(shot.purpose||shot.shotPurpose,fallback.purpose),
  subjectPerformance:wordCount(performance)>=12&&!/Develop a specific, natural performance/i.test(performance)?performance:fallback.subjectPerformance,
  expressionGaze:wordCount(expression)>=6?expression:fallback.expressionGaze,
  cameraFraming:clean(shot.cameraFraming||shot.camera_framing,fallback.cameraFraming),
  cameraMovement:wordCount(camera)>=8&&/(\d+\s*(?:[–-]|to)?\s*\d*\s*(?:cm|centimet(?:er|re)|m\b|met(?:er|re)|degrees?))/i.test(camera)&&!/Use one restrained, physically plausible move/i.test(camera)?camera:fallback.cameraMovement,
  secondaryMotion:clean(shot.secondaryMotion||shot.secondary_motion,fallback.secondaryMotion)
 }});
}

const creativeText=(item:any)=>((Array.isArray(item?.shots)?item.shots:[]).flatMap((shot:any)=>[
 shot?.purpose||shot?.shotPurpose,shot?.subjectPerformance||shot?.subject_performance,
 shot?.expressionGaze||shot?.expression_gaze,shot?.cameraMovement||shot?.camera_movement,
 shot?.secondaryMotion||shot?.secondary_motion
]).join(" "));
const creativeTokens=(value:unknown)=>new Set(String(value??"").toLowerCase().match(/[a-z0-9]+/g)?.filter(token=>token.length>3&&!new Set(["from","with","that","this","into","while","only","keep","same","frame","first","scene","shot","camera","subject","natural"]).has(token))||[]);
export function i2vCreativeSimilarityIssues(items:any[]){
 const rows=Array.isArray(items)?items:[],issues:string[]=[];
 for(let index=0;index<rows.length;index++)for(let other=0;other<index;other++){
  const left=creativeTokens(creativeText(rows[index])),right=creativeTokens(creativeText(rows[other]));if(!left.size||!right.size)continue;
  const shared=[...left].filter(token=>right.has(token)).length,union=new Set([...left,...right]).size,similarity=union?shared/union:0;
  const leftShots=Array.isArray(rows[index]?.shots)?rows[index].shots:[],rightShots=Array.isArray(rows[other]?.shots)?rows[other].shots:[],exactFields=["purpose","subjectPerformance","expressionGaze","cameraMovement","secondaryMotion"].filter(field=>leftShots.length===rightShots.length&&leftShots.length>0&&leftShots.every((shot:any,shotIndex:number)=>String(shot?.[field]||"").trim().toLowerCase()===String(rightShots[shotIndex]?.[field]||"").trim().toLowerCase())).length;
  if(similarity>=.72||exactFields>=3)issues.push(`items[${index}].shots (creative direction is too similar to items[${other}]; rewrite the action progression, gaze motivation, camera path, environmental response and final payoff for this Reel)`);
 }
 return issues;
}

function referenceContinuitySentence(item:any){
 const role=String(item?.referenceRole||item?.reference_role||"").toUpperCase();
 if(/CHARACTER|IDENTITY|PERSON|FACE/.test(role))return"Preserve the subject's identity from ref_image_0 without importing its pose, wardrobe, lighting, background or composition.";
 if(/PRODUCT/.test(role))return"Preserve the approved product identity, geometry, material and finish from ref_image_0 without importing unrelated staging, lighting or composition.";
 if(/LOGO|BRAND|PACKAG/.test(role))return"Preserve only the approved brand, logo or packaging facts from ref_image_0 without importing unrelated objects, staging, lighting or composition.";
 if(/PROP|OBJECT/.test(role))return"Preserve only the approved object identity and physical construction from ref_image_0 without importing unrelated staging, lighting or composition.";
 if(/ENVIRONMENT|LOCATION|SCENE/.test(role))return"Preserve only the approved environmental identity from ref_image_0; first_frame remains authoritative for the opening composition, subjects, wardrobe and visible objects.";
 return"Use ref_image_0 only to preserve the approved referenced identity or object; do not import unrelated pose, wardrobe, lighting, background or composition.";
}

function dialogueDirection(item:any){
 const mode=String(item?.dialogueMode||item?.dialogue_mode||"NO_DIALOGUE").trim(),music=String(item?.musicDirection||item?.music_direction||"NO_GENERATED_MUSIC").trim(),parts:string[]=[];
 if(/NO[_\s-]*DIALOGUE|NONE|OFF/i.test(mode))parts.push("No dialogue or lip-sync performance");else parts.push(sentence(mode));
 if(/NO[_\s-]*GENERATED[_\s-]*MUSIC|NONE|OFF/i.test(music))parts.push("no generated music");else parts.push(sentence(music));
 return sentence(parts.join("; "));
}

export function compileI2VPrompt(item:any,contentIntent:any={}):string{
 const duration=Math.max(8,Math.min(15,integer(item?.durationSeconds??item?.duration_seconds,10))),shotCount=Math.max(1,Math.min(3,integer(item?.shotCount??item?.shot_count,1))),shots=normalizedShots(item,contentIntent,duration,shotCount),first=shots[0],last=shots.at(-1)||first;
 const performanceLimit=shotCount===1?40:shotCount===2?24:16,developmentEnd=Number((duration*.38).toFixed(1)),payoffEnd=Number((duration*.75).toFixed(1)),timeline=shots.length===1?`The directing objective is ${limitedSentence(first.purpose,12)} From 0.0–1.0s, preserve the opening pose and establish the visible eyeline, hand contact and weight distribution. From 1.0–${developmentEnd.toFixed(1)}s, ${limitedSentence(first.subjectPerformance,performanceLimit)} From ${developmentEnd.toFixed(1)}–${payoffEnd.toFixed(1)}s, ${limitedSentence(first.expressionGaze,16)} Let that scene-motivated response become the payoff. During ${payoffEnd.toFixed(1)}–${duration.toFixed(1)}s, resolve into ${limitedSentence(last.purpose,12)} and leave the action able to continue beyond the cut.`:shots.map((shot,index)=>{
  const purpose=`The beat purpose is ${limitedSentence(shot.purpose,10)}`;
  if(index===0)return`From ${shot.timing}, ${purpose} ${limitedSentence(shot.subjectPerformance,performanceLimit)} ${limitedSentence(shot.expressionGaze,12)}`;
  if(index===shots.length-1)return`During ${shot.timing}, ${purpose} ${limitedSentence(shot.subjectPerformance,performanceLimit)} ${limitedSentence(shot.expressionGaze,12)}`;
  return`As the moment develops during ${shot.timing}, ${purpose} ${limitedSentence(shot.subjectPerformance,performanceLimit)} ${limitedSentence(shot.expressionGaze,10)}`;
 }).join(" ");
 const middle=shots[Math.min(1,shots.length-1)]||first;
 const secondaryMotion=[...new Set(shots.map(shot=>limitedSentence(shot.secondaryMotion,8)))].join(" ");
 return`For the target video, the provided first_frame is the exact opening frame at 0.00 seconds. Preserve its composition, framing, subject placement, wardrobe, location, lighting, time of day, colour palette, visible objects and spatial relationships. ${referenceContinuitySentence(item)} Keep the ${duration}-second video in the world established by first_frame.

At the opening seconds, hold the exact first_frame composition briefly so it feels stable before motion begins. ${timeline} The performance must read as one motivated chain of visible cause and response, not a collection of poses. Use only people, products, props and interaction points visibly established in first_frame. Preserve any existing hand contact and do not invent a new prop or participant. The final state must be the stated payoff, without a freeze, beauty pose or unmotivated look into camera.

Begin the camera with ${limitedSentence(first.cameraFraming,10)} ${limitedSentence(first.cameraMovement,20)} Through the middle, ${limitedSentence(middle.cameraMovement,16)} Keep the path continuous, motivated by the visible action, with believable perspective and parallax. Avoid aggressively recentering the subject. Finish with ${limitedSentence(last.cameraFraming,10)} and the ending placement specified by the shot direction.

${limitedSentence(item?.sceneContinuity||item?.scene_continuity,18,"Preserve the opening light direction, colour temperature, atmosphere, background layout and visible spatial relationships throughout")} Environmental motion: ${secondaryMotion} ${limitedSentence(item?.physicalRealism||item?.physical_realism,18,"Maintain natural weight transfer, anatomy, hand contact, blinking, breathing, hair and fabric response, with stable faces, materials, shadows and reflections")} ${limitedSentence(dialogueDirection(item),16)} Do not add text, effects, lighting changes or scene elements not authorized by first_frame.`;
}

export function i2vProviderPromptIssues(prompt:unknown){
 const value=String(prompt??"").trim(),issues:string[]=[],words=wordCount(value);
 if(words<250||words>450)issues.push("compiledVideoPrompt must contain 250–450 English words.");
 if(!/first_frame[^.]{0,100}exact opening frame[^.]{0,60}0\.00 seconds/i.test(value))issues.push("compiledVideoPrompt must anchor first_frame as the exact opening frame at 0.00 seconds.");
 if(!/ref_image_0/i.test(value))issues.push("compiledVideoPrompt must preserve the selected ref_image_0 authority in one concise sentence.");
 if(!/(opening|first)[^\n.]{0,80}(seconds|beat)/i.test(value)||!/(develop|middle|as the moment)/i.test(value)||!/(final seconds|by the end|final state)/i.test(value))issues.push("compiledVideoPrompt must direct an opening, development and final state over time.");
 if(!/camera/i.test(value)||!/(\d+\s*(?:[–-]|to)?\s*\d*\s*(?:cm|centimet(?:er|re)|m\b|met(?:er|re)|degrees?)|small amplitude|low-amplitude)/i.test(value))issues.push("compiledVideoPrompt must give the camera a concrete path and movement amplitude.");
 if(!/only (?:people|objects|people, products|interactions|subjects)|visibly (?:present|established|supported)|already visible/i.test(value))issues.push("compiledVideoPrompt must restrict interaction to subjects and objects visible in first_frame.");
 if(/FRAMEFLOW FORMULA|Reel type:|Content intent:|Tier 0|Tier 1|Shot count:|Sampler|REFERENCE AUTHORITY|SCENE CONTINUITY\s*$|PHYSICAL REALISM\s*$|HARD CONSTRAINTS/i.test(value))issues.push("compiledVideoPrompt contains FrameFlow orchestration metadata instead of provider-facing direction.");
 if(/Develop a specific, natural performance|Use one restrained, physically plausible move/i.test(value))issues.push("compiledVideoPrompt contains abstract placeholder direction that the Agent must resolve.");
 return issues;
}

export function normalizeI2VPromptItem(input:any,options:{contentId:string;title:string;contentIntent?:any;subjectPresence?:unknown;firstFrameAssetId?:number|null;referenceAssetId?:number|null;characterReferenceAssetId?:number|null;referenceRole?:string;sourceWidth?:number;sourceHeight?:number}):I2VPromptItem{
 const durationSeconds=Math.max(8,Math.min(15,integer(input?.durationSeconds??input?.duration_seconds,10))),shotCount=Math.max(1,Math.min(3,integer(input?.shotCount??input?.shot_count,1))),dimensions=compatibleVideoDimensions(options.sourceWidth,options.sourceHeight),referenceAssetId=Number(options.referenceAssetId??options.characterReferenceAssetId??input?.referenceAssetId??input?.reference_asset_id??input?.characterReferenceAssetId??input?.character_reference_asset_id)||null,referenceRole=clean(options.referenceRole||input?.referenceRole||input?.reference_role||"PROJECT_REFERENCE"),shots=normalizedShots(input,options.contentIntent,durationSeconds,shotCount),partial={...input,durationSeconds,shotCount,aspectRatio:dimensions.aspectRatio||clean(input?.aspectRatio||input?.aspect_ratio,""),shots,referenceRole},compiledVideoPrompt=compileI2VPrompt(partial,options.contentIntent);
 return{contentId:options.contentId,title:options.title,reelType:FRAMEFLOW_I2V_REEL_TYPE,reelStyle:FRAMEFLOW_I2V_REEL_TYPE,workflowId:RUNNINGHUB_H3_WORKFLOW_ID,durationSeconds,aspectRatio:partial.aspectRatio,videoWidth:dimensions.width||integer(input?.videoWidth??input?.video_width,0),videoHeight:dimensions.height||integer(input?.videoHeight??input?.video_height,0),shotCount,shots,dialogueMode:clean(input?.dialogueMode||input?.dialogue_mode,"NO_DIALOGUE"),musicDirection:clean(input?.musicDirection||input?.music_direction,"NO_GENERATED_MUSIC; preserve edit flexibility"),sceneContinuity:clean(input?.sceneContinuity||input?.scene_continuity,"Preserve the first_frame environment and lighting throughout."),physicalRealism:clean(input?.physicalRealism||input?.physical_realism,"Maintain physically plausible anatomy, contact, materials and environmental motion."),hardConstraints:Array.isArray(input?.hardConstraints||input?.hard_constraints)?(input.hardConstraints||input.hard_constraints).map(String):[],referenceRequired:true,firstFrameAssetId:options.firstFrameAssetId??null,referenceAssetId,referenceRole,compiledVideoPrompt};
}

export function i2vValidationIssues(item:any,options:{workflowMappingExists?:boolean}={}){
 const issues:string[]=[],duration=Number(item?.durationSeconds),shotCount=Number(item?.shotCount);
 if(item?.reelType!==FRAMEFLOW_I2V_REEL_TYPE)issues.push("Reel Type must be IMAGE_TO_VIDEO.");
 if(!item?.firstFrameAssetId)issues.push("Select an approved first frame from Image Production.");
 if(item?.referenceRequired!==false&&!item?.referenceAssetId)issues.push("Select a Project Reference for ref_image_0.");
 if(!Number.isInteger(duration)||duration<8||duration>15)issues.push("Duration must be an integer from 8 to 15 seconds.");
 if(!Number.isInteger(shotCount)||shotCount<1||shotCount>3)issues.push("Shot count must be an integer from 1 to 3.");
 if(!/^\d+:\d+$/.test(String(item?.aspectRatio||""))||Number(item?.videoWidth)<1||Number(item?.videoHeight)<1)issues.push("The approved first frame must provide a readable aspect ratio and compatible video dimensions.");
 if(!String(item?.compiledVideoPrompt||"").trim())issues.push("compiledVideoPrompt is required.");else issues.push(...i2vProviderPromptIssues(item.compiledVideoPrompt));
 if(options.workflowMappingExists===false)issues.push("Configure the RunningHub MiniMax H3 workflow node mapping in Tier 0 System Connections.");
 if(!Array.isArray(item?.shots)||item.shots.length!==shotCount)issues.push("Shot timings and performance blocks must match shotCount.");else item.shots.forEach((shot:any,index:number)=>{for(const field of["timing","purpose","subjectPerformance","expressionGaze","cameraFraming","cameraMovement","secondaryMotion"])if(!String(shot?.[field]||"").trim())issues.push(`Shot ${index+1} ${field} is required.`)});
 return issues;
}
