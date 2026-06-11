import { Pool } from "pg";

declare global {
  // Reuse pool across HMR reloads
  var _pgPool: Pool | undefined;
}

export const pool: Pool =
  global._pgPool ??
  (global._pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 5,
  }));
