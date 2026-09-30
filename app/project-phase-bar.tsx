"use client";
import{workflowFor}from"./workflow-definition";

const statusClass=(status:string)=>String(status||"Locked").toLowerCase().replaceAll(" ","-");

export default function ProjectPhaseBar({p,current,onSelect}:{p:any;recurring?:boolean;current?:string;onSelect?:(key:string)=>void}){
 const type=p.projectType||p.type,phases=workflowFor(type,p.projectMode,p.mvEntry),records:Array<any>=p.phaseRecords||[];
 return <section className="phase-roadmap canonical-roadmap">
  <div className="phase-legend"><span><i className="done"/>✅</span><span><i className="active"/>In Progress</span><span><i className="review"/>Reviewing</span><span><i className="client-reviewing"/>Client Reviewing</span><span><i className="revision"/>Retake</span><span><i/>Locked</span></div>
  <div className="phase-roadmap-scroll"><div className="phase-roadmap-track">{phases.map((phase,index)=>{
   const record=records.find(x=>x.phaseKey===phase.key),status=record?.status||(index===0?"In Progress":"Locked"),approved=status==="Approved";
   const historyAvailable=["Internal Social Account","Client Social Account"].includes(type)&&["publishing","batch-learning"].includes(phase.key)&&(p.batches||[]).some((batch:any)=>batch.status!=="Locked");
   return <button type="button" disabled={status==="Locked"&&!historyAvailable} onClick={()=>onSelect?.(phase.key)} className={`phase-node ${statusClass(historyAvailable&&status==="Locked"?"In Progress":status)} ${current===phase.key?"selected":""}`} key={phase.key}>
    <small className={phase.group?"":"phase-group-empty"}>{phase.group||"\u00a0"}</small>
    <span>{approved?"✓":String(index+1).padStart(2,"0")}</span>
    <b>{phase.label}</b>
    {!approved&&(status!=="Locked"||historyAvailable)&&<em>{status==="Locked"?"Batch history":status}</em>}
   </button>
  })}</div></div>
 </section>
}
