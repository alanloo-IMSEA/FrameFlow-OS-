export type WorkflowPhase={
  key:string;
  label:string;
  shortLabel?:string;
  review:"none"|"internal"|"client";
  maxReviews?:number;
  group?:string;
};

const brief:WorkflowPhase={key:"client-brief",label:"Client Brief",shortLabel:"Brief",review:"internal"};
const research:WorkflowPhase={key:"market-research",label:"Market Research",shortLabel:"Research",review:"internal"};
const socialReferences:WorkflowPhase={key:"references",label:"Project References",shortLabel:"References",review:"internal"};
const payment:WorkflowPhase={key:"payment-status",label:"Payment Status",shortLabel:"Payment",review:"none"};

const aiVideo:WorkflowPhase[]=[
  payment,brief,research,
  {key:"creative-direction",label:"Creative Direction",shortLabel:"Direction",review:"internal"},
  {key:"script",label:"Script",review:"client",maxReviews:3},
  {key:"keyshot-set",label:"Keyshot Image Set",shortLabel:"Keyshots",review:"client",maxReviews:3},
  {key:"video-generation",label:"Video Generation",shortLabel:"Video Gen",review:"none"},
  {key:"final-video",label:"Final Video",review:"client",maxReviews:3},
  {key:"final-delivery",label:"Final Delivery",shortLabel:"Delivery",review:"none"},
  {key:"project-completion",label:"Project Completion",shortLabel:"Completion",review:"none"},
];

const aiVideoPackage:WorkflowPhase[]=[
  payment,brief,research,
  {key:"video-slot-bank",label:"Video Slot Bank",shortLabel:"Slots",review:"none"},
  {key:"project-completion",label:"Project Completion",shortLabel:"Completion",review:"none"},
];

const aiVideoRecurring:WorkflowPhase[]=[
  payment,brief,research,
  {key:"batch-directions",label:"Creative Directions · Per Video",shortLabel:"Directions",review:"internal",group:"2-Week Batch"},
  {key:"batch-script-review",label:"Script Batch · Client Review",shortLabel:"Scripts",review:"client",maxReviews:3,group:"2-Week Batch"},
  {key:"keyshots-per-video",label:"Keyshot Review · Per Video",shortLabel:"Keyshots",review:"client",maxReviews:3},
  {key:"video-generation",label:"Video Generation",shortLabel:"Video Gen",review:"none"},
  {key:"final-video-batch",label:"Final Videos · Batch Review",shortLabel:"Final Review",review:"client",maxReviews:3},
  {key:"final-delivery",label:"Final Delivery",shortLabel:"Delivery",review:"none"},
];

const aiReels:WorkflowPhase[]=[
  payment,brief,research,
  {key:"idea-hook-story",label:"Idea / Hook / Story",shortLabel:"Ideas",review:"client",maxReviews:2,group:"2-Week Batch Gate"},
  {key:"image-keyframe",label:"Image / Keyframe",shortLabel:"Keyframes",review:"internal"},
  {key:"video-generation",label:"Video Generation",shortLabel:"Video Gen",review:"none"},
  {key:"internal-final-qc",label:"Internal Final QC",shortLabel:"Final QC",review:"internal"},
  {key:"final-reel",label:"Final Reel",review:"client",maxReviews:2,group:"Batch Client Review"},
  {key:"final-delivery",label:"Final Delivery",shortLabel:"Delivery",review:"none"},
  {key:"project-completion",label:"Project Completion",shortLabel:"Completion",review:"none"},
];

const internalSocial:WorkflowPhase[]=[
  brief,research,socialReferences,
  {key:"strategy-direction",label:"Strategy & Creative Direction",shortLabel:"Strategy",review:"internal"},
  {key:"batch-ideas",label:"2-Week Batch Ideas",shortLabel:"Batch Ideas",review:"internal",group:"2-Week Batch"},
  {key:"content-production",label:"Content Production",shortLabel:"Production",review:"internal"},
  {key:"reel-video-production",label:"Reel Video Production",shortLabel:"Reel Video",review:"internal"},
  {key:"publishing",label:"Task Files",shortLabel:"Files",review:"none"},
];

const clientSocial:WorkflowPhase[]=[
  payment,brief,research,socialReferences,
  {key:"monthly-direction",label:"Monthly Creative Direction",shortLabel:"Direction",review:"internal",group:"Monthly Cycle"},
  {key:"batch-ideas",label:"2-Week Batch Ideas",shortLabel:"Batch Ideas",review:"internal",group:"2-Week Batch"},
  {key:"content-production",label:"Content Production",shortLabel:"Production",review:"internal"},
  {key:"reel-video-production",label:"Reel Video Production",shortLabel:"Reel Video",review:"internal"},
  {key:"internal-qc",label:"Internal QC",review:"internal"},
  {key:"client-publishing-approval",label:"Final Content Approval",shortLabel:"Client Approval",review:"client",maxReviews:2},
  {key:"publishing",label:"Task Files",shortLabel:"Files",review:"none"},
];

const mvNoSong:WorkflowPhase[]=[
  payment,brief,
  {key:"research-style",label:"Research / Style",shortLabel:"Research",review:"internal"},
  {key:"lyrics-style",label:"Lyrics + Song Style",shortLabel:"Lyrics",review:"internal",group:"Song Creation"},
  {key:"internal-song-tests",label:"Internal Song Tests",shortLabel:"Song Tests",review:"internal",group:"Song Creation"},
  {key:"lyrics-client-approval",label:"Lyrics Client Approval",shortLabel:"Lyrics Approval",review:"client",group:"Song Creation"},
  {key:"formal-song-generation",label:"Formal Song Generation",shortLabel:"Song Generation",review:"none",group:"Song Creation"},
  {key:"song-client-approval",label:"Song Client Approval",shortLabel:"Song Approval",review:"client",group:"Song Creation"},
  {key:"mv-direction",label:"MV Creative Direction / Visual Concept",shortLabel:"MV Direction",review:"internal"},
  {key:"direction-client-approval",label:"Visual Concept Client Approval",shortLabel:"Concept Approval",review:"client"},
  {key:"storyboard-keyshots",label:"Storyboard + Keyshots Aligned to Song",shortLabel:"Storyboard + Keyshots",review:"client"},
  {key:"video-generation",label:"Video Generation",shortLabel:"Video Gen",review:"none"},
  {key:"editing",label:"Editing",review:"none"},
  {key:"final-mv-review",label:"Final MV Client Review",shortLabel:"Final Review",review:"client"},
  {key:"final-delivery",label:"Final Delivery",shortLabel:"Delivery",review:"none"},
  {key:"project-completion",label:"Project Completion",shortLabel:"Completion",review:"none"},
];

const mvFinishedSong:WorkflowPhase[]=[
  payment,brief,
  {key:"client-song-upload",label:"Client Song & Lyrics Upload",shortLabel:"Song Upload",review:"internal"},
  {key:"mv-direction",label:"MV Creative Direction / Visual Concept",shortLabel:"MV Direction",review:"internal"},
  {key:"direction-client-approval",label:"Visual Concept Client Approval",shortLabel:"Concept Approval",review:"client"},
  {key:"storyboard-keyshots",label:"Storyboard + Keyshots Aligned to Song",shortLabel:"Storyboard + Keyshots",review:"client"},
  {key:"video-generation",label:"Video Generation",shortLabel:"Video Gen",review:"none"},
  {key:"editing",label:"Editing",review:"none"},
  {key:"final-mv-review",label:"Final MV Client Review",shortLabel:"Final Review",review:"client"},
  {key:"final-delivery",label:"Final Delivery",shortLabel:"Delivery",review:"none"},
  {key:"project-completion",label:"Project Completion",shortLabel:"Completion",review:"none"},
];

const lab:WorkflowPhase[]=[
  {key:"experiment-brief",label:"Experiment Brief",shortLabel:"Brief",review:"internal"},
  {key:"experiment-setup",label:"Model / Tool / Framework Setup",shortLabel:"Setup",review:"none"},
  {key:"experiment",label:"Experiment",review:"none"},
  {key:"milestone-review",label:"Milestone Review",shortLabel:"Review",review:"internal"},
  {key:"rd-outcome",label:"Successful / Failed Outcome",shortLabel:"Outcome",review:"internal"},
];

export function workflowFor(projectType:string,projectMode?:string,mvEntry?:string):WorkflowPhase[]{
  if(projectType==="AI Video"&&projectMode==="package")return aiVideoPackage;
  if(projectType==="AI Video"&&projectMode==="recurring")return aiVideoRecurring;
  if(projectType==="AI Video")return aiVideo;
  if(projectType==="AI Reels")return aiReels;
  if(projectType==="Internal Social Account")return internalSocial;
  if(projectType==="Client Social Account")return clientSocial;
  if(projectType==="MV")return mvEntry==="finished_song"?mvFinishedSong:mvNoSong;
  if(projectType==="Internal R&D / Lab")return lab;
  return aiVideo;
}

export function initialProjectStatus(projectType:string,projectMode:string){
  return ["AI Video","AI Reels","Client Social Account","MV"].includes(projectType)?"Waiting Payment":"Active";
}

export function phaseLabel(key:string,projectType:string,projectMode?:string,mvEntry?:string){
  return workflowFor(projectType,projectMode,mvEntry).find(x=>x.key===key)?.label||key;
}
