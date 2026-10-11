import {Pool} from "pg";
import {readFile} from "node:fs/promises";

const SUPABASE_ROOT_CA_URL="https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt";

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
  // Keep the additive leave/audit schema in a versioned SQL file so deploys
  // can safely create new tables without replacing or dropping existing data.
  const leaveMigration=await readFile(new URL("../migrations/003_leave_tracker_audit.sql",import.meta.url),"utf8");
  await pool.query(leaveMigration);
  const holidayMigration=await readFile(new URL("../migrations/004_leave_holidays.sql",import.meta.url),"utf8");
  await pool.query(holidayMigration);
  const organizationMigration=await readFile(new URL("../migrations/005_organizations.sql",import.meta.url),"utf8");
  await pool.query(organizationMigration);
  const simpleUserIdsMigration=await readFile(new URL("../migrations/006_simple_user_ids.sql",import.meta.url),"utf8");
  await pool.query(simpleUserIdsMigration);
  const organizationHolidayMigration=await readFile(new URL("../migrations/007_organization_leave_holidays.sql",import.meta.url),"utf8");
  await pool.query(organizationHolidayMigration);
}

export async function createDatabasePool(){
  const rawUrl=process.env.DATABASE_URL;
  if(!rawUrl)return null;

  // Supabase documents this public root CA for verified PostgreSQL TLS.
  // Prefer a project-specific CA configured in Render, otherwise retrieve the
  // official Supabase root CA over HTTPS using Node's normal certificate checks.
  const configuredCa=process.env.SUPABASE_DB_CA?.replace(/\\\\n/g,"\\n").trim();
  let ca=configuredCa;
  if(!ca){
    const response=await fetch(SUPABASE_ROOT_CA_URL);
    if(!response.ok)throw new Error(`Could not retrieve the official Supabase database CA (HTTP ${response.status}); set SUPABASE_DB_CA in Render.`);
    ca=(await response.text()).trim();
    if(!ca.includes("-----BEGIN CERTIFICATE-----")||!ca.includes("-----END CERTIFICATE-----")){
      throw new Error("The official Supabase database CA response was not a valid PEM certificate; set SUPABASE_DB_CA in Render.");
    }
  }

  const parsedUrl=new URL(rawUrl);
  for(const key of ["sslmode","ssl","sslcert","sslkey","sslrootcert","sslfactory"]){
    parsedUrl.searchParams.delete(key);
  }
  const pool=new Pool({
    connectionString:parsedUrl.toString(),
    ssl:{ca,rejectUnauthorized:true},
    max:Number(process.env.NEXORA_DB_POOL_MAX||10),
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:5000
  });
  pool.on("error",error=>console.error("Nexora PostgreSQL pool error",error));return pool;
}