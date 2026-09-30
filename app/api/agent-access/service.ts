const TOKEN_PREFIX="ffa_";
export const AGENT_READ_SCOPES=["projects:list","project:read","memory:read:approved","memory:read:learning","performance:read","assets:read:selected"]as const;

async function sha256(value:string){const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")}
export function createAgentReadToken(){const bytes=crypto.getRandomValues(new Uint8Array(32)),secret=Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");return`${TOKEN_PREFIX}${secret}`}
export async function hashAgentToken(token:string){return sha256(token)}
export function requestAgentToken(req:Request){const direct=String(req.headers.get("x-frameflow-agent-token")||"").trim();if(direct)return direct;const authorization=String(req.headers.get("authorization")||"");return authorization.toLowerCase().startsWith("bearer ")?authorization.slice(7).trim():""}

export async function requireAgentAccess(req:Request,db:any,required:string[]=[]){
 const token=requestAgentToken(req);if(!token.startsWith(TOKEN_PREFIX)||token.length<50)throw Object.assign(new Error("Missing or invalid Agent connection token."),{status:401});
 const tokenHash=await hashAgentToken(token),now=new Date().toISOString(),row=await db.prepare("SELECT t.id,t.agent_id AS agentId,t.scopes_json AS scopesJson,t.expires_at AS expiresAt,m.name FROM agent_api_tokens t JOIN members m ON m.email=t.agent_id AND m.member_kind='agent' WHERE t.token_hash=? AND t.status='Active' AND t.revoked_at IS NULL LIMIT 1").bind(tokenHash).first<any>();
 if(!row||row.expiresAt&&row.expiresAt<=now)throw Object.assign(new Error("Missing or invalid Agent connection token."),{status:401});
 let scopes:string[]=[];try{scopes=JSON.parse(row.scopesJson||"[]")}catch{}
 const allows=(scope:string)=>scopes.includes(scope)||(scope==="projects:list"&&scopes.includes("projects:read"))||(scope==="project:read"&&scopes.includes("projects:read"));
 const missing=required.filter(scope=>!allows(scope));if(missing.length)throw Object.assign(new Error(`This Agent token is missing scope: ${missing.join(", ")}.`),{status:403,missingScopes:missing});
 await db.prepare("UPDATE agent_api_tokens SET last_used_at=? WHERE id=?").bind(now,row.id).run();
 return{agentId:String(row.agentId),agentName:String(row.name||row.agentId),tokenId:String(row.id),scopes,allows};
}

export async function requireAgentProjectRead(req:Request,db:any){return requireAgentAccess(req,db,["projects:list"])}
export async function requireAssignedProject(db:any,agentId:string,projectId:string){const assigned=await db.prepare("SELECT 1 AS ok FROM project_members WHERE project_id=? AND member_email=? LIMIT 1").bind(projectId,agentId).first();if(!assigned)throw Object.assign(new Error("This Agent is not assigned to the requested Project."),{status:403});return true}
