export type AuthContext={userId:string;scopes:Set<string>};

export function authenticate(headers:Record<string,string|undefined>):AuthContext{
  const raw=headers.authorization||"";
  const token=raw.startsWith("Bearer ")?raw.slice(7).trim():"";
  if(!token)throw new Error("Authentication required");
  // Deployment must replace this development verifier with a real JWT/OIDC verifier.
  if(token.length<16)throw new Error("Invalid authentication token");
  return {userId:token,scopes:new Set(["user"])};
}
