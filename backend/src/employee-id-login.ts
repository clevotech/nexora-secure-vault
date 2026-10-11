import type {Pool} from "pg";

type Result={status:number;body:unknown};
const fail=(status:number,message:string):Result=>({status,body:{error:message}});
const attempts=new Map<string,{count:number;until:number}>();
const WINDOW_MS=15*60*1000,MAX_ATTEMPTS=8;
export async function employeeIdLogin(pool:Pool|null,raw:unknown,ip:string):Promise<Result>{
 if(!pool)return fail(503,"Leave Tracker sign-in is temporarily unavailable.");
 if(!raw||typeof raw!=="object")return fail(400,"Enter your Nexora user ID and password.");
 const input=raw as Record<string,unknown>;
 const userCode=String(input.userId||"").trim().toUpperCase().slice(0,40);
 const password=String(input.password||"");
 if(!/^NXU-(?:[A-F0-9]{8}|[A-F0-9]{12})$/.test(userCode)||password.length<1||password.length>1024)return fail(401,"User ID or password is incorrect.");
 const key=ip.slice(0,100)+":"+userCode,now=Date.now(),prior=attempts.get(key);
 if(prior&&prior.until>now&&prior.count>=MAX_ATTEMPTS)return fail(429,"Too many sign-in attempts. Please wait 15 minutes and try again.");
 if(!prior||prior.until<=now)attempts.set(key,{count:1,until:now+WINDOW_MS});
 else attempts.set(key,{count:prior.count+1,until:prior.until});
 const result=await pool.query("SELECT m.email,m.user_id FROM nexora_organization_members m WHERE m.user_code=$1 AND m.status IN ('active','invited') LIMIT 1",[userCode]);
 const member=result.rows[0] as {email?:string;user_id?:string}|undefined;
 const supabaseUrl=String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
 const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||"";
 if(!supabaseUrl||!apiKey)return fail(503,"Leave Tracker sign-in is not configured on the backend.");
 // Use the same generic response for unknown IDs and invalid passwords to reduce account enumeration.
 if(!member?.email||!member.user_id)return fail(401,"User ID or password is incorrect.");
 try{
  const response=await fetch(supabaseUrl+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:apiKey,"Content-Type":"application/json"},body:JSON.stringify({email:member.email,password})});
  const data=await response.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;token_type?:string;expires_in?:number;user?:{id?:string}};
  if(!response.ok||!data.access_token||!data.refresh_token||data.user?.id!==member.user_id)return fail(401,"User ID or password is incorrect.");
  attempts.delete(key);
  await pool.query("UPDATE nexora_organization_members SET status='active',updated_at=NOW() WHERE user_id=$1 AND status='invited'",[member.user_id]);
  return {status:200,body:{access_token:data.access_token,refresh_token:data.refresh_token,token_type:data.token_type||"bearer",expires_in:data.expires_in||3600}};
 }catch(error){console.error("Nexora employee ID login failed",error instanceof Error?error.message:"unknown error");return fail(502,"Sign-in service is temporarily unavailable. Please try again.");}
}
