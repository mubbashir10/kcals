// RFC 9728 protected resource metadata for the MCP endpoint — served at
// /.well-known/oauth-protected-resource (and its /api/mcp path-suffixed form)
// via the rewrite in next.config.ts. A 401 from /api/mcp points here; this
// names the authorization server, which is kcals itself.

import { generateProtectedResourceMetadata } from "mcp-handler";

import { mcpResourceUrl, OAUTH_SCOPE } from "@/lib/oauth";
import { getRequestOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const origin = getRequestOrigin(req.headers);
  // The resource is named explicitly rather than read back off the URL:
  // there's only one, and after the rewrite the path no longer says which.
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: mcpResourceUrl(origin),
    additionalMetadata: {
      resource_name: "kcals",
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
    },
  });
  return Response.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
