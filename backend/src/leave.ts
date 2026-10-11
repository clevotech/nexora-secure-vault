import {createHash,randomUUID} from "node:crypto";
import type {Pool} from "pg";

export function validIsoDate(value:unknown):value is string {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00.000Z");
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}

export function localTimeToUtc(date:string,timeZone:string,hour=9):Date {
  if(!validIsoDate(date))throw new Error("Invalid local calendar date.");
  let guess=Date.parse(date+"T"+String(hour).padStart(2,"0")+":00:00.000Z");
  const formatter=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  for(let i=0;i<4;i++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    const target=Date.parse(date+"T"+String(hour).padStart(2,"0")+":00:00.000Z");
    const adjustment=target-represented;
    guess+=adjustment;
    if(adjustment===0)break;
  }
  return new Date(guess);
}

export function expectedResumption(endDate:string,workweekDays:number[]= [1,2,3,4,5],holidays:string[]=[]):string {
  const blocked=new Set(holidays);
  const cursor=new Date(endDate+"T00:00:00.000Z");
  for(let i=0;i<370;i++){
    cursor.setUTCDate(cursor.getUTCDate()+1);
    const day=cursor.getUTCDay()===0?7:cursor.getUTCDay();
    const value=cursor.toISOString().slice(0,10);
    if(workweekDays.includes(day)&&!blocked.has(value))return value;
  }
  throw new Error("Unable to calculate a resumption date from the configured calendar.");
}

export async function appendAuditEvent(pool:Pool,input:{
  actorUserId:string;action:string;resourceType:string;resourceId?:string;
  outcome:"success"|"failure"|"denied";correlationId?:string;details?:Record<string,unknown>;
}){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(731992041)");
    const prior=await client.query("SELECT event_hash FROM nexora_audit_events ORDER BY id DESC LIMIT 1");
    const previousHash=String(prior.rows[0]?.event_hash||"");
    const event={eventId:randomUUID(),actorUserId:input.actorUserId,action:input.action,resourceType:input.resourceType,resourceId:input.resourceId||null,outcome:input.outcome,correlationId:input.correlationId||null,details:input.details||{},previousHash};
    const eventHash=createHash("sha256").update(JSON.stringify(event)).digest("hex");
    await client.query(
      "INSERT INTO nexora_audit_events(event_id,actor_user_id,action,resource_type,resource_id,outcome,correlation_id,details,previous_hash,event_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [event.eventId,event.actorUserId,event.action,event.resourceType,event.resourceId,event.outcome,event.correlationId,JSON.stringify(event.details),event.previousHash,eventHash]
    );
    await client.query("COMMIT");
    return {eventId:event.eventId,eventHash,createdAt:new Date().toISOString()};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
