// Shared plumbing for the MCP tools: how a tool learns who it's acting for,
// how its result and errors reach the assistant, and the input shapes several
// tools share.

import type {
  CallToolResult,
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { isDayKey, isHhmm } from "@/lib/clock";
import { db } from "@/lib/db";
import type { MacroGoal } from "@/lib/macros";
import { MAX_MACRO_G, MAX_MACRO_PER_100G, MAX_PORTION_GRAMS } from "@/lib/nutrition";
import { runAsUser } from "@/lib/session";
import { round1 } from "@/lib/utils";

type ToolConfig<S extends StandardSchemaWithJSON> = {
  title: string;
  description: string;
  inputSchema: S;
  annotations?: ToolAnnotations;
};

/**
 * Register a tool whose body runs as the user the bearer token belongs to —
 * so the server actions it calls see that user from requireUserId() (see
 * runAsUser in lib/session.ts). Whatever the body returns goes back as JSON;
 * whatever it throws goes back as a tool error the assistant can read and
 * correct, which is how the actions' own validation messages reach it.
 */
export function defineTool<S extends StandardSchemaWithJSON>(
  server: McpServer,
  name: string,
  config: ToolConfig<S>,
  run: (args: StandardSchemaWithJSON.InferOutput<S>, userId: string) => Promise<unknown>
) {
  const handler = async (
    args: StandardSchemaWithJSON.InferOutput<S>,
    ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }
  ): Promise<CallToolResult> => {
    const userId = ctx.http?.authInfo?.extra?.userId;
    if (typeof userId !== "string") return errorResult("Not signed in to kcals");
    try {
      const out = await runAsUser(userId, () => run(args, userId));
      return { content: [{ type: "text", text: JSON.stringify(out ?? { ok: true }) }] };
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : "Something went wrong");
    }
  };
  // registerTool's callback type is conditional on the schema, which TS can't
  // resolve for a generic S; the handler above is exactly its schema branch.
  server.registerTool(name, config, handler as never);
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export const SETUP_REQUIRED = "This kcals account hasn't finished setup — open the app once first.";

/** The user's profile, or a clear error for someone who never finished setup. */
export async function profileOf(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error(SETUP_REQUIRED);
  return profile;
}

// ─── Shared input shapes ────────────────────────────────────────────────

export const dateSchema = z
  .string()
  .refine(isDayKey, "Use YYYY-MM-DD")
  .describe("Calendar date YYYY-MM-DD in the user's timezone");

export const timeSchema = z
  .string()
  .refine(isHhmm, "Use 24-hour HH:MM")
  .describe("Local time, 24-hour HH:MM");

export const idSchema = z.number().int().positive();

// Per-100g basis. Nothing edible beats pure fat's ~900 kcal per 100g.
export const per100gSchema = z.object({
  kcal: z.number().min(0).max(900),
  protein_g: z.number().min(0).max(MAX_MACRO_PER_100G).default(0),
  carbs_g: z.number().min(0).max(MAX_MACRO_PER_100G).default(0),
  fat_g: z.number().min(0).max(MAX_MACRO_PER_100G).default(0),
});

// A portion's totals, as logged.
const totalsFields = {
  kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(MAX_MACRO_G),
  carbs_g: z.number().min(0).max(MAX_MACRO_G),
  fat_g: z.number().min(0).max(MAX_MACRO_G),
};

export const totalsSchema = z.object({
  kcal: totalsFields.kcal,
  protein_g: totalsFields.protein_g.default(0),
  carbs_g: totalsFields.carbs_g.default(0),
  fat_g: totalsFields.fat_g.default(0),
});

// For editing: a missing field means "keep it". Built without the defaults
// above, which zod would otherwise still fill in under .partial().
export const totalsPatchSchema = z.object(totalsFields).partial();

export const gramsSchema = z.number().gt(0).max(MAX_PORTION_GRAMS);

// ─── Output shaping ─────────────────────────────────────────────────────

/** The app's Nutrients shape → the snake_case one tools speak. */
export function macrosOut(n: { kcal: number; proteinG: number; carbsG: number; fatG: number }) {
  return {
    kcal: Math.round(n.kcal),
    protein_g: round1(n.proteinG),
    carbs_g: round1(n.carbsG),
    fat_g: round1(n.fatG),
  };
}

/** A day's eaten totals, as the history loaders shape them. */
export function consumedOut(c: { kcal: number; protein: number; carbs: number; fat: number }) {
  return macrosOut({ kcal: c.kcal, proteinG: c.protein, carbsG: c.carbs, fatG: c.fat });
}

/** A food's suggested serving, when it has one. */
export function servingOut(f: { servingSizeG: number | null; servingLabel: string | null }) {
  return f.servingSizeG ? { grams: f.servingSizeG, label: f.servingLabel } : null;
}

export function nutrientsIn(n: z.infer<typeof per100gSchema> | z.infer<typeof totalsSchema>) {
  return { kcal: n.kcal, proteinG: n.protein_g, carbsG: n.carbs_g, fatG: n.fat_g };
}

/** A macro goal in grams, or null when the user doesn't track that macro. */
export function goalGrams(goal: MacroGoal): number | null {
  return goal.kind === "off" ? null : goal.g;
}
