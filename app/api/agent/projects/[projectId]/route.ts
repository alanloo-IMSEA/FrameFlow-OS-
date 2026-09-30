import{requireAgentAccess,requireAssignedProject}from"../../../agent-access/service";

export async function GET(req:Request,{params}:{params:Promise<{projectId:string}>}){
 const{env}=await import("cloudflare:workers"),db=env.DB;
 try{
  const agent=await requireAgentAccess(req,db,["project:read"]),{projectId}=await params;await requireAssignedProject(db,agent.agentId,projectId);
  const project=await db.prepare("SELECT p.id AS projectId,p.team_id AS workspaceId,p.client AS projectName,COALESCE(p.project_type_code,p.type) AS projectType,p.project_mode AS projectMode,p.project_status AS projectStatus,p.stage,p.purpose,p.deliverables,p.restrictions,phase.phase_key AS currentPhaseKey,phase.label AS currentPhase,phase.status AS currentPhaseStatus FROM projects p LEFT JOIN phase_records phase ON phase.id=(SELECT current.id FROM phase_records current WHERE current.project_id=p.id AND current.status!='Approved' ORDER BY current.position LIMIT 1) WHERE p.id=? LIMIT 1").bind(projectId).first<any>();
  if(!project)return Response.json({error:"Project not found."},{status:404});
  await db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"agent_project_read",agent.agentId,JSON.stringify({tokenId:agent.tokenId,scope:"project:read",readOnly:true}),new Date().toISOString()).run();
  return Response.json({schema:"frameflow.agent-project.v1",agent:{id:agent.agentId,name:agent.agentName},access:{scope:"project:read",boundary:"assigned-project-only",readOnly:true},project},{headers:{"cache-control":"no-store"}});
 }catch(error:any){return Response.json({error:error?.message||"Agent access denied",missingScopes:error?.missingScopes},{status:Number(error?.status)||500,headers:{"cache-control":"no-store"}})}
}
export function POST(){return Response.json({error:"Agent Relay Project access is read-only."},{status:405,headers:{allow:"GET"}})}
export const PATCH=POST;export const DELETE=POST;
