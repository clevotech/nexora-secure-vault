import {Pool} from "pg";

export async function initializeDatabase(pool:Pool){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nexora_memory(
      id UUID PRIMARY KEY,user_id TEXT NOT NULL,content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS nexora_memory_user_idx ON nexora_memory(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS nexora_credits(
      id UUID PRIMARY KEY,user_id TEXT NOT NULL,delta NUMERIC(30,10) NOT NULL,
      reason TEXT NOT NULL,idempotency_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS nexora_credits_user_idx ON nexora_credits(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS nexora_jobs(
      id UUID PRIMARY KEY,user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image','video','transcription','speech')),
      status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,result JSONB,error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS nexora_jobs_user_idx ON nexora_jobs(user_id,created_at DESC);
  `);
}

export function createDatabasePool(){
  const rawUrl=process.env.DATABASE_URL;
  if(!rawUrl)return null;

  // Keep TLS certificate verification enabled. If Supabase uses a private/custom
  // database CA chain, supply its official root certificate through SUPABASE_DB_CA.
  // Render environment variables may store PEM newlines as literal \\n.
  const parsedUrl=new URL(rawUrl);
  for(const key of ["sslmode","ssl","sslcert","sslkey","sslrootcert","sslfactory"]){
    parsedUrl.searchParams.delete(key);
  }
  const ca=process.env.SUPABASE_DB_CA?.replace(/\\n/g,"\n").trim();
  const pool=new Pool({
    connectionString:parsedUrl.toString(),
    ssl:{rejectUnauthorized:true,...(ca?{ca}: {})},
    max:Number(process.env.NEXORA_DB_POOL_MAX||10),
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:5000
  });
  pool.on("error",error=>console.error("Nexora PostgreSQL pool error",error));return pool;
}