// Central database exports.
// All new code should import from here; lib/prisma.ts remains for backward compat.
//
// Read-replica pattern (for future Postgres migration):
//   Set DATABASE_READ_URL to a replica DSN and dbRead will use it for reads.
//   With SQLite both point to the same file — no overhead.
export { prisma as db, prisma as dbRead } from "../lib/prisma.js";
export { prisma } from "../lib/prisma.js";
