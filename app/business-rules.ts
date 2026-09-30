export const PROJECT_TYPES=["AI Video","AI Reels","Internal Social Account","Client Social Account","MV","Internal R&D / Lab"] as const;
// Keep dormant project types available for historical records and future reactivation,
// while the production UI currently exposes only the two active Social workflows.
export const ACTIVE_PROJECT_TYPES=["Internal Social Account","Client Social Account"] as const;
export const PROJECT_STATUSES=["Active","Waiting Payment","Inactive","Ready to Complete","Completed","Archived"] as const;
export const PHASE_STATUSES=["Locked","In Progress","Reviewing","Client Reviewing","Retake","Reopened","Approved"] as const;
export const AI_VIDEO_PURPOSES=["Commercial Video","Brand Film","Product Intro","Other"] as const;

export function allowedModes(type:string){
 if(type==="AI Video")return["one_off","package","recurring"];
 if(type==="AI Reels")return["one_off","recurring"];
 if(type==="Internal Social Account"||type==="Client Social Account")return["continuous"];
 if(type==="Internal R&D / Lab")return["lab"];
 return["one_off"];
}

export function legacyClassification(type:string,nature?:string){
 if(type==="MV")return{projectType:"MV",projectMode:"one_off",purpose:null};
 if(/commercial|brand film|product intro|film series/i.test(type))return{projectType:"AI Video",projectMode:type==="Commercial Film Series"?"package":nature==="recurring"?"recurring":"one_off",purpose:/brand film/i.test(type)?"Brand Film":/product intro/i.test(type)?"Product Intro":"Commercial Video"};
 if(/reels package/i.test(type))return{projectType:"AI Reels",projectMode:nature==="recurring"?"recurring":"one_off",purpose:null};
 if(/social account/i.test(type))return{projectType:"Internal Social Account",projectMode:"continuous",purpose:null};
 return{projectType:type||"AI Video",projectMode:nature||"one_off",purpose:null};
}

export const REVIEW_LIMITS={aiVideo:3,aiReels:2,goodwillFinalCheck:1,clientSocialRedo:2} as const;
