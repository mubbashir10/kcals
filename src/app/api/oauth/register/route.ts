// Dynamic Client Registration (RFC 7591), for assistants that predate
// client metadata documents. Open by design — registering grants nothing on
// its own; every connection still goes through the user's consent screen.

import { registerClient } from "@/lib/oauth";

export async function POST(req: Request) {
  const result = await registerClient(await req.json().catch(() => null));
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
