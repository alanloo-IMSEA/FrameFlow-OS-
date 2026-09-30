import{decrypt,encrypt}from"../google-drive/_lib";

export const OWNER_EMAIL="alanloo927@gmail.com";

export function integrationOwner(req:Request){
 const email=req.headers.get("oai-authenticated-user-email");
 return Boolean(email&&email.toLowerCase()===OWNER_EMAIL);
}

function envelopeKey(env:any){
 const root=String(env.FRAMEFLOW_INTEGRATION_KEY||env.GOOGLE_DRIVE_TOKEN_KEY||"");
 if(!root)throw new Error("Secure credential storage is not configured");
 return `${root}:frameflow-integrations:v1`;
}

export async function saveIntegration(db:any,env:any,provider:string,secret:string,config:Record<string,unknown>,status="Connected",options:{tested?:boolean}={}){
 const encrypted=await encrypt(secret,envelopeKey(env)),now=new Date().toISOString(),lastTestedAt=options.tested===false?null:now;
 await db.prepare("INSERT INTO integration_connections(provider,encrypted_secret,config_json,status,last_tested_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET encrypted_secret=excluded.encrypted_secret,config_json=excluded.config_json,status=excluded.status,last_tested_at=excluded.last_tested_at,updated_at=excluded.updated_at").bind(provider,encrypted,JSON.stringify(config),status,lastTestedAt,now).run();
}

export async function loadIntegration(db:any,env:any,provider:string){
 const row=await db.prepare("SELECT encrypted_secret AS encryptedSecret,config_json AS config,status,last_tested_at AS lastTestedAt,updated_at AS updatedAt FROM integration_connections WHERE provider=?").bind(provider).first<any>();
 if(!row)return null;
 return{secret:await decrypt(row.encryptedSecret,envelopeKey(env)),config:parse(row.config),status:row.status,lastTestedAt:row.lastTestedAt,updatedAt:row.updatedAt};
}

export async function integrationStatus(db:any,provider:string){
 const row=await db.prepare("SELECT config_json AS config,status,last_tested_at AS lastTestedAt,updated_at AS updatedAt FROM integration_connections WHERE provider=?").bind(provider).first<any>();
 return row?{connected:true,config:parse(row.config),status:row.status,lastTestedAt:row.lastTestedAt,updatedAt:row.updatedAt}:{connected:false,status:"Not connected",config:{}};
}

function parse(value:string){try{return JSON.parse(value||"{}")}catch{return{}}}
