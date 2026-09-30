import{runPublishingScheduler}from"../scheduler";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";

async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
export async function POST(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),email=(req.headers.get("oai-authenticated-user-email")||"").toLowerCase(),member=email?await env.DB.prepare("SELECT tier FROM members WHERE email=?").bind(email).first<any>():null;
 if(Number(member?.tier??99)>1)return Response.json({error:"Tier 0–1 Management access required."},{status:403});
 return Response.json({ok:true,...await runPublishingScheduler(env.DB,env,new URL(req.url).origin)});
}
