export async function requireMemoryManagement(req:Request,db:any){
 const email=String(req.headers.get("oai-authenticated-user-email")||"").trim().toLowerCase();
 if(!email)throw Object.assign(new Error("Authentication required."),{status:401});
 const member=await db.prepare("SELECT tier FROM members WHERE email=?").bind(email).first<any>();
 if(!member||Number(member.tier)>1)throw Object.assign(new Error("Tier 0–1 Management access required."),{status:403});
 return{email,tier:Number(member.tier)};
}
