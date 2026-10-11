import type {Pool} from "pg";
import type {AuthContext} from "./auth.js";
import {appendAuditEvent} from "./leave.js";

type Result={status:number;body:unknown};
const ok=(body:unknown,status=200):Result=>({status,body});
const fail=(error:string,status=400):Result=>({status,body:{error}});
const clean=(v:unknown,max=180)=>String(v??"").trim().slice(0,max);
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
async function audit(pool:Pool,auth:AuthContext,action:string,type:string,id:string|undefined,details:Record<string,unknown>={}){
  try{await appendAuditEvent(pool,{actorUserId:auth.userId,action,resourceType:type,resourceId:id,outcome:"success",details});}
  catch(error){console.error("Nexora organization audit failed",error instanceof Error?error.message:"unknown error");}
}
export async function handleOrganizationApi(pool:Pool|null,auth:AuthContext,raw:unknown):Promise<Result>{
 if(!pool)return fail("Organization registration requires a configured PostgreSQL database.",503);
 if(!raw||typeof raw!=="object")return fail("Invalid request body.");
 const input=raw as Record<string,unknown>,action=clean(input.action,60);
 if(action==="organization.register"){
  const name=clean(input.name),email=clean(input.email,254).toLowerCase(),adminEmail=clean(input.adminEmail,254).toLowerCase(),phone=clean(input.phone,40),website=clean(input.website,300),address=clean(input.address,500),country=clean(input.country,100),industry=clean(input.industry,120),registrationNumber=clean(input.registrationNumber,120),logoUrl=clean(input.logoUrl,2048),fullName=clean(input.adminFullName,180);
  if(name.length<2||!validEmail(email)||!validEmail(adminEmail)||fullName.length<2)return fail("Organization name, valid organization and Admin Officer emails, and Admin Officer full name are required.");
  if(website){try{const u=new URL(website);if(u.protocol!=="https:")return fail("Website must use HTTPS.");}catch{return fail("Enter a valid HTTPS website URL.");}}
  if(logoUrl){try{const u=new URL(logoUrl);if(u.protocol!=="https:")return fail("Logo must be a valid HTTPS image URL.");}catch{return fail("Enter a valid HTTPS logo URL, or leave it blank.");}}
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const existing=await client.query("SELECT organization_id FROM nexora_organization_members WHERE user_id=$1 FOR UPDATE",[auth.userId]);
   if(existing.rows[0]){await client.query("ROLLBACK");return fail("This account already belongs to an organization. Ask your Admin Officer to manage your membership.",409);}
   const inserted=await client.query("INSERT INTO nexora_organizations(name,email,phone,website,address,country,industry,registration_number,logo_url,owner_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,organization_code AS \"organizationId\",name,email,phone,website,address,country,industry,registration_number AS \"registrationNumber\",logo_url AS \"logoUrl\",created_at AS \"createdAt\"",[name,email,phone||null,website||null,address||null,country||null,industry||null,registrationNumber||null,logoUrl||null,auth.userId]);
   const org=inserted.rows[0];
   const member=await client.query("INSERT INTO nexora_organization_members(user_id,organization_id,full_name,email,role,status) VALUES($1,$2,$3,$4,'admin_officer','active') RETURNING user_code AS \"userId\",user_id AS \"authUserId\",full_name AS \"fullName\",email,role,status,created_at AS \"createdAt\"",[auth.userId,org.id,fullName,adminEmail]);
   await client.query("COMMIT");
   await audit(pool,auth,"organization.register","organization",org.id,{organizationCode:org.organizationId,role:"admin_officer"});
   return ok({organization:org,user:member.rows[0]},201);
  }catch(error){
   await client.query("ROLLBACK");
   if((error as {code?:string})?.code==="23505")return fail("This account or organization is already registered. Sign in with the existing Admin Officer account.",409);
   console.error("Nexora organization registration failed",error instanceof Error?error.message:"unknown error");
   return fail("Organization registration could not be completed.",500);
  }finally{client.release();}
 }
 await pool.query("UPDATE nexora_organization_members SET status='active',updated_at=NOW() WHERE user_id=$1 AND status='invited'",[auth.userId]);
 const membership=await pool.query("SELECT m.organization_id AS \"organizationUuid\",m.organization_id::text AS \"organizationKey\",m.user_code AS \"userId\",m.full_name AS \"fullName\",m.email,m.department,m.job_title AS \"jobTitle\",m.role,m.status,o.organization_code AS \"organizationId\",o.name AS \"organizationName\",o.email AS \"organizationEmail\",o.phone AS \"organizationPhone\",o.website AS \"organizationWebsite\",o.address AS \"organizationAddress\",o.country,o.industry,o.registration_number AS \"registrationNumber\",o.logo_url AS \"logoUrl\" FROM nexora_organization_members m JOIN nexora_organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.status='active' LIMIT 1",[auth.userId]);
 const current=membership.rows[0];
 if(current){
  const leaveRole=current.role==="admin_officer"?"admin":current.role==="hr"?"hr":current.role==="supervisor"?"supervisor":"employee";
  await pool.query("INSERT INTO nexora_employees(user_id,employee_number,full_name,email,department,role,timezone,active) VALUES($1,$2,$3,$4,$5,$6,'Africa/Lagos',true) ON CONFLICT(user_id) DO UPDATE SET employee_number=EXCLUDED.employee_number,full_name=EXCLUDED.full_name,email=EXCLUDED.email,department=EXCLUDED.department,role=CASE WHEN nexora_employees.role IN ('admin','hr') THEN nexora_employees.role ELSE EXCLUDED.role END,active=true,updated_at=NOW()",[auth.userId,current.userId,current.fullName,current.email,current.department,leaveRole]);
 }
 if(action==="organization.get"){
  if(!current)return ok({organization:null,user:null});
  return ok({organization:{id:current.organizationId,name:current.organizationName,email:current.organizationEmail,phone:current.organizationPhone,website:current.organizationWebsite,address:current.organizationAddress,country:current.country,industry:current.industry,registrationNumber:current.registrationNumber,logoUrl:current.logoUrl},user:{userId:current.userId,authUserId:auth.userId,fullName:current.fullName,email:current.email,department:current.department,jobTitle:current.jobTitle,role:current.role,status:current.status}});
 }
 if(action==="users.list"){
  if(!current)return fail("Register or join an organization first.",409);
  if(current.role!=="admin_officer")return fail("Only the organization's Admin Officer can manage users.",403);
  const users=await pool.query("SELECT user_code AS \"userId\",full_name AS \"fullName\",email,department,job_title AS \"jobTitle\",role,status,created_at AS \"createdAt\" FROM nexora_organization_members WHERE organization_id=$1 ORDER BY created_at",[current.organizationUuid]);
  return ok({users:users.rows,organizationId:current.organizationId});
 }
 if(action==="user.register"){
  if(!current)return fail("Register an organization before adding users.",409);
  if(current.role!=="admin_officer")return fail("Only the organization's Admin Officer can register users.",403);
  const fullName=clean(input.fullName),email=clean(input.email,254).toLowerCase(),department=clean(input.department,120),jobTitle=clean(input.jobTitle,120),role=clean(input.role,30)||"employee";
  if(fullName.length<2||!validEmail(email))return fail("Enter the user's full name and a valid email address.");
  if(!["employee","supervisor","hr"].includes(role))return fail("The Admin Officer role is assigned only to the first organization registrant.");
  const exists=await pool.query("SELECT 1 FROM nexora_organization_members WHERE organization_id=$1 AND lower(email)=lower($2) LIMIT 1",[current.organizationUuid,email]);
  if(exists.rows[0])return fail("A user with this email is already registered in the organization.",409);
  const supabaseUrl=clean(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,500).replace(/\/$/,"");
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
  if(!supabaseUrl||!serviceKey)return fail("User invitations are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend service; never expose the service key in the browser.",503);
  let invited:{id?:string;email?:string};
  try{
   const response=await fetch(supabaseUrl+"/auth/v1/invite",{method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},body:JSON.stringify({email,data:{full_name:fullName,organization_id:current.organizationUuid,organization_code:current.organizationId,department,job_title:jobTitle}})});
   const data=await response.json().catch(()=>({})) as {id?:string;email?:string;msg?:string;message?:string};
   if(!response.ok) return fail(response.status===422?"This email may already have an account, or the invitation was rejected by the identity provider.":String(data.msg||data.message||"Identity provider could not send the invitation."),response.status===429?429:400);
   invited=data;
   if(!invited.id)return fail("The identity provider did not return a new user ID; no organization profile was created.",502);
  }catch(error){console.error("Nexora invite request failed",error instanceof Error?error.message:"unknown error");return fail("Could not contact the identity provider to send the invitation.",502);}
  try{
   const result=await pool.query("INSERT INTO nexora_organization_members(user_id,organization_id,full_name,email,department,job_title,role,status,invited_by) VALUES($1,$2,$3,$4,$5,$6,$7,'invited',$8) RETURNING user_code AS \"userId\",full_name AS \"fullName\",email,department,job_title AS \"jobTitle\",role,status,created_at AS \"createdAt\"",[invited.id,current.organizationUuid,fullName,email,department||null,jobTitle||null,role,auth.userId]);
   await audit(pool,auth,"organization.user.invite","organization_member",result.rows[0].userId,{role,organizationId:current.organizationId});
   return ok({user:result.rows[0],message:"Invitation sent. The user receives a unique Nexora ID and can activate the account from the invitation email."},201);
  }catch(error){
   console.error("Nexora organization membership insert failed after invite",error instanceof Error?error.message:"unknown error");
   return fail("The invitation was sent, but the organization profile could not be saved. Check the existing user/account before retrying.",500);
  }
 }
 return fail("Invalid organization action.");
}
