import {createClient,type Session} from "@supabase/supabase-js";

const url=import.meta.env.VITE_SUPABASE_URL||"";
const publishableKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||"";

export const supabase=url&&publishableKey?createClient(url,publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

export async function getAccessToken():Promise<string|undefined>{
  if(!supabase)return undefined;
  const {data:{session}}=await supabase.auth.getSession();
  return session?.access_token;
}

export async function ensureAnonymousSession():Promise<Session|null>{
  if(!supabase)return null;
  const {data:{session}}=await supabase.auth.getSession();
  if(session)return session;
  const {data,error}=await supabase.auth.signInAnonymously();
  if(error)throw error;
  return data.session;
}

export function authConfigured(){return Boolean(supabase)}
