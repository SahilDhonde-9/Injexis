import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  }
  return _pool;
}
