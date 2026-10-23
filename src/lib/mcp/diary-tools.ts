// MCP tools for the diary: reading a day, a week and the history, logging
// food, and editing what's been logged. Writes go through the same server
// actions the app's screens call.

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { logFoods, type LogFoodOptions } from "@/app/add/actions";
import {
  copyFoods,
  deleteFoods,
  moveFoods,
  updateFoodGrams,
  updateFoodQuickAdd,
} from "@/app/actions/foods";
import {
  copyMeal,
  deleteMeal,
  ensureMealOnDay,
  moveMeal,
  renameMeal,
  resetDay,
} from "@/app/actions/meals";
import { dayKeyInTz, isFutureDayKey, timeInputValueInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { loadDailyHistory } from "@/lib/daily-history";
import { syncTodaySnapshot } from "@/lib/daily-stats";
import { db } from "@/lib/db";
import { loadDayDetail } from "@/lib/day-detail";
import { loadDayMealItems } from "@/lib/default-meals";
import { roundNutrients, scaleFrom100g } from "@/lib/nutrition";
import { round1 } from "@/lib/utils";
import { loadWeekSummary } from "@/lib/week";
import { normalizeMealSort } from "@/lib/widget-order";

import {
  consumedOut,
  dateSchema,
  defineTool,
  goalGrams,
  gramsSchema,
  idSchema,
  macrosOut,
  nutrientsIn,
  per100gSchema,
  profileOf,
  SETUP_REQUIRED,
  timeSchema,
  totalsPatchSchema,
  totalsSchema,
} from "./tool";

const logItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(200).optional(),
    grams: gramsSchema.optional().describe("Portion eaten, in grams"),
    per_100g: per100gSchema
      .optional()
      .describe("Nutrition per 100g, as search_foods returned it. Needs grams."),
    totals: totalsSchema
      .optional()
      .describe("The portion's own totals, for a one-off with no per-100g basis (grams optional)"),
    fdc_id: z.number().int().optional().describe("fdc_id from search_foods, if it had one"),
    recipe_id: idSchema.optional().describe("recipe_id from search_foods/list_recipes, to link the recipe"),
  })
  .refine((i) => (i.per_100g ? i.grams != null : i.totals != null), {
    message: "Give per_100g with grams, or totals",
  });

export function registerDiaryTools(server: McpServer) {
  defineTool(
    server,
    "get_day",
    {
      title: "Get a day",
      description:
        "One day in full: calories eaten vs the goal and what's left, macros vs their goals, the day's burn (BMR + active = TDEE), weight, activity, and every meal with its foods. Returns the meal_id and food_id values the editing tools take. Today by default.",
      inputSchema: z.object({ date: dateSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }, userId) => {
      const profile = await profileOf(userId);
      const tz = profile.timezone || "UTC";
      const today = dayKeyInTz(tz);
      const dayKey = date ?? today;
      if (isFutureDayKey(tz, dayKey)) throw new Error("That date is in the future");

      // Today's stored burn follows the current profile, as the dashboard
      // keeps it, so these numbers match the app's.
      if (dayKey === today) await syncTodaySnapshot(profile, today);
      const d = await loadDayDetail(userId, profile, dayKey);
      const items = await loadDayMealItems({
        userId,
        meals: d.meals,
        dayKey,
        todayKey: today,
        tz,
        sortDir: normalizeMealSort(profile.mealSortDir),
      });

      return {
        date: dayKey,
        is_today: dayKey === today,
        calories: {
          eaten: Math.round(d.consumed.kcal),
          goal: d.calorieGoal,
          remaining: Math.round(d.calorieGoal - d.consumed.kcal),
          bmr: Math.round(d.bmrKcal),
          active: d.activeKcal,
          tdee: d.tdeeKcal,
        },
        macros: {
          protein_g: { eaten: round1(d.consumed.protein), goal: goalGrams(d.macroGoals.protein) },
          carbs_g: { eaten: round1(d.consumed.carbs), goal: goalGrams(d.macroGoals.carbs) },
          fat_g: { eaten: round1(d.consumed.fat), goal: goalGrams(d.macroGoals.fat) },
        },
        weight_kg: d.weight?.weightKg ?? null,
        activity: d.hasActivity
          ? {
              steps: d.activityLog?.steps ?? null,
              lifting_min: d.activityLog?.liftingMin ?? null,
              cardio_min: d.activityLog?.cardioMin ?? null,
              active_kcal: d.activityLog?.activeKcal ?? null,
              source: d.activityLog?.manual ? "entered by hand" : d.activityLog?.source ?? null,
            }
          : null,
        meals: items.map((item) =>
          item.kind === "real"
            ? {
                meal_id: item.meal.id,
                name: item.meal.name,
                time: timeInputValueInTz(item.meal.loggedAt, tz),
                kcal: Math.round(item.meal.foods.reduce((a, f) => a + f.kcal, 0)),
                foods: item.meal.foods.map((f) => ({
                  food_id: f.id,
                  name: f.name,
                  brand: f.brand,
                  // 0 = a calories-only entry with no weight behind it.
                  grams: f.grams,
                  ...macrosOut(f),
                  recipe_id: f.recipeId,
                })),
              }
            : {
                // A default meal the user hasn't eaten yet today. Logging
                // with log_foods meal_name set to this name fills it.
                meal_id: null,
                name: item.placeholder.name,
                time: item.placeholder.timeHhmm,
                kcal: 0,
                foods: [],
              }
        ),
      };
    }
  );

  defineTool(
    server,
    "get_history",
    {
      title: "Get daily history",
      description:
        "Per-day totals for the recent past: calories and macros eaten, the calorie goal, TDEE and weight. Only days with something logged appear.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(14).describe("How many days back from today"),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }, userId) => {
      const history = await loadDailyHistory(userId, days);
      if (!history) throw new Error(SETUP_REQUIRED);
      return history.entries.map((e) => ({
        date: e.dayKey,
        eaten: consumedOut(e.consumed),
        goal_kcal: e.calorieGoal,
        tdee: Math.round(e.tdeeKcal),
        weight_kg: e.weightKg,
      }));
    }
  );

  defineTool(
    server,
    "get_week",
    {
      title: "Get a week",
      description:
        "The energy balance of one week (the user's week start): eaten vs burned per day, the net, and the weight change that net predicts, against the goal's target. The current week by default; any date picks the week it falls in.",
      inputSchema: z.object({ date: dateSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }, userId) => {
      const profile = await profileOf(userId);
      const w = await loadWeekSummary(userId, profile, date ?? null);
      return {
        start: w.startKey,
        end: w.endKey,
        days: w.days
          .filter((d) => !d.isFuture)
          .map((d) => ({
            date: d.dayKey,
            logged: d.hasFood,
            eaten_kcal: Math.round(d.consumedKcal),
            tdee: Math.round(d.tdeeKcal),
            net_kcal: d.netKcal == null ? null : Math.round(d.netKcal),
          })),
        logged_days: w.loggedDays,
        net_kcal: Math.round(w.netKcal),
        target_net_kcal: Math.round(w.targetNetKcal),
        predicted_weight_change_kg: round1(w.predictedWeightKg),
        goal: w.goalType,
      };
    }
  );

  defineTool(
    server,
    "log_foods",
    {
      title: "Log foods",
      description:
        "Log one or more foods eaten together into a single meal. Pick the meal with meal_id (an existing meal from get_day) or meal_name (the meal of that name on that day, created if missing — e.g. 'Lunch'); with neither, today's food joins a meal from the last 2 hours or starts a new one. Each item is either per_100g + grams (from search_foods — preferred) or totals for a one-off.",
      inputSchema: z.object({
        items: z.array(logItemSchema).min(1).max(30),
        date: dateSchema.optional().describe("Day to log on; today by default"),
        meal_id: idSchema.optional(),
        meal_name: z.string().trim().min(1).max(60).optional(),
        time: timeSchema.optional().describe("When a new meal was eaten; now by default"),
      }),
    },
    async ({ items, date, meal_id, meal_name, time }, userId) => {
      const tz = await getProfileTimezone(userId);
      const today = dayKeyInTz(tz);
      const dayKey = date ?? today;

      let options: LogFoodOptions;
      if (meal_id != null) {
        options = { mealId: meal_id };
      } else if (meal_name) {
        // The same name-on-the-day rule a default meal's card uses, so
        // "Lunch" lands in today's Lunch rather than a second one.
        options = { mealId: await ensureMealOnDay(dayKey, meal_name, time) };
      } else if (time) {
        options = { newMealName: "", newMealTime: time, dayKey };
      } else {
        // Today auto-groups into a recent meal; a past day gets its own.
        options = { dayKey: dayKey === today ? null : dayKey };
      }

      const rows = items.map((item) => {
        const grams = round1(item.grams ?? 0);
        const nutrients = roundNutrients(
          item.per_100g
            ? scaleFrom100g(nutrientsIn(item.per_100g), grams)
            : nutrientsIn(item.totals!)
        );
        return {
          fdcId: item.fdc_id ?? null,
          recipeId: item.recipe_id ?? null,
          name: item.name,
          brand: item.brand || null,
          grams,
          ...nutrients,
        };
      });
      const { mealId } = await logFoods(rows, options);
      const logged = rows.map((r) => ({ name: r.name, grams: r.grams, ...macrosOut(r) }));
      return { meal_id: mealId, date: dayKey, logged };
    }
  );

  defineTool(
    server,
    "update_logged_food",
    {
      title: "Change a logged food",
      description:
        "Change how much of a logged food was eaten. grams rescales its calories and macros; totals overwrites them outright (the only option for a calories-only entry logged with no grams).",
      inputSchema: z
        .object({
          food_id: idSchema,
          grams: gramsSchema.optional(),
          totals: totalsPatchSchema.optional(),
        })
        .refine((v) => (v.grams == null) !== (v.totals == null), {
          message: "Give exactly one of grams or totals",
        }),
      annotations: { idempotentHint: true },
    },
    async ({ food_id, grams, totals }, userId) => {
      const food = await db.food.findFirst({ where: { id: food_id, meal: { userId } } });
      if (!food) throw new Error(`No logged food ${food_id}`);
      if (grams != null) {
        await updateFoodGrams(food_id, grams);
      } else {
        await updateFoodQuickAdd(food_id, {
          kcal: totals!.kcal ?? food.kcal,
          proteinG: totals!.protein_g ?? food.proteinG,
          carbsG: totals!.carbs_g ?? food.carbsG,
          fatG: totals!.fat_g ?? food.fatG,
        });
      }
      const after = await db.food.findUniqueOrThrow({ where: { id: food_id } });
      return { food_id, name: after.name, grams: after.grams, ...macrosOut(after) };
    }
  );

  defineTool(
    server,
    "delete_logged_foods",
    {
      title: "Delete logged foods",
      description: "Remove foods from the diary by food_id (from get_day).",
      inputSchema: z.object({ food_ids: z.array(idSchema).min(1).max(100) }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ food_ids }) => {
      await deleteFoods(food_ids);
    }
  );

  defineTool(
    server,
    "move_logged_foods",
    {
      title: "Move or copy logged foods",
      description:
        "Move foods into another existing meal (any day), or copy them there with copy: true — e.g. to repeat yesterday's breakfast items in today's.",
      inputSchema: z.object({
        food_ids: z.array(idSchema).min(1).max(100),
        target_meal_id: idSchema,
        copy: z.boolean().default(false),
      }),
    },
    async ({ food_ids, target_meal_id, copy }) => {
      await (copy ? copyFoods : moveFoods)(food_ids, target_meal_id);
    }
  );

  defineTool(
    server,
    "update_meal",
    {
      title: "Rename or move a meal",
      description:
        "Rename a meal, or move it (with all its foods) to another date and/or time. Leave out what shouldn't change.",
      inputSchema: z.object({
        meal_id: idSchema,
        name: z.string().trim().min(1).max(60).optional(),
        date: dateSchema.optional(),
        time: timeSchema.optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ meal_id, name, date, time }, userId) => {
      const [meal, tz] = await Promise.all([
        ownedMeal(meal_id, userId),
        getProfileTimezone(userId),
      ]);
      if (name) await renameMeal(meal_id, name);
      if (date || time) {
        await moveMeal(
          meal_id,
          date ?? dayKeyInTz(tz, meal.loggedAt),
          time ?? timeInputValueInTz(meal.loggedAt, tz)
        );
      }
    }
  );

  defineTool(
    server,
    "copy_meal",
    {
      title: "Copy a meal",
      description:
        "Duplicate a whole meal with all its foods onto a date (today by default) at a time (the original's by default) — how to repeat a meal the user eats regularly.",
      inputSchema: z.object({
        meal_id: idSchema,
        date: dateSchema.optional(),
        time: timeSchema.optional(),
      }),
    },
    async ({ meal_id, date, time }, userId) => {
      const [meal, tz] = await Promise.all([
        ownedMeal(meal_id, userId),
        getProfileTimezone(userId),
      ]);
      await copyMeal(
        meal_id,
        date ?? dayKeyInTz(tz),
        time ?? timeInputValueInTz(meal.loggedAt, tz)
      );
    }
  );

  defineTool(
    server,
    "delete_meal",
    {
      title: "Delete a meal",
      description: "Delete a meal and every food in it.",
      inputSchema: z.object({ meal_id: idSchema }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ meal_id }) => {
      await deleteMeal(meal_id);
    }
  );

  defineTool(
    server,
    "reset_day",
    {
      title: "Clear a day's food",
      description:
        "Delete every meal and food logged on a date. Weight and activity are kept. Only do this when the user clearly asks to wipe the day.",
      inputSchema: z.object({ date: dateSchema }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ date }) => {
      await resetDay(date);
    }
  );
}

async function ownedMeal(id: number, userId: string) {
  const meal = await db.meal.findFirst({
    where: { id, userId },
    select: { loggedAt: true },
  });
  if (!meal) throw new Error(`No meal ${id}`);
  return meal;
}
