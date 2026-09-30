import{orchestratorAccess}from"../orchestrator/access";
import{loadIntegration}from"../integrations/_lib";

export async function socialAccess(req:Request,db:any,projectId:string,manage=false){
 if(!projectId)throw Object.assign(new Error("projectId is required."),{status:400});
 const actor=await orchestratorAccess(req,db,projectId);
 if(manage&&actor.tier>1)throw Object.assign(new Error("Tier 0–1 Management access required to change Social Connections."),{status:403});
 return actor;
}

export async function ensureConnectionIds(db:any,projectId:string){
 const missing=await db.prepare("SELECT rowid,platform FROM project_social_connections WHERE project_id=? AND connection_id IS NULL").bind(projectId).all();
 for(const row of missing.results as any[])await db.prepare("UPDATE project_social_connections SET connection_id=? WHERE rowid=?").bind(`social_${crypto.randomUUID()}`,row.rowid).run();
 const platforms=await db.prepare("SELECT DISTINCT platform FROM project_social_connections WHERE project_id=?").bind(projectId).all();
 for(const row of platforms.results as any[]){const current=await db.prepare("SELECT connection_id FROM project_social_connections WHERE project_id=? AND platform=? AND is_default=1 LIMIT 1").bind(projectId,row.platform).first();if(!current)await db.prepare("UPDATE project_social_connections SET is_default=1 WHERE connection_id=(SELECT connection_id FROM project_social_connections WHERE project_id=? AND platform=? ORDER BY CASE WHEN status='Connected' THEN 0 ELSE 1 END,connected_at LIMIT 1)").bind(projectId,row.platform).run()}
}

const connectionColumns="connection_id AS connectionId,project_id AS projectId,platform,provider_key AS providerKey,external_account_id AS accountId,profile_url AS profileUrl,handle,account_type AS accountType,status,permissions_json AS permissions,capabilities_json AS capabilities,token_expires_at AS tokenExpiresAt,connected_by AS connectedBy,connected_at AS connectedAt,last_checked_at AS lastCheckedAt,disconnected_at AS disconnectedAt,is_default AS isDefault,updated_at AS updatedAt";
async function hydrateConnection(db:any,env:any,row:any){const stored=await loadIntegration(db,env,String(row.providerKey)),expiresAt=String(row.platform==="TikTok"?(stored?.config?.refreshTokenExpiresAt||row.tokenExpiresAt||stored?.config?.expiresAt||""):(row.tokenExpiresAt||stored?.config?.expiresAt||"")),expired=Boolean(expiresAt&&Date.parse(expiresAt)<=Date.now());return{...row,isDefault:Boolean(row.isDefault),permissions:parse(row.permissions,[]),capabilities:parse(row.capabilities,{}),token:stored?.secret||null,tokenConfig:stored?.config||{},connected:Boolean(stored?.secret&&row.status==="Connected"&&!expired),expired}}

export async function readProjectConnections(db:any,env:any,projectId:string,platform?:string){
 await ensureConnectionIds(db,projectId);const where=platform?" WHERE project_id=? AND platform=?":" WHERE project_id=?",values=platform?[projectId,platform]:[projectId],rows=await db.prepare(`SELECT ${connectionColumns} FROM project_social_connections${where} ORDER BY platform,is_default DESC,connected_at`).bind(...values).all(),result=[];for(const row of rows.results as any[])result.push(await hydrateConnection(db,env,row));return result;
}

export async function readProjectConnection(db:any,env:any,projectId:string,platform:string,connectionId?:string|null){
 await ensureConnectionIds(db,projectId);const row=connectionId?await db.prepare(`SELECT ${connectionColumns} FROM project_social_connections WHERE project_id=? AND platform=? AND connection_id=?`).bind(projectId,platform,connectionId).first<any>():await db.prepare(`SELECT ${connectionColumns} FROM project_social_connections WHERE project_id=? AND platform=? ORDER BY is_default DESC,CASE WHEN status='Connected' THEN 0 ELSE 1 END,connected_at LIMIT 1`).bind(projectId,platform).first<any>();
 return row?hydrateConnection(db,env,row):null;
}

export function publicConnection(row:any){
 if(!row)return null;
 return{socialConnectionId:row.connectionId,platform:row.platform,accountId:row.accountId,profileUrl:row.profileUrl,handle:row.handle,accountType:row.accountType,status:row.expired?"Token expired":row.status,isDefault:Boolean(row.isDefault),permissions:row.permissions,capabilities:row.capabilities,tokenExpiresAt:row.tokenExpiresAt||row.tokenConfig?.expiresAt||null,connectedAt:row.connectedAt,lastCheckedAt:row.lastCheckedAt,needsReconnect:Boolean(row.expired)};
}

export function parse(value:any,fallback:any={}){try{return JSON.parse(value||JSON.stringify(fallback))}catch{return fallback}}
export function apiError(error:any){return Response.json({error:String(error?.message||error||"Social connection request failed."),code:error?.code||null},{status:Number(error?.status||500)})}
