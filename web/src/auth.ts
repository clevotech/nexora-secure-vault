import {createClient,type Session} from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL||"";
const publishableKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||"";

export const supabase=url&&publishableKey?createClient(url,publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

/** Obtain a real Supabase access token before calling protected Nexora API routes. */
export async function getAccessToken():Promise<string>{
  if(!supabase){
    throw new Error("Nexora authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the web deployment, then redeploy.");
  }
  let session:Session|null;
  try{
    session=await ensureAnonymousSession();
  }catch(error){
    const detail=error instanceof Error?error.message:"Unknown authentication error";
    if(/anonymous.*disabled|anonymous sign.?in.*disabled/i.test(detail)){
      throw new Error("Nexora guest access is disabled in Supabase. Enable Anonymous Sign-Ins in Supabase Authentication settings, or sign in with a registered account.");
    }
    throw new Error("Nexora could not establish your login session. Check your connection and Supabase Authentication settings. "+detail);
  }
  if(!session?.access_token){
    throw new Error("Nexora could not obtain an access token. Sign in again or ask the administrator to check Supabase Authentication.");
  }
  return session.access_token;
}

export async function ensureAnonymousSession():Promise<Session|null>{
  if(!supabase)return null;
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError)throw sessionError;
  if(session)return session;
  const {data,error}=await supabase.auth.signInAnonymously();
  if(error)throw error;
  if(!data.session)throw new Error("Supabase did not return a session after guest sign-in.");
  return data.session;
}

export function authConfigured(){return Boolean(supabase)}

export async function signInWithEmployeeId(userId:string,password:string):Promise<void>{
  if(!supabase)throw new Error("Sign-in is not configured. Contact your Nexora administrator.");
  const configuredEndpoint=(import.meta.env.VITE_NEXORA_AUTH_ENDPOINT||"").trim();
  const aiEndpoint=(import.meta.env.VITE_NEXORA_AI_ENDPOINT||"").trim();
  const endpoint=(configuredEndpoint || (aiEndpoint.startsWith("http") ? aiEndpoint.replace(/\/api\/ai\/?$/,"") : "https://nexora-api-ars8.onrender.com")).replace(/\/$/,"");
  const response=await fetch(endpoint+"/auth/employee-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId.trim().toUpperCase(),password})});
  const result=await response.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;error?:string};
  if(!response.ok||!result.access_token||!result.refresh_token)throw new Error(result.error||"User ID or password is incorrect.");
  const {error}=await supabase.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
  if(error)throw new Error("Sign-in succeeded but the session could not be saved. Please try again.");
}
export async function hasEmployeeSession():Promise<boolean>{
  if(!supabase)return false;
  const {data:{session}}=await supabase.auth.getSession();
  return Boolean(session&&!session.user.is_anonymous);
}

export async function prepareAdminAccount(email:string,password:string,fullName:string):Promise<void>{
  if(!supabase)throw new Error("Account setup is not configured. Contact your Nexora administrator.");
  const normalized=email.trim().toLowerCase();
  if(password.length<6)throw new Error("Choose a password or PIN with at least 6 characters.");
  const {data:{session}}=await supabase.auth.getSession();
  if(session&&!session.user.is_anonymous){
    if((session.user.email||"").toLowerCase()!==normalized)throw new Error("The Admin Officer email must match the signed-in account email.");
    return;
  }
  if(session?.user.is_anonymous){
    const {error}=await supabase.auth.updateUser({email:normalized,password,data:{full_name:fullName.trim()}});
    if(error)throw new Error(error.message);
    return;
  }
  const {data,error}=await supabase.auth.signUp({email:normalized,password,options:{data:{full_name:fullName.trim()}}});
  if(error)throw new Error(error.message);
  if(!data.session)throw new Error("Check your email to confirm the account, then sign in before registering the organization.");
}
