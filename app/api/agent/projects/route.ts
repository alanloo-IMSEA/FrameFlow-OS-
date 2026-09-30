import{requireAgentProjectRead}from"../../agent-access/service";

export async function GET(req:Request){
 const{env}=await import("cloudflare:workers"),db=env.DB;
 try{
  const agent=await requireAgentProjectRead(req,db);
  const rows=await db.prepare(`SELECT p.id AS projectId,p.client AS projectName,COALESCE(p.project_type_code,p.type) AS projectType,p.project_status AS projectStatus,p.stage,
   phase.phase_key AS currentPhaseKey,phase.label AS currentPhase,phase.status AS currentPhaseStatus
   FROM projects p
   JOIN project_members assigned ON assigned.project_id=p.id AND assigned.member_email=?
   LEFT JOIN phase_records phase ON phase.id=(SELECT current.id FROM phase_records current WHERE current.project_id=p.id AND current.status!='Approved' ORDER BY current.position LIMIT 1)
   ORDER BY p.created_at`).bind(agent.agentId).all();
  const projects=(rows.results as any[]).map(row=>({
   projectName:row.projectName,projectId:row.projectId,projectType:row.projectType,projectStatus:row.projectStatus,
   currentPhaseKey:row.currentPhaseKey||null,currentPhase:row.currentPhase||row.stage||null,currentPhaseStatus:row.currentPhaseStatus||null,
  }));
  await db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(NULL,?,?,?,?)").bind("agent_projects_read",agent.agentId,JSON.stringify({tokenId:agent.tokenId,projectIds:projects.map(project=>project.projectId),readOnly:true}),new Date().toISOString()).run();
  return Response.json({agent:{id:agent.agentId,name:agent.agentName},access:{scope:"projects:list",boundary:"assigned-projects-only",readOnly:true},projects},{headers:{"cache-control":"no-store"}});
 }catch(error:any){return Response.json({error:error?.message||"Agent access denied"},{status:Number(error?.status)||500,headers:{"cache-control":"no-store"}})}
}

export function POST(){return Response.json({error:"Agent Relay Project access is read-only."},{status:405,headers:{allow:"GET"}})}
export function PATCH(){return Response.json({error:"Agent Relay Project access is read-only."},{status:405,headers:{allow:"GET"}})}
export function DELETE(){return Response.json({error:"Agent Relay Project access is read-only."},{status:405,headers:{allow:"GET"}})}
