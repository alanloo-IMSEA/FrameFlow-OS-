import{integrationStatus}from"../../integrations/_lib";
import{publicConnection,socialAccess}from"../../social-connections/_lib";
import{AUTOPOST_ENABLED,autoPostNotFound}from"../../../autopost-mode";
import{TIKTOK_SCOPES,projectConnection,runtime}from"../_lib";

export async function GET(req:Request){
 if(!AUTOPOST_ENABLED)return autoPostNotFound();
 const env=await runtime(),projectId=String(new URL(req.url).searchParams.get("projectId")||"");try{await socialAccess(req,env.DB,projectId)}catch(error:any){return Response.json({error:error.message},{status:error.status||403})}
 const app=await integrationStatus(env.DB,"tiktok-app"),connection=await projectConnection(env.DB,env,projectId);
 return Response.json({configured:Boolean(app.connected),connected:Boolean(connection?.connected),needsReconnect:Boolean(connection?.expired),app:{redirectUri:new URL("/api/tiktok/callback",req.url).toString(),scopes:TIKTOK_SCOPES},account:publicConnection(connection),publishing:{enabled:false,status:"NOT_IMPLEMENTED"}});
}
