// RFC 8414 authorization server metadata — served at
// /.well-known/oauth-authorization-server via the rewrite in next.config.ts
// (Next ignores app-router directories that start with a dot). This is how an
// assistant connecting to /api/mcp finds where to register, sign the user in
// and fetch tokens. See src/lib/oauth.ts for the whole flow.

import { authorizationServerMetadata } from "@/lib/oauth";
import { getRequestOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(getRequestOrigin(req.headers)), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
