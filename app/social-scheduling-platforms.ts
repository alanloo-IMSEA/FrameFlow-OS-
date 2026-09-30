export const SOCIAL_SCHEDULE_PLATFORMS=["Instagram","Threads","TikTok","Facebook Page"] as const;
export const AUTO_PUBLISH_PLATFORMS=["Instagram","Threads"] as const;
export type SocialSchedulePlatform=(typeof SOCIAL_SCHEDULE_PLATFORMS)[number];

function isSchedulePlatform(value:string):value is SocialSchedulePlatform{
 return (SOCIAL_SCHEDULE_PLATFORMS as readonly string[]).includes(value);
}

export function canonicalSocialPlatform(value:unknown){
 const platform=String(value||"").trim();
 return platform.toLowerCase()==="facebook"||platform.toLowerCase()==="facebook page"?"Facebook Page":SOCIAL_SCHEDULE_PLATFORMS.find(item=>item.toLowerCase()===platform.toLowerCase())||platform;
}

export function configuredSchedulePlatforms(value:unknown):string[]{
 const configured=Array.isArray(value)?value.map(canonicalSocialPlatform).filter(isSchedulePlatform):[];
 return configured.length?[...new Set(configured)]:[...SOCIAL_SCHEDULE_PLATFORMS];
}

export function platformAllowedForContent(platform:unknown,contentType:unknown){
 const normalized=canonicalSocialPlatform(platform);
 return isSchedulePlatform(normalized)&&(normalized!=="TikTok"||String(contentType||"").trim().toLowerCase()==="reel");
}

export function isAutomaticPublishingPlatform(platform:unknown){
 return (AUTO_PUBLISH_PLATFORMS as readonly string[]).includes(canonicalSocialPlatform(platform));
}

export function resolvePlannedBatchItem(batchItems:any[],contentId:string,index:number){
 const exact=batchItems.find(item=>String(item?.id||item?.contentId||item?.content_id||"")===contentId);
 if(exact)return exact;
 const order=Number(String(contentId||"").match(/(\d+)/)?.[1]||index+1);
 return batchItems.find(item=>Number(item?.publishingOrder||item?.publishing_order||item?.order)===order)||batchItems[index]||{};
}
