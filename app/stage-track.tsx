"use client";
import{workflowFor}from"./workflow-definition";

export function StageTrack({project}:{project:any}){
 const phases=workflowFor(project.projectType||project.type,project.projectMode,project.mvEntry),records:Array<any>=project.phaseRecords||[];
 return <div className="stage-track canonical-mini-track" aria-label={`Current phase: ${project.stage}`}>
  {phases.map(phase=>{const status=records.find(x=>x.phaseKey===phase.key)?.status||(phase.key===phases[0].key?"In Progress":"Locked"),cls=status.toLowerCase().replaceAll(" ","-");return <div className={`stage-stop ${cls}`} key={phase.key}><span>{status==="Approved"?"✓":phases.indexOf(phase)+1}</span><small>{phase.shortLabel||phase.label}</small></div>})}
 </div>
}
