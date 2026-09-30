import{requireAgentAccess,requireAssignedProject}from"../../../../agent-access/service";
import{buildScopedAgentMemory}from"../../../../memory/service";

const allowedLayers=new Set(["approved","learning","performance"]);
export async function GET(req:Request,{params}:{params:Promise<{projectId:string}>}){
 const{env}=await import("cloudflare:workers"),db=env.DB;
 try{
  const url=new URL(req.url),rawRequested=(url.searchParams.get("layers")||"approved,learning").split(",").map(x=>x.trim()).filter(Boolean),unknown=rawRequested.filter(layer=>!allowedLayers.has(layer));if(unknown.length)return Response.json({error:`Unknown Memory layer: ${unknown.join(", ")}. Allowed layers are approved, learning, performance.`},{status:400});const requested=[...new Set(rawRequested)];if(!requested.length)return Response.json({error:"Choose at least one allowed Memory layer: approved, learning, performance."},{status:400});
  const required=[...(requested.includes("approved")?["memory:read:approved"]:[]),...(requested.includes("learning")?["memory:read:learning"]:[]),...(requested.includes("performance")?["performance:read"]:[])],agent=await requireAgentAccess(req,db,required),{projectId}=await params;await requireAssignedProject(db,agent.agentId,projectId);
  const phaseKey=url.searchParams.get("phaseKey"),contentId=url.searchParams.get("contentId"),taskId=url.searchParams.get("taskId"),memory=await buildScopedAgentMemory(db,projectId,{phaseKey,contentId,taskId,includeApproved:requested.includes("approved"),includeLearning:requested.includes("learning"),includePerformance:requested.includes("performance")});
  await db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"agent_memory_read",agent.agentId,JSON.stringify({tokenId:agent.tokenId,layers:requested,phaseKey,contentId,taskId,readOnly:true}),new Date().toISOString()).run();
  return Response.json({agent:{id:agent.agentId,name:agent.agentName},access:{scopes:required,boundary:"assigned-project-and-requested-scope",readOnly:true},...memory},{headers:{"cache-control":"no-store"}});
 }catch(error:any){return Response.json({error:error?.message||"Agent access denied",missingScopes:error?.missingScopes},{status:Number(error?.status)||500,headers:{"cache-control":"no-store"}})}
}
export function POST(){return Response.json({error:"Agent Memory access is read-only."},{status:405,headers:{allow:"GET"}})}
export const PATCH=POST;export const DELETE=POST;
