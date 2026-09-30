import{integrationStatus}from"../../integrations/_lib";
import{publicConnection,socialAccess}from"../../social-connections/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";
import{projectConnection,runtime}from"../_lib";

export async function GET(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),projectId=String(new URL(req.url).searchParams.get("projectId")||"");try{await socialAccess(req,env.DB,projectId)}catch(error:any){return Response.json({error:error.message},{status:error.status||403})}
 const app=await integrationStatus(env.DB,"threads-app"),connection=await projectConnection(env.DB,env,projectId);
 return Response.json({configured:Boolean(app.connected),connected:Boolean(connection?.connected),needsReconnect:Boolean(connection?.expired),app:{apiVersion:app.config?.apiVersion||"v1.0",redirectUri:new URL("/api/threads/callback",req.url).toString()},account:publicConnection(connection)});
}
