// The kcals MCP server: everything the app can do, as tools an AI assistant
// can call for the signed-in user. Mounted at /api/mcp (see that route for
// auth); tools live in the three *-tools.ts files beside this one.

import type { McpServer } from "@modelcontextprotocol/server";

import { registerBodyTools } from "./body-tools";
import { registerDiaryTools } from "./diary-tools";
import { registerFoodTools } from "./food-tools";

// The deploy's short commit SHA (see next.config.ts) — what changed is the
// web build, so that's the version worth reporting.
export const SERVER_INFO = {
  name: "kcals",
  version: process.env.NEXT_PUBLIC_BUILD_SHA ?? "local",
};

export const INSTRUCTIONS = `kcals is the user's calorie and macro tracker. Energy is kcal, food amounts are grams, and dates (YYYY-MM-DD) and times (24-hour HH:MM) are in the user's own timezone. Dates default to the user's today.

Logging food: search_foods first, pick the best match, and log it with log_foods — passing its per_100g values and the grams actually eaten (convert cups, slices or pieces to grams; a result's serving says what one is). Prefer what the user has eaten before and their saved foods, then reference and community entries, then branded products. Group food eaten together into one log_foods call. When nothing matches and you have real numbers (a label, the restaurant's published nutrition), add it with create_custom_food — it's shared with every kcals user, so use the product's real name and its real values — then log it. Use totals only for a one-off with no weight.

get_day shows a day's meals with the meal_id and food_id values the editing tools take, and how many calories are left.`;

export function registerKcalsTools(server: McpServer) {
  registerDiaryTools(server);
  registerFoodTools(server);
  registerBodyTools(server);
}
