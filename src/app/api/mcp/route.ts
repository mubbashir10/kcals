// The MCP endpoint AI assistants connect to: https://kcals.app/api/mcp.
//
// Stateless Streamable HTTP — every request stands alone, so it runs as an
// ordinary function. Requests must carry an OAuth access token from kcals's
// own authorization server (src/lib/oauth.ts); without one the 401 points the
// client at the discovery documents and the sign-in flow starts from there.

import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { INSTRUCTIONS, registerKcalsTools, SERVER_INFO } from "@/lib/mcp/server";
import { MCP_PATH, verifyAccessToken } from "@/lib/oauth";
import { getRequestOrigin } from "@/lib/site";

// Food search fans out to USDA and Open Food Facts; give a slow one room.
export const maxDuration = 60;

const mcp = createMcpHandler(registerKcalsTools, {
  serverInfo: SERVER_INFO,
  instructions: INSTRUCTIONS,
});

const verify = (_req: Request, token?: string) =>
  token ? verifyAccessToken(token) : undefined;

// Wrapped per request so the 401's metadata URL names the same origin as the
// OAuth documents, which derive theirs from the request too.
function handler(req: Request): Promise<Response> {
  return withMcpAuth(mcp, verify, {
    required: true,
    resourceUrl: getRequestOrigin(req.headers),
    resourceMetadataPath: `/.well-known/oauth-protected-resource${MCP_PATH}`,
  })(req);
}

export { handler as GET, handler as POST, handler as DELETE };
