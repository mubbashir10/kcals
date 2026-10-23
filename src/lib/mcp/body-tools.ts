// MCP tools for the person rather than the plate: profile and goals, weight,
// daily activity, default meals, and friends.

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { clearActivity, upsertActivity } from "@/app/actions/activity";
import {
  addDefaultMeal,
  deleteDefaultMeal,
  listDefaultMeals,
  updateDefaultMeal,
} from "@/app/actions/default-meals";
import { updateProfile } from "@/app/setup/actions";
import { deleteWeightLog, logWeight, updateWeightLog } from "@/app/actions/weight";
import {
  setGoal,
  setLactation,
  setMacroGoal,
  setTrackKcal,
  setUnits,
  setWeekStartDay,
} from "@/app/actions/widgets";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  lbToKg,
} from "@/lib/bmr";
import { dayKeyInTz, timeInputValueInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { loadDailyStats, type DailyStats } from "@/lib/daily-stats";
import { db } from "@/lib/db";
import { dayBurnKcal } from "@/lib/day-energy";
import { listFriendSummaries } from "@/lib/friends";
import { GOAL_PACES, GOAL_TYPES } from "@/lib/goal";
import { LACTATION_BASES, LACTATION_STAGES, LACTATION_STATUSES } from "@/lib/lactation";
import { MACRO_MODES, MACROS } from "@/lib/macros";
import { round1 } from "@/lib/utils";

import { dateSchema, defineTool, goalGrams, idSchema, profileOf, SETUP_REQUIRED, timeSchema } from "./tool";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const weightSchema = z.object({
  weight: z.number().positive(),
  unit: z.enum(["kg", "lb"]).describe("Always say which — never assume"),
});

const toKg = ({ weight, unit }: z.infer<typeof weightSchema>) =>
  unit === "lb" ? lbToKg(weight) : weight;

const macroGoalSchema = z.object({
  mode: z.enum(MACRO_MODES).describe("auto = from the calorie goal, custom = fixed grams, off = not tracked"),
  grams: z.number().int().min(0).max(1999).optional().describe("Required for custom"),
});

export function registerBodyTools(server: McpServer) {
  defineTool(
    server,
    "get_profile",
    {
      title: "Get profile and goals",
      description:
        "The user's body stats, units, timezone, goal (lose / maintain / gain / a fixed calorie target), today's calorie and macro targets, typical activity, breastfeeding setting, and default meals.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async (_args, userId) => profileOut(userId)
  );

  defineTool(
    server,
    "update_goals",
    {
      title: "Change goals",
      description:
        "Change the goal (loss/maintain/gain need no number; 'track' follows target_kcal), its pace for loss or gain, the fixed calorie target, or how each macro's goal is set. Returns the new targets.",
      inputSchema: z.object({
        goal: z.enum(GOAL_TYPES).optional(),
        pace: z.enum(GOAL_PACES).optional().describe("Loss/gain speed: mild, moderate or aggressive"),
        target_kcal: z.number().int().min(800).max(8000).nullable().optional().describe("Daily calories for the 'track' goal"),
        protein: macroGoalSchema.optional(),
        carbs: macroGoalSchema.optional(),
        fat: macroGoalSchema.optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async (args, userId) => {
      const profile = await profileOf(userId);
      if (args.goal || args.pace) {
        const goal = args.goal ?? profile.goalType;
        const paced = goal === "loss" || goal === "gain";
        if (args.pace && !paced) throw new Error("Pace only applies to a loss or gain goal");
        const pace = paced
          ? args.pace ?? (profile.goalPace as (typeof GOAL_PACES)[number] | null) ?? "moderate"
          : null;
        await setGoal(goal as (typeof GOAL_TYPES)[number], pace);
      }
      if (args.target_kcal !== undefined) await setTrackKcal(args.target_kcal);
      for (const macro of MACROS) {
        const m = args[macro];
        if (!m) continue;
        if (m.mode === "custom" && m.grams == null) {
          throw new Error(`A custom ${macro} goal needs grams`);
        }
        await setMacroGoal(macro, m.mode, m.grams ?? null);
      }
      return targetsOut(await statsOf(userId));
    }
  );

  defineTool(
    server,
    "update_profile",
    {
      title: "Change profile",
      description:
        "Change body stats (weight goes through log_weight instead), units, which day the week starts, the typical day's activity that every day's burn starts from, or breastfeeding. Leave out what shouldn't change.",
      inputSchema: z.object({
        sex: z.enum(["male", "female"]).optional(),
        age: z.number().int().min(13).max(120).optional(),
        height_cm: z.number().min(HEIGHT_MIN_CM).max(HEIGHT_MAX_CM).optional(),
        body_fat_pct: z.number().min(BODY_FAT_MIN_PCT).max(BODY_FAT_MAX_PCT).nullable().optional(),
        units: z.enum(["metric", "imperial"]).optional(),
        week_starts_on: z.enum(WEEKDAYS).optional(),
        typical_day: z
          .object({
            steps_per_day: z.number().int().min(0).max(100000).nullable(),
            lifting_sessions_per_week: z.number().int().min(0).max(21).nullable(),
            lifting_minutes_per_session: z.number().int().min(1).max(300).nullable(),
            cardio_sessions_per_week: z.number().int().min(0).max(21).nullable(),
            cardio_minutes_per_session: z.number().int().min(1).max(300).nullable(),
            active_kcal: z
              .number()
              .int()
              .min(0)
              .max(4000)
              .nullable()
              .describe("A known daily active-calorie figure; set, it wins over the movement fields"),
          })
          .partial()
          .optional(),
        breastfeeding: z
          .object({
            status: z.enum(LACTATION_STATUSES),
            baby_age: z.enum(LACTATION_STAGES).optional(),
            basis: z.enum(LACTATION_BASES).optional().describe("maintain = full milk cost, iom = allows gentle loss"),
          })
          .optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async (args, userId) => {
      const profile = await profileOf(userId);
      if (args.units) await setUnits(args.units);
      if (args.week_starts_on) await setWeekStartDay(WEEKDAYS.indexOf(args.week_starts_on));
      if (args.breastfeeding) {
        const b = args.breastfeeding;
        await setLactation(
          b.status,
          b.baby_age ?? null,
          b.basis ?? (profile.lactationBasis as (typeof LACTATION_BASES)[number])
        );
      }

      const t = args.typical_day ?? {};
      await updateProfile({
        sex: args.sex,
        age: args.age,
        heightCm: args.height_cm,
        bodyFatPct: args.body_fat_pct,
        stepsPerDay: t.steps_per_day,
        liftingSessionsPerWeek: t.lifting_sessions_per_week,
        liftingMinutesPerSession: t.lifting_minutes_per_session,
        cardioSessionsPerWeek: t.cardio_sessions_per_week,
        cardioMinutesPerSession: t.cardio_minutes_per_session,
        activeKcalOverride: t.active_kcal,
      });
      return profileOut(userId);
    }
  );

  defineTool(
    server,
    "log_weight",
    {
      title: "Log weight",
      description: "Record a weigh-in, today by default. The newest weigh-in becomes the profile's weight.",
      inputSchema: weightSchema.extend({ date: dateSchema.optional() }),
    },
    async (args) => {
      await logWeight(toKg(args), args.date ?? null);
      return { weight_kg: round1(toKg(args)) };
    }
  );

  defineTool(
    server,
    "list_weights",
    {
      title: "List weigh-ins",
      description: "Weigh-ins over the recent past, newest first, with the weight_id the edit tools take.",
      inputSchema: z.object({ days: z.number().int().min(1).max(3650).default(90) }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }, userId) => {
      const [tz, logs] = await Promise.all([
        getProfileTimezone(userId),
        db.weightLog.findMany({
          where: { userId, loggedAt: { gte: new Date(Date.now() - days * 86400_000) } },
          orderBy: { loggedAt: "desc" },
        }),
      ]);
      return logs.map((w) => ({
        weight_id: w.id,
        date: dayKeyInTz(tz, w.loggedAt),
        time: timeInputValueInTz(w.loggedAt, tz),
        weight_kg: w.weightKg,
        source: w.source ?? "kcals",
      }));
    }
  );

  defineTool(
    server,
    "update_weight",
    {
      title: "Correct a weigh-in",
      description: "Change the weight of a recorded weigh-in (weight_id from list_weights).",
      inputSchema: weightSchema.extend({ weight_id: idSchema }),
      annotations: { idempotentHint: true },
    },
    async (args, userId) => {
      await ownWeight(args.weight_id, userId);
      await updateWeightLog(args.weight_id, toKg(args));
      return { weight_id: args.weight_id, weight_kg: round1(toKg(args)) };
    }
  );

  defineTool(
    server,
    "delete_weight",
    {
      title: "Delete a weigh-in",
      description: "Delete a recorded weigh-in (weight_id from list_weights).",
      inputSchema: z.object({ weight_id: idSchema }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ weight_id }) => {
      await deleteWeightLog(weight_id);
    }
  );

  defineTool(
    server,
    "set_activity",
    {
      title: "Set a day's activity",
      description:
        "Say what a day's activity actually was, replacing the profile's typical day for that date (today by default): steps, minutes lifting, minutes of cardio, or a known active-calorie total (which wins over the rest). Fields left out are cleared for that day. Returns the day's new burn.",
      inputSchema: z
        .object({
          date: dateSchema.optional(),
          steps: z.number().int().min(0).max(200000).optional(),
          lifting_min: z.number().int().min(0).max(600).optional(),
          cardio_min: z.number().int().min(0).max(600).optional(),
          active_kcal: z.number().int().min(0).max(10000).optional(),
        })
        .refine(
          (a) => [a.steps, a.lifting_min, a.cardio_min, a.active_kcal].some((v) => v != null),
          { message: "Give at least one of steps, lifting_min, cardio_min or active_kcal" }
        ),
      annotations: { idempotentHint: true },
    },
    async ({ date, steps, lifting_min, cardio_min, active_kcal }, userId) => {
      await upsertActivity(date ?? null, {
        steps,
        liftingMin: lifting_min,
        cardioMin: cardio_min,
        activeKcal: active_kcal,
      });
      return dayBurn(userId, date);
    }
  );

  defineTool(
    server,
    "clear_activity",
    {
      title: "Clear a day's activity",
      description: "Put a day (today by default) back on the profile's typical day, and back in the hands of Health Connect sync.",
      inputSchema: z.object({ date: dateSchema.optional() }),
      annotations: { idempotentHint: true },
    },
    async ({ date }, userId) => {
      await clearActivity(date ?? null);
      return dayBurn(userId, date);
    }
  );

  defineTool(
    server,
    "update_default_meals",
    {
      title: "Edit default meals",
      description:
        "Default meals are the meals the user plans every day (e.g. Breakfast at 08:00); each shows as an empty slot on today until food is logged into it. Add, change (default_meal_id from get_profile) or remove them.",
      inputSchema: z.object({
        add: z.array(z.object({ name: z.string().trim().min(1).max(60), time: timeSchema })).max(10).optional(),
        update: z
          .array(z.object({ default_meal_id: idSchema, name: z.string().trim().min(1).max(60), time: timeSchema }))
          .max(10)
          .optional(),
        remove_ids: z.array(idSchema).max(10).optional(),
      }),
    },
    async (args) => {
      for (const m of args.update ?? []) await updateDefaultMeal(m.default_meal_id, { name: m.name, timeHhmm: m.time });
      for (const id of args.remove_ids ?? []) await deleteDefaultMeal(id);
      for (const m of args.add ?? []) await addDefaultMeal(m.name, m.time);
      return defaultMealsOut(await listDefaultMeals());
    }
  );

  defineTool(
    server,
    "list_friends",
    {
      title: "List friends",
      description: "The user's kcals friends and how each one's day is going today (calories and macros vs their goal).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async (_args, userId) =>
      (await listFriendSummaries(userId)).map((f) => ({
        name: f.name,
        email: f.email,
        today: f.hasProfile
          ? {
              eaten_kcal: Math.round(f.consumedKcal),
              goal_kcal: f.goalKcal,
              protein_g: round1(f.consumedProtein),
              carbs_g: round1(f.consumedCarbs),
              fat_g: round1(f.consumedFat),
            }
          : null,
      }))
  );
}

// Loading the day the way the dashboard does keeps today's targets on the
// current profile, so what these say matches the app.
async function statsOf(userId: string) {
  const stats = await loadDailyStats(userId);
  if (!stats) throw new Error(SETUP_REQUIRED);
  return stats;
}

function targetsOut(stats: NonNullable<DailyStats>) {
  return {
    date: stats.todayKey,
    calorie_goal: stats.calorieGoal,
    tdee: stats.tdee,
    bmr: Math.round(stats.bmr.kcal),
    protein_goal_g: goalGrams(stats.macroGoals.protein),
    carbs_goal_g: goalGrams(stats.macroGoals.carbs),
    fat_goal_g: goalGrams(stats.macroGoals.fat),
  };
}

function defaultMealsOut(meals: Awaited<ReturnType<typeof listDefaultMeals>>) {
  return meals.map((d) => ({ default_meal_id: d.id, name: d.name, time: d.timeHhmm }));
}

async function profileOut(userId: string) {
  const [stats, defaults] = await Promise.all([statsOf(userId), listDefaultMeals()]);
  const p = stats.profile;
  return {
    sex: p.sex,
    age: p.age,
    height_cm: p.heightCm,
    weight_kg: stats.latestWeight?.weightKg ?? p.weightKg,
    body_fat_pct: p.bodyFatPct,
    units: p.units,
    timezone: stats.tz,
    week_starts_on: WEEKDAYS[p.weekStartDay] ?? "monday",
    goal: { type: p.goalType, pace: p.goalPace, target_kcal: p.trackKcal },
    today: targetsOut(stats),
    macro_goal_modes: {
      protein: { mode: p.proteinGoalMode, grams: p.proteinGoalG },
      carbs: { mode: p.carbsGoalMode, grams: p.carbsGoalG },
      fat: { mode: p.fatGoalMode, grams: p.fatGoalG },
    },
    typical_day: {
      steps_per_day: p.stepsPerDay,
      lifting_sessions_per_week: p.liftingSessionsPerWeek,
      lifting_minutes_per_session: p.liftingMinutesPerSession,
      cardio_sessions_per_week: p.cardioSessionsPerWeek,
      cardio_minutes_per_session: p.cardioMinutesPerSession,
      active_kcal: p.activeKcalOverride,
    },
    breastfeeding: { status: p.lactationStatus, baby_age: p.lactationStage, basis: p.lactationBasis },
    default_meals: defaultMealsOut(defaults),
  };
}

// A day's burn as it now stands, read back after an activity change — the
// same terms get_day reports, milk included in the TDEE.
async function dayBurn(userId: string, date: string | undefined) {
  const profile = await profileOf(userId);
  const dayKey = date ?? dayKeyInTz(profile.timezone || "UTC");
  const row = await db.activityLog.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
    select: { bmrKcal: true, tdeeKcal: true },
  });
  if (row?.bmrKcal == null || row.tdeeKcal == null) return { date: dayKey };
  return {
    date: dayKey,
    bmr: Math.round(row.bmrKcal),
    active: Math.round(row.tdeeKcal - row.bmrKcal),
    tdee: Math.round(dayBurnKcal(row.tdeeKcal, profile)),
  };
}

async function ownWeight(id: number, userId: string) {
  const w = await db.weightLog.findFirst({ where: { id, userId }, select: { id: true } });
  if (!w) throw new Error(`No weigh-in ${id}`);
}
