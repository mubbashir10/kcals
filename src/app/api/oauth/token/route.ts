// OAuth token endpoint: authorization_code (with PKCE) and refresh_token
// grants. Form-encoded per RFC 6749; see src/lib/oauth.ts.

import { basicClientCredentials, exchangeToken } from "@/lib/oauth";

export async function POST(req: Request) {
  const result = await exchangeToken(
    new URLSearchParams(await req.text()),
    basicClientCredentials(req.headers.get("authorization"))
  );
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}
