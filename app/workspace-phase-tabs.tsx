"use client";
import{workflowFor}from"./workflow-definition";

export default function WorkspacePhaseTabs({p,step,onSelect,onAssign}:{p:any;recurring?:boolean;step:string;onSelect:(step:string)=>void;onAssign:()=>void}){
 const phases=workflowFor(p.projectType||p.type,p.projectMode,p.mvEntry),records:Array<any>=p.phaseRecords||[];
 return <><div className="project-tools-row"><button type="button" onClick={onAssign}>⚙ Project Settings · Assign People</button><span>Roadmap and workspace use one confirmed phase source.</span></div><div className="phase-tabs production-tabs exact-phase-tabs canonical-tabs">{phases.map((phase,index)=>{const status=records.find(x=>x.phaseKey===phase.key)?.status||(index===0?"In Progress":"Locked"),locked=status==="Locked";return <button key={phase.key} disabled={locked} className={`${step===phase.key?"active":""} ${status.toLowerCase().replaceAll(" ","-")}`} onClick={()=>onSelect(phase.key)}><i>{status==="Approved"?"✓":String(index+1).padStart(2,"0")}</i><span>{phase.label}</span>{status!=="Approved"&&status!=="Locked"&&<small>{status}</small>}</button>})}</div></>
}
