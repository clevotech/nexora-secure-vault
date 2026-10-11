import type {Pool} from "pg";
import type {AuthContext} from "./auth.js";
import {appendAuditEvent,countWorkdays,expectedResumption,localTimeToUtc,validIsoDate} from "./leave.js";

type Result={status:number;body:unknown};
const ok=(body:unknown,status=200):Result=>({status,body});
const fail=(error:string,status=400):Result=>({status,body:{error}});

function isAdmin(auth:AuthContext){return auth.scopes.has("admin")||auth.scopes.has("hr");}
function dateAtNineUtc(date:string){return date+"T09:00:00.000Z";}

export async function handleLeaveApi(pool:Pool|null,auth:AuthContext,raw:unknown,correlationId?:string):Promise<Result>{
  if(!pool)return fail("Leave Tracker requires a configured PostgreSQL database.",503);
  if(!raw||typeof raw!=="object")return fail("Invalid request body.");
  const input=raw as Record<string,unknown>;
  const action=String(input.action||"");
  const actor=auth.userId;
  const audit=async(actionName:string,type:string,id:string|undefined,outcome:"success"|"failure"|"denied",details:Record<string,unknown>={})=>{
    try{return await appendAuditEvent(pool,{actorUserId:actor,action:actionName,resourceType:type,resourceId:id,outcome,correlationId,details});}
    catch(error){console.error("Nexora leave audit write failed",error instanceof Error?error.message:"unknown error");return null;}
  };

  if(action==="profile.save"){
    if(!isAdmin(auth))return fail("HR/admin authorization required.",403);
    const userId=String(input.userId||"").trim(),name=String(input.fullName||"").trim();
    if(!userId||!name||name.length>180)return fail("Employee user ID and full name are required.");
    const phone=String(input.whatsappE164||"").trim();
    if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))return fail("WhatsApp number must use international E.164 format.");
    const timezone=String(input.timezone||"UTC");
    try{new Intl.DateTimeFormat("en-US",{timeZone:timezone});}catch{return fail("Timezone must be a valid IANA timezone, such as Africa/Lagos.");}
    const requestedRole=["employee","supervisor","hr","admin"].includes(String(input.role))?String(input.role):"employee";
    if(["hr","admin"].includes(requestedRole)&&!auth.scopes.has("admin"))return fail("Only an admin may assign HR/admin profile roles.",403);
    const role=requestedRole;
    const supervisorUserId=String(input.supervisorUserId||"").trim();
    if(supervisorUserId&&supervisorUserId===userId)return fail("An employee cannot be their own supervisor.");
    const workweek=Array.isArray(input.workweekDays)?input.workweekDays.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=7):[1,2,3,4,5];
    const result=await pool.query(
      "INSERT INTO nexora_employees(user_id,employee_number,full_name,email,whatsapp_e164,department,supervisor_user_id,role,workweek_days,timezone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id) DO UPDATE SET employee_number=EXCLUDED.employee_number,full_name=EXCLUDED.full_name,email=EXCLUDED.email,whatsapp_e164=EXCLUDED.whatsapp_e164,department=EXCLUDED.department,supervisor_user_id=EXCLUDED.supervisor_user_id,role=EXCLUDED.role,workweek_days=EXCLUDED.workweek_days,timezone=EXCLUDED.timezone,updated_at=NOW() RETURNING id,user_id AS \"userId\",employee_number AS \"employeeNumber\",full_name AS \"fullName\",email,whatsapp_e164 AS \"whatsappE164\",department,supervisor_user_id AS \"supervisorUserId\",role,workweek_days AS \"workweekDays\",timezone,active",
      [userId,String(input.employeeNumber||"")||null,name,String(input.email||"")||null,phone||null,String(input.department||"")||null,supervisorUserId||null,role,workweek.length?workweek:[1,2,3,4,5],timezone]
    );
    await audit("leave.profile.save","employee",userId,"success",{role});
    return ok({employee:result.rows[0]});
  }

  if(action==="profile.list"){
    if(!isAdmin(auth))return fail("HR/admin authorization required.",403);
    const result=await pool.query("SELECT id,user_id AS \"userId\",employee_number AS \"employeeNumber\",full_name AS \"fullName\",email,whatsapp_e164 AS \"whatsappE164\",department,supervisor_user_id AS \"supervisorUserId\",role,workweek_days AS \"workweekDays\",timezone,active FROM nexora_employees ORDER BY full_name LIMIT 500");
    await audit("leave.profile.list","employee",undefined,"success",{count:result.rowCount});
    return ok({employees:result.rows});
  }

  if(action==="request.create"){
    const category=String(input.category||"annual").trim().slice(0,80);
    const start=String(input.startDate||""),end=String(input.endDate||"");
    if(!validIsoDate(start)||!validIsoDate(end)||end<start)return fail("Enter valid leave dates; the end date cannot precede the start date.");
    const reason=String(input.reason||"").trim();
    if(reason.length>2000)return fail("Reason is too long.");
    const employee=await pool.query("SELECT workweek_days AS \"workweekDays\",timezone,active FROM nexora_employees WHERE user_id=$1",[actor]);
    if(!employee.rows[0]||!employee.rows[0].active)return fail("An active employee profile is required before applying for leave.",403);
    const workweek=(employee.rows[0].workweekDays||[1,2,3,4,5]).map(Number);
    const holidayResult=await pool.query("SELECT holiday_date::text AS date FROM nexora_leave_holidays WHERE holiday_date>=$1::date AND holiday_date<=$2::date ORDER BY holiday_date",[start,new Date(Date.parse(end+"T00:00:00Z")+370*86400000).toISOString().slice(0,10)]);
    const holidayDates=holidayResult.rows.map((r:{date:string})=>String(r.date).slice(0,10));
    const resumption=expectedResumption(end,workweek,holidayDates);
    const requestedDays=countWorkdays(start,end,workweek,holidayDates);
    if(requestedDays===0)return fail("The selected date range contains no working days under the employee calendar.");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const overlap=await client.query("SELECT id FROM nexora_leave_requests WHERE employee_user_id=$1 AND status IN ('pending','approved') AND NOT(end_date<$2::date OR start_date>$3::date) LIMIT 1",[actor,start,end]);
      if(overlap.rows[0]){await client.query("ROLLBACK");await audit("leave.request.create","leave_request",undefined,"denied",{reason:"overlapping_dates"});return fail("You already have a pending or approved leave request overlapping those dates.",409);}
      const inserted=await client.query("INSERT INTO nexora_leave_requests(employee_user_id,category,start_date,end_date,expected_resumption_date,reason,status,requested_days) VALUES($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id,employee_user_id AS \"employeeUserId\",category,start_date AS \"startDate\",end_date AS \"endDate\",expected_resumption_date AS \"expectedResumptionDate\",status,requested_days AS \"requestedDays\",created_at AS \"createdAt\"",[actor,category,start,end,resumption,reason||null,requestedDays]);
      const id=String(inserted.rows[0].id);
      const approval=await client.query("INSERT INTO nexora_leave_approvals(leave_request_id,step_number,approver_user_id,decision) SELECT $1,1,COALESCE((SELECT user_id FROM nexora_employees s WHERE s.user_id=e.supervisor_user_id AND s.active=true AND s.role IN ('supervisor','hr','admin') LIMIT 1),(SELECT user_id FROM nexora_employees WHERE role IN ('hr','admin') AND active=true ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1)),'pending' FROM nexora_employees e WHERE e.user_id=$2 AND COALESCE((SELECT user_id FROM nexora_employees s WHERE s.user_id=e.supervisor_user_id AND s.active=true AND s.role IN ('supervisor','hr','admin') LIMIT 1),(SELECT user_id FROM nexora_employees WHERE role IN ('hr','admin') AND active=true ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1)) IS NOT NULL ON CONFLICT DO NOTHING",[id,actor]);
      if(!approval.rowCount){await client.query("ROLLBACK");return fail("No eligible supervisor or HR/admin approver is configured. Ask an administrator to assign one before applying.",409);}
      await client.query("INSERT INTO nexora_leave_notifications(leave_request_id,recipient_user_id,recipient_phone_e164,template_name,payload) SELECT $1,user_id,whatsapp_e164,'leave_request_submitted',jsonb_build_object('employeeName',(SELECT full_name FROM nexora_employees WHERE user_id=$5),'category',$2::text,'startDate',$3::text,'endDate',$4::text) FROM nexora_employees WHERE role IN ('hr','admin') AND active=true AND whatsapp_e164 IS NOT NULL",[id,category,start,end,actor]);
      await client.query("COMMIT");
      await audit("leave.request.create","leave_request",id,"success",{category,startDate:start,endDate:end,expectedResumptionDate:resumption});
      return ok({request:inserted.rows[0]},201);
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release();}
  }

  if(action==="certificate.get"){
    const id=String(input.id||"").trim();
    if(!id)return fail("A leave request ID is required.");
    const result=await pool.query(
      "SELECT r.id,r.employee_user_id AS \"employeeUserId\",e.employee_number AS \"employeeId\",e.full_name AS \"employeeName\",e.employee_number AS \"employeeNumber\",e.department,e.email,e.role AS \"employeeRole\",r.category,r.start_date::text AS \"startDate\",r.end_date::text AS \"endDate\",r.expected_resumption_date::text AS \"expectedResumptionDate\",r.requested_days AS \"requestedDays\",r.status,r.created_at AS \"requestedAt\",a.decided_at AS \"approvedAt\",a.approver_user_id AS \"approverUserId\",approver.full_name AS \"approverName\",a.comment AS \"approvalComment\" FROM nexora_leave_requests r JOIN nexora_employees e ON e.user_id=r.employee_user_id LEFT JOIN LATERAL (SELECT * FROM nexora_leave_approvals WHERE leave_request_id=r.id AND decision='approved' ORDER BY decided_at DESC NULLS LAST LIMIT 1) a ON TRUE LEFT JOIN nexora_employees approver ON approver.user_id=a.approver_user_id WHERE r.id=$1 LIMIT 1",
      [id]
    );
    const certificate=result.rows[0];
    if(!certificate)return fail("Leave request not found or employee profile unavailable.",404);
    if(certificate.status!=="approved"&&certificate.status!=="completed")return fail("A leave certificate is available only after approval.",409);
    if(certificate.employeeUserId!==actor&&!isAdmin(auth))return fail("You may only access your own certificate unless you have HR/admin access.",403);
    await audit("leave.certificate.generate","leave_certificate",id,"success",{status:certificate.status});
    return ok({certificate});
  }

  if(action==="request.list"){
    const admin=isAdmin(auth);
    const result=admin
      ?await pool.query("SELECT r.id,r.employee_user_id AS \"employeeUserId\",e.full_name AS \"employeeName\",e.department,r.category,r.start_date AS \"startDate\",r.end_date AS \"endDate\",r.expected_resumption_date AS \"expectedResumptionDate\",r.actual_resumption_at AS \"actualResumptionAt\",r.status,r.reason,r.created_at AS \"createdAt\" FROM nexora_leave_requests r LEFT JOIN nexora_employees e ON e.user_id=r.employee_user_id ORDER BY r.created_at DESC LIMIT 500")
      :await pool.query("SELECT r.id,r.employee_user_id AS \"employeeUserId\",e.employee_number AS \"employeeId\",r.category,r.start_date AS \"startDate\",r.end_date AS \"endDate\",r.expected_resumption_date AS \"expectedResumptionDate\",r.actual_resumption_at AS \"actualResumptionAt\",r.status,r.reason,r.created_at AS \"createdAt\" FROM nexora_leave_requests r LEFT JOIN nexora_employees e ON e.user_id=r.employee_user_id WHERE r.employee_user_id=$1 ORDER BY r.created_at DESC LIMIT 200",[actor]);
    await audit("leave.request.list","leave_request",undefined,"success",{count:result.rowCount,scope:admin?"all":"self"});
    return ok({requests:result.rows});
  }

  if(action==="request.decide"){
    if(!isAdmin(auth)&&!auth.scopes.has("supervisor"))return fail("Supervisor or HR/admin authorization required.",403);
    const id=String(input.id||""),decision=String(input.decision||"");
    if(!id||!["approved","rejected"].includes(decision))return fail("A request ID and approved/rejected decision are required.");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const found=await client.query("SELECT * FROM nexora_leave_requests WHERE id=$1 FOR UPDATE",[id]);
      const row=found.rows[0];
      if(!row){await client.query("ROLLBACK");return fail("Leave request not found.",404);}
      if(row.status!=="pending"){await client.query("ROLLBACK");return fail("Only pending leave requests can be decided.",409);}
      if(!isAdmin(auth)){
        const assigned=await client.query("SELECT 1 FROM nexora_employees WHERE user_id=$1 AND supervisor_user_id=$2",[row.employee_user_id,actor]);
        if(!assigned.rows[0]){await client.query("ROLLBACK");await audit("leave.request.decide","leave_request",id,"denied",{decision});return fail("You are not the assigned supervisor for this employee.",403);}
      }
      const comment=String(input.comment||"").trim().slice(0,1000);
      await client.query("UPDATE nexora_leave_requests SET status=$2,updated_at=NOW() WHERE id=$1",[id,decision]);
      await client.query("UPDATE nexora_leave_approvals SET decision=$2,comment=$3,decided_at=NOW(),approver_user_id=$4 WHERE leave_request_id=$1 AND decision='pending'",[id,decision,comment||null,actor]);
      await client.query("INSERT INTO nexora_leave_notifications(leave_request_id,recipient_user_id,recipient_phone_e164,template_name,payload) SELECT $1,user_id,whatsapp_e164,$2,jsonb_build_object('decision',$3::text,'category',$4::text,'startDate',$5::text,'endDate',$6::text) FROM nexora_employees WHERE user_id=$7 AND whatsapp_e164 IS NOT NULL",[id,decision==="approved"?"leave_request_approved":"leave_request_rejected",decision,row.category,String(row.start_date).slice(0,10),String(row.end_date).slice(0,10),row.employee_user_id]);
      if(decision==="approved"){
        const employee=await client.query("SELECT timezone FROM nexora_employees WHERE user_id=$1",[row.employee_user_id]);
        const tz=String(employee.rows[0]?.timezone||"UTC");
        const reminders=[["leave_return_3_days",3],["leave_return_1_day",1],["leave_return_today",0]] as const;
        for(const [template,daysBefore] of reminders){
          const date=new Date(String(row.expected_resumption_date).slice(0,10)+"T00:00:00.000Z");
          date.setUTCDate(date.getUTCDate()-daysBefore);
          const scheduledAt=localTimeToUtc(date.toISOString().slice(0,10),tz,9);
          if(scheduledAt.getTime()>Date.now())await client.query("INSERT INTO nexora_leave_notifications(leave_request_id,recipient_user_id,recipient_phone_e164,template_name,payload,scheduled_at) SELECT $1,user_id,whatsapp_e164,$2,jsonb_build_object('resumptionDate',$3::text,'timezone',$4::text),$5 FROM nexora_employees WHERE user_id=$6 AND whatsapp_e164 IS NOT NULL",[id,template,String(row.expected_resumption_date).slice(0,10),tz,scheduledAt.toISOString(),row.employee_user_id]);
        }
      }
      await client.query("COMMIT");
      await audit("leave.request.decide","leave_request",id,"success",{decision});
      return ok({id,status:decision});
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release();}
  }

  if(action==="request.cancel"){
    const id=String(input.id||"");
    const result=await pool.query("UPDATE nexora_leave_requests SET status='cancelled',updated_at=NOW() WHERE id=$1 AND employee_user_id=$2 AND status IN ('pending','approved') RETURNING id",[id,actor]);
    if(!result.rows[0])return fail("Leave request not found or cannot be cancelled.",404);
    await pool.query("UPDATE nexora_leave_notifications SET status='cancelled',updated_at=NOW() WHERE leave_request_id=$1 AND status='queued'",[id]);
    await audit("leave.request.cancel","leave_request",id,"success");
    return ok({id,cancelled:true});
  }

  if(action==="resumption.confirm"){
    const id=String(input.id||"");
    const note=String(input.note||"").trim().slice(0,1000);
    const result=await pool.query("UPDATE nexora_leave_requests SET actual_resumption_at=NOW(),resumption_confirmed_by=$2,resumption_note=$3,status='completed',updated_at=NOW() WHERE id=$1 AND employee_user_id=$2 AND status='approved' RETURNING id,actual_resumption_at AS \"actualResumptionAt\",status",[id,actor,note||null]);
    if(!result.rows[0])return fail("Approved leave request not found, or resumption was already recorded.",404);
    await audit("leave.resumption.confirm","leave_request",id,"success");
    return ok({request:result.rows[0]});
  }

  if(action==="calendar.holiday.save"){
    if(!isAdmin(auth))return fail("HR/admin authorization required.",403);
    const date=String(input.date||""),name=String(input.name||"").trim().slice(0,180),region=String(input.region||"global").trim().slice(0,80)||"global";
    if(!validIsoDate(date)||!name)return fail("A valid holiday date and name are required.");
    await pool.query("INSERT INTO nexora_leave_holidays(holiday_date,name,region,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(holiday_date) DO UPDATE SET name=EXCLUDED.name,region=EXCLUDED.region,created_by=EXCLUDED.created_by",[date,name,region,actor]);
    await audit("leave.holiday.save","leave_holiday",date,"success",{region});
    return ok({holiday:{date,name,region}});
  }

  if(action==="calendar.holiday.list"){
    if(!isAdmin(auth))return fail("HR/admin authorization required.",403);
    const result=await pool.query("SELECT holiday_date::text AS date,name,region FROM nexora_leave_holidays WHERE holiday_date >= CURRENT_DATE - 30 ORDER BY holiday_date LIMIT 500");
    return ok({holidays:result.rows});
  }

  if(action==="audit.list"){
    if(!auth.scopes.has("admin"))return fail("Admin authorization required.",403);
    const limit=Math.max(1,Math.min(200,Number(input.limit)||50));
    const result=await pool.query("SELECT event_id AS \"eventId\",actor_user_id AS \"actorUserId\",action,resource_type AS \"resourceType\",resource_id AS \"resourceId\",outcome,correlation_id AS \"correlationId\",details,previous_hash AS \"previousHash\",event_hash AS \"eventHash\",created_at AS \"createdAt\" FROM nexora_audit_events ORDER BY id DESC LIMIT $1",[limit]);
    return ok({events:result.rows});
  }
  return fail("Unknown Leave Tracker action.",404);
}
