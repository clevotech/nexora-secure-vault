import type {Pool} from "pg";

export type CreditEntry={id:string;userId:string;delta:number;reason:string;idempotencyKey:string;createdAt:string};

export class CreditStoreMemory{
  private ledger:CreditEntry[]=[];
  balance(userId:string){return this.ledger.filter(x=>x.userId===userId).reduce((n,x)=>n+x.delta,0);}
  apply(userId:string,delta:number,reason:string,idempotencyKey:string){
    validate(delta,idempotencyKey);
    const existing=this.ledger.find(x=>x.userId===userId&&x.idempotencyKey===idempotencyKey);if(existing)return existing;
    if(delta<0&&this.balance(userId)+delta<0)throw new Error("Insufficient credits");
    const entry={id:crypto.randomUUID(),userId,delta,reason,idempotencyKey,createdAt:new Date().toISOString()};this.ledger.push(entry);return entry;
  }
}

export class CreditStorePostgres{
  constructor(private pool:Pool){}
  async balance(userId:string){const r=await this.pool.query("SELECT COALESCE(SUM(delta),0)::float8 AS balance FROM nexora_credits WHERE user_id=$1",[userId]);return Number(r.rows[0].balance);}
  async apply(userId:string,delta:number,reason:string,idempotencyKey:string){
    validate(delta,idempotencyKey);
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const existing=await client.query("SELECT id,user_id as \"userId\",delta::float8,reason,idempotency_key as \"idempotencyKey\",created_at as \"createdAt\" FROM nexora_credits WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE",[userId,idempotencyKey]);
      if(existing.rows[0]){await client.query("COMMIT");return existing.rows[0] as CreditEntry;}
      const b=await client.query("SELECT COALESCE(SUM(delta),0)::float8 AS balance FROM nexora_credits WHERE user_id=$1",[userId]);
      if(delta<0&&Number(b.rows[0].balance)+delta<0)throw new Error("Insufficient credits");
      const r=await client.query("INSERT INTO nexora_credits(id,user_id,delta,reason,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING id,user_id as \"userId\",delta::float8,reason,idempotency_key as \"idempotencyKey\",created_at as \"createdAt\"",[crypto.randomUUID(),userId,delta,reason,idempotencyKey]);
      await client.query("COMMIT");return r.rows[0] as CreditEntry;
    }catch(e){await client.query("ROLLBACK");throw e}finally{client.release();}
  }
}
function validate(delta:number,idempotencyKey:string){if(!Number.isFinite(delta)||delta===0)throw new Error("Invalid credit delta");if(!idempotencyKey||idempotencyKey.length>200)throw new Error("Invalid idempotency key");}