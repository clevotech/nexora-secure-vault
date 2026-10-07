export type CreditEntry={id:string;userId:string;delta:number;reason:string;idempotencyKey:string;createdAt:string};
const ledger:CreditEntry[]=[]; const keys=new Set<string>();
export function balance(userId:string){return ledger.filter(x=>x.userId===userId).reduce((n,x)=>n+x.delta,0);}
export function applyCredit(userId:string,delta:number,reason:string,idempotencyKey:string){
  if(!/^[-+]?\d+(\.\d+)?$/.test(String(delta))||!Number.isFinite(delta)||delta===0)throw new Error("Invalid credit delta");
  if(keys.has(`${userId}:${idempotencyKey}`))return ledger.find(x=>x.userId===userId&&x.idempotencyKey===idempotencyKey)!;
  if(delta<0&&balance(userId)+delta<0)throw new Error("Insufficient credits");
  const entry={id:crypto.randomUUID(),userId,delta,reason,idempotencyKey,createdAt:new Date().toISOString()};
  ledger.push(entry);keys.add(`${userId}:${idempotencyKey}`);return entry;
}