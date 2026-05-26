import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Node 22's Happy Eyeballs races IPv6+IPv4 with a 250ms attempt timeout.
// On networks that resolve AAAA records but have no IPv6 route (common on
// residential ISPs), the v6 EHOSTUNREACH trips Node into bailing before
// v4 finishes the SSL+Postgres handshake — pg surfaces this as ETIMEDOUT
// even though `nc` to the same IP works. Force serial IPv4-then-IPv6.
net.setDefaultAutoSelectFamily(false);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Provision Neon (or any Postgres) and put the URL in .env.local."
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
