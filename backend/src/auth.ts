import {createRemoteJWKSet,jwtVerify} from "jose";

export type AuthContext={userId:string;scopes:Set<string>};

export async function authenticate(headers:Record<string,string|undefined>):Promise<AuthContext>{
  const raw=headers.authorization||"";
  const token=raw.startsWith("Bearer ")?raw.slice(7).trim():"";
  if(!token)throw new Error("Authentication required");

  if(process.env.NEXORA_DEV_AUTH==="true"){
    if(token.length<16)throw new Error("Invalid development authentication token");
    return {userId:token,scopes:new Set(["user"])};
  }

  const issuer=process.env.NEXORA_AUTH_ISSUER;
  const audience=process.env.NEXORA_AUTH_AUDIENCE;
  if(!issuer||!audience)throw new Error("Production authentication verifier is not configured");

  try{
    const jwks=new URL("/.well-known/jwks.json",issuer.endsWith("/")?issuer:issuer+"/");
    const keys=createRemoteJWKSet(jwks);
    const {payload}=await jwtVerify(token,keys,{issuer,audience});
    const userId=typeof payload.sub==="string"?payload.sub:"";
    if(!userId)throw new Error("Authenticated token has no subject");

    const rawScopes=payload.scope;
    const scopes=new Set(typeof rawScopes==="string"?rawScopes.split(" ").filter(Boolean):["user"]);
    return {userId,scopes};
  }catch{
    throw new Error("Authentication failed");
  }
}
