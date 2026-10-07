export type AuthContext={userId:string;scopes:Set<string>};

export function authenticate(headers:Record<string,string|undefined>):AuthContext{
  const raw=headers.authorization||"";
  const token=raw.startsWith("Bearer ")?raw.slice(7).trim():"";
  if(!token)throw new Error("Authentication required");
  if(process.env.NEXORA_DEV_AUTH!=="true"){
    throw new Error("Production authentication verifier is not configured");
  }
  if(token.length<16)throw new Error("Invalid development authentication token");
  return {userId:token,scopes:new Set(["user"])};
}
