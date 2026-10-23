"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clientRedirect,
  issueAuthorizationCode,
  validateAuthorizeRequest,
} from "@/lib/oauth";
import { requireUserId } from "@/lib/session";
import { getRequestOrigin } from "@/lib/site";

// The consent form posts back the original authorize query untouched, and
// both actions validate it from scratch — the page having rendered it says
// nothing about what arrives here.
async function validated(formData: FormData) {
  const query = new URLSearchParams(String(formData.get("query") ?? ""));
  const origin = getRequestOrigin(await headers());
  const result = await validateAuthorizeRequest(Object.fromEntries(query), origin);
  if (!result.ok) {
    if ("redirectTo" in result) redirect(result.redirectTo);
    throw new Error(result.message);
  }
  return { request: result.request, origin };
}

export async function approveAuthorization(formData: FormData) {
  const userId = await requireUserId();
  const { request, origin } = await validated(formData);
  redirect(await issueAuthorizationCode(userId, request, origin));
}

export async function denyAuthorization(formData: FormData) {
  await requireUserId();
  const { request, origin } = await validated(formData);
  redirect(
    clientRedirect(request.redirectUri, origin, {
      error: "access_denied",
      state: request.state,
    })
  );
}
