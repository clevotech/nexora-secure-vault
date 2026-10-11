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
    // Preserve issuer path segments. Supabase's JWKS endpoint is under
    // /auth/v1/.well-known/jwks.json, not the domain root.
    const normalizedIssuer=issuer.endsWith("/")?issuer:issuer+"/";
    const jwksUrl=new URL(".well-known/jwks.json",normalizedIssuer);
    const keys=createRemoteJWKSet(jwksUrl);
    const {payload}=await jwtVerify(token,keys,{issuer,audience});
    const userId=typeof payload.sub==="string"?payload.sub:"";
    if(!userId)throw new Error("Authenticated token has no subject");

    const rawScopes=payload.scope;
    const scopes=new Set(typeof rawScopes==="string"?rawScopes.split(" ").filter(Boolean):["user"]);
    return {userId,scopes};
  }catch(error){
    // Keep detailed verification diagnostics in private server logs only.
    console.error("Nexora JWT verification failed",error);
    throw new Error("Authentication failed");
  }
}
