import{requireMemoryManagement}from"../memory/management";
import{buildScopedAgentMemory}from"../memory/service";
import{LOG_MEMORY_BOUNDARY,MEMORY_AUTHORITY_RULE,MEMORY_POLICY_VERSION}from"../memory/policy";

export async function GET(req:Request){
 const{env}=await import("cloudflare:workers"),db=env.DB;
 try{
  const actor=await requireMemoryManagement(req,db),url=new URL(req.url),projectId=String(url.searchParams.get("projectId")||"").trim(),rows=projectId?await db.prepare("SELECT id FROM projects WHERE id=? ORDER BY created_at").bind(projectId).all():await db.prepare("SELECT id FROM projects ORDER BY created_at").all(),lines:any[]=[{schema:"frameflow.trusted-memory-export.v1",policyVersion:MEMORY_POLICY_VERSION,exportedAt:new Date().toISOString(),exportedBy:actor.email,authorityRule:MEMORY_AUTHORITY_RULE,logBoundary:LOG_MEMORY_BOUNDARY,containsRawLogs:false}];
  for(const project of rows.results as any[])lines.push({recordType:"trusted_project_memory",projectId:project.id,memory:await buildScopedAgentMemory(db,String(project.id),{includeApproved:true,includeLearning:true,includePerformance:true})});
  return new Response(lines.map(row=>JSON.stringify(row)).join("\n"),{headers:{"content-type":"application/x-ndjson; charset=utf-8","content-disposition":`attachment; filename="FrameFlow_Trusted_Memory_${new Date().toISOString().slice(0,10)}.jsonl"`,"cache-control":"no-store"}});
 }catch(error:any){return Response.json({error:error?.message||"Memory export failed."},{status:Number(error?.status)||500,headers:{"cache-control":"no-store"}})}
}
