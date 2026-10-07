import {Pool} from "pg";

export async function initializeDatabase(pool:Pool){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nexora_memory(
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS nexora_memory_user_idx ON nexora_memory(user_id,created_at DESC);
  `);
}

export function createDatabasePool(){
  const url=process.env.DATABASE_URL;
  if(!url)return null;
  const pool=new Pool({
    connectionString:url,
    max:Number(process.env.NEXORA_DB_POOL_MAX||10),
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:5000
  });
  pool.on("error",error=>console.error("Nexora PostgreSQL pool error",error));
  return pool;
}
