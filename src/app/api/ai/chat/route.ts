import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific, formatDate, addDays } from "@/lib/dates";

const anthropic = new Anthropic();

// Simple in-memory rate limiting (per-user, per-day)
const MAX_DAILY_MESSAGES = 100;
const dailyMessageCounts = new Map<string, { count: number; date: string }>();

function checkRateLimit(userId: number): boolean {
  const today = new Date().toISOString().split("T")[0];
  const key = `${userId}`;
  const entry = dailyMessageCounts.get(key);
  if (!entry || entry.date !== today) {
    dailyMessageCounts.set(key, { count: 1, date: today });
    return true;
  }
  if (entry.count >= MAX_DAILY_MESSAGES) return false;
  entry.count++;
  return true;
}

const tools: Anthropic.Tool[] = [
  {
    name: "get_all_exercises",
    description: "List available exercises, optionally filtered by category (warmup_tool, mobility, recovery_tool)",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Filter by category" },
      },
      required: [],
    },
  },
  {
    name: "add_exercise_to_plan",
    description: "Add an exercise to the user's daily plan",
    input_schema: {
      type: "object" as const,
      properties: {
        exercise_id: { type: "string", description: "Exercise ID to add" },
      },
      required: ["exercise_id"],
    },
  },
  {
    name: "remove_exercise_from_plan",
    description: "Remove an exercise from today and all future plan days",
    input_schema: {
      type: "object" as const,
      properties: {
        exercise_id: { type: "string", description: "Exercise ID to remove" },
      },
      required: ["exercise_id"],
    },
  },
  {
    name: "get_all_supplements",
    description: "List available supplements",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "add_supplement",
    description: "Add a supplement to the user's daily routine",
    input_schema: {
      type: "object" as const,
      properties: {
        supplement_id: { type: "string", description: "Supplement ID" },
        time_group: { type: "string", description: "am, mid, or pm" },
      },
      required: ["supplement_id", "time_group"],
    },
  },
  {
    name: "remove_supplement",
    description: "Remove a supplement from the user's routine",
    input_schema: {
      type: "object" as const,
      properties: {
        supplement_id: { type: "string", description: "Supplement ID" },
      },
      required: ["supplement_id"],
    },
  },
  {
    name: "create_custom_exercise",
    description: "Create a new custom exercise and add it to the user's plan. Only warmup_tool, mobility, and recovery_tool categories are allowed.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Exercise name" },
        category: { type: "string", description: "Must be warmup_tool, mobility, or recovery_tool" },
        targets: { type: "string", description: "Target areas (e.g. hips, shoulders)" },
        default_rx: { type: "string", description: "Default prescription (e.g. 2x30s each side)" },
      },
      required: ["name", "category", "targets", "default_rx"],
    },
  },
  {
    name: "create_custom_supplement",
    description: "Create a new custom supplement and add it to the user's routine",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Supplement name" },
        time: { type: "string", description: "When to take (e.g. with breakfast)" },
        time_group: { type: "string", description: "am, mid, or pm" },
      },
      required: ["name", "time", "time_group"],
    },
  },
  {
    name: "update_training_days",
    description: "Change how many days per week the user trains",
    input_schema: {
      type: "object" as const,
      properties: {
        days_per_week: { type: "number", description: "1-7" },
      },
      required: ["days_per_week"],
    },
  },
  {
    name: "finalize_onboarding",
    description: "Save the user's profile notes from the onboarding conversation",
    input_schema: {
      type: "object" as const,
      properties: {
        profile_notes: { type: "string", description: "Summary of user goals, problem areas, equipment, injuries" },
      },
      required: ["profile_notes"],
    },
  },
];

async function handleToolCall(
  toolName: string,
  input: Record<string, unknown>,
  userId: number
): Promise<string> {
  switch (toolName) {
    case "get_all_exercises": {
      const where = input.category ? { category: input.category as string } : {};
      const exercises = await prisma.exercise.findMany({ where, orderBy: { name: "asc" } });
      return JSON.stringify(exercises.map((e) => ({ id: e.id, name: e.name, category: e.category, targets: e.targets })));
    }
    case "add_exercise_to_plan": {
      const exerciseId = input.exercise_id as string;
      const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
      if (!exercise) return JSON.stringify({ error: "Exercise not found" });
      const enrollment = await prisma.userEnrollment.findFirst({ where: { userId, status: "active" } });
      if (!enrollment) return JSON.stringify({ error: "No active enrollment" });
      const today = todayPacific();
      await prisma.userDailyPlan.upsert({
        where: { userId_date_exerciseId: { userId, date: today, exerciseId } },
        update: {},
        create: {
          userId, programId: enrollment.programId, date: today,
          dayType: "custom", exerciseId, category: exercise.category,
          sortOrder: 999, rx: exercise.defaultRx, isManual: true,
        },
      });
      return JSON.stringify({ ok: true, added: exercise.name });
    }
    case "remove_exercise_from_plan": {
      const exerciseId = input.exercise_id as string;
      const today = todayPacific();
      await prisma.userDailyPlan.deleteMany({ where: { userId, exerciseId, date: { gte: today } } });
      return JSON.stringify({ ok: true, removed: exerciseId });
    }
    case "get_all_supplements": {
      const supplements = await prisma.supplement.findMany({ orderBy: { name: "asc" } });
      return JSON.stringify(supplements);
    }
    case "add_supplement": {
      const supplementId = input.supplement_id as string;
      const timeGroup = input.time_group as string;
      await prisma.userSupplement.upsert({
        where: { userId_supplementId: { userId, supplementId } },
        update: { timeGroup },
        create: { userId, supplementId, timeGroup },
      });
      return JSON.stringify({ ok: true });
    }
    case "remove_supplement": {
      const supplementId = input.supplement_id as string;
      await prisma.userSupplement.deleteMany({ where: { userId, supplementId } });
      return JSON.stringify({ ok: true });
    }
    case "create_custom_exercise": {
      const name = input.name as string;
      const category = input.category as string;
      const targets = input.targets as string;
      const defaultRx = input.default_rx as string;

      const allowedCategories = ["warmup_tool", "mobility", "recovery_tool"];
      if (!allowedCategories.includes(category)) {
        return JSON.stringify({ error: `Category "${category}" is not allowed. Only warmup_tool, mobility, and recovery_tool are permitted. No strength training here — we're keeping those joints happy, not heavy!` });
      }

      // Reject suspicious names
      const suspiciousPatterns = /\b(weapon|gun|knife|sword|drug|cocaine|meth|heroin|alcohol|beer|wine|pizza|burger|taco|joke|prank|trick)\b/i;
      if (suspiciousPatterns.test(name)) {
        return JSON.stringify({ error: `Nice try! "${name}" doesn't sound like a mobility exercise. Let's stick to things that help your joints feel amazing.` });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const exerciseId = `custom-${slug}`;

      // Check if already exists
      const existing = await prisma.exercise.findUnique({ where: { id: exerciseId } });
      if (existing) {
        return JSON.stringify({ error: "An exercise with this name already exists", existing: { id: existing.id, name: existing.name } });
      }

      const exercise = await prisma.exercise.create({
        data: { id: exerciseId, name, category, targets, defaultRx },
      });

      // Add to today's plan
      const enrollment = await prisma.userEnrollment.findFirst({ where: { userId, status: "active" } });
      if (enrollment) {
        const today = todayPacific();
        await prisma.userDailyPlan.upsert({
          where: { userId_date_exerciseId: { userId, date: today, exerciseId } },
          update: {},
          create: {
            userId, programId: enrollment.programId, date: today,
            dayType: "custom", exerciseId, category,
            sortOrder: 999, rx: defaultRx, isManual: true,
          },
        });

        // Add to future plan days (next 7 days that have plans)
        const futurePlans = await prisma.userDailyPlan.findMany({
          where: { userId, date: { gt: today } },
          select: { date: true },
          distinct: ["date"],
          orderBy: { date: "asc" },
          take: 7,
        });
        for (const fp of futurePlans) {
          await prisma.userDailyPlan.upsert({
            where: { userId_date_exerciseId: { userId, date: fp.date, exerciseId } },
            update: {},
            create: {
              userId, programId: enrollment.programId, date: fp.date,
              dayType: "custom", exerciseId, category,
              sortOrder: 999, rx: defaultRx, isManual: true,
            },
          });
        }
      }

      return JSON.stringify({ ok: true, created: { id: exercise.id, name: exercise.name, category, targets, defaultRx } });
    }
    case "create_custom_supplement": {
      const name = input.name as string;
      const time = input.time as string;
      const timeGroup = input.time_group as string;

      if (!["am", "mid", "pm"].includes(timeGroup)) {
        return JSON.stringify({ error: "time_group must be am, mid, or pm" });
      }

      // Reject suspicious names
      const suspiciousSuppPatterns = /\b(weapon|gun|knife|sword|drug|cocaine|meth|heroin|alcohol|beer|wine|pizza|burger|taco|joke|prank|trick|steroid|anabolic)\b/i;
      if (suspiciousSuppPatterns.test(name)) {
        return JSON.stringify({ error: `"${name}" doesn't sound like a legitimate supplement! Let's keep your supplement stack focused on joint health and recovery.` });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const supplementId = `custom-${slug}`;

      const existingSupp = await prisma.supplement.findUnique({ where: { id: supplementId } });
      if (existingSupp) {
        // Just add it to user's supplements if it already exists
        await prisma.userSupplement.upsert({
          where: { userId_supplementId: { userId, supplementId } },
          update: { timeGroup },
          create: { userId, supplementId, timeGroup },
        });
        return JSON.stringify({ ok: true, added: { id: existingSupp.id, name: existingSupp.name } });
      }

      const supplement = await prisma.supplement.create({
        data: { id: supplementId, name, dose: null, time, timeGroup },
      });

      await prisma.userSupplement.upsert({
        where: { userId_supplementId: { userId, supplementId } },
        update: { timeGroup },
        create: { userId, supplementId, timeGroup },
      });

      return JSON.stringify({ ok: true, created: { id: supplement.id, name: supplement.name, time, timeGroup } });
    }
    case "update_training_days": {
      const days = input.days_per_week as number;
      await prisma.userPreferences.update({ where: { userId }, data: { daysPerWeek: days } });
      return JSON.stringify({ ok: true, daysPerWeek: days });
    }
    case "finalize_onboarding": {
      const notes = input.profile_notes as string;
      await prisma.userPreferences.update({
        where: { userId },
        data: { profileNotes: notes, onboardingStep: 1 },
      });
      return JSON.stringify({ ok: true });
    }
    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

async function buildSystemPrompt(userId: number): Promise<string> {
  const today = todayPacific();
  const [user, prefs, enrollment, todayPlan, supplements, sessionLogs, milestones] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.userEnrollment.findFirst({ where: { userId, status: "active" }, include: { program: true } }),
    prisma.userDailyPlan.findMany({
      where: { userId, date: today },
      include: { exercise: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.userSupplement.findMany({ where: { userId }, include: { supplement: true } }),
    prisma.sessionLog.findMany({
      where: { userId, date: { gte: addDays(today, -7) } },
      orderBy: { date: "desc" },
    }),
    prisma.userMilestone.findMany({ where: { userId }, include: { milestone: true } }),
  ]);

  const todayExercises = todayPlan.map((p) => {
    const checked = false; // completion status would come from checks
    return `- ${checked ? "[DONE]" : "[ ]"} ${p.exercise.name} (${p.category}) — ${p.rx || "no rx"}`;
  }).join("\n");
  const suppList = supplements.map((s) => `- ${s.supplement.name} (${s.timeGroup})`).join("\n");
  const recentSessions = sessionLogs.map((s) => `- ${formatDate(s.date)}: ${s.stepsDone}/${s.stepsTotal}`).join("\n");
  const milestoneList = milestones.map((m) => `- ${m.milestone.name}: ${m.done ? "DONE" : "not yet"}`).join("\n");

  // Calculate current week and phase from enrollment start date
  let weekNumber = 1;
  let phase = "Phase 1 Foundation";
  if (enrollment) {
    const startMs = new Date(enrollment.startDate).getTime();
    const todayMs = today.getTime();
    const daysSinceStart = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
    weekNumber = Math.max(1, Math.floor(daysSinceStart / 7) + 1);
    if (weekNumber <= 2) {
      phase = "Phase 1 Foundation";
    } else {
      phase = "Phase 2 Progression";
    }
  }

  return `## Personality
You are a warm, funny, encouraging mobility coach. Use 2-4 short paragraphs max (mobile users). Joint/mobility humor is welcome. Always celebrate progress.

## Scope
You are a mobility and joint health coach ONLY. Politely deflect off-topic requests with: "I'm your mobility coach and can only help with your joint workout program." Never diagnose injuries or act as a doctor/PT. Never invent exercises not in the system.

## Safety Rules for Custom Items
When creating custom exercises, only allow categories: warmup_tool, mobility, recovery_tool. Reject strength exercises, weapons, illegal substances, food items, joke items with friendly humor. When creating custom supplements, only allow legitimate health supplements — reject drugs, alcohol, food items, and joke items.

## User Context
User: ${user?.username}
Program: ${enrollment?.program.name || "None"}
Week ${weekNumber} — ${phase}
Day: ${formatDate(today)}
Profile notes: ${prefs?.profileNotes || "No profile yet"}
Training days/week: ${prefs?.daysPerWeek || 5}

## Today's Exercises
${todayExercises || "None planned"}

## Active Supplements
${suppList || "None"}

## Last 7 Days Sessions
${recentSessions || "No sessions logged"}

## Milestones
${milestoneList || "None tracked"}

## Tool Usage
Use tools to modify the user's plan when they ask. You can create custom exercises and supplements using the create tools if the user requests something not in the catalog.`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!checkRateLimit(session.userId)) {
    return NextResponse.json({ error: "Daily message limit reached. Try again tomorrow!" }, { status: 429 });
  }

  const { messages } = await req.json();
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const systemPrompt = await buildSystemPrompt(session.userId);

  let currentMessages = [...messages];
  let response: Anthropic.Message;

  // Tool use loop (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason !== "tool_use") {
      const textContent = response.content.find((c) => c.type === "text");
      return NextResponse.json({ reply: textContent?.text || "" });
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter((c) => c.type === "tool_use");
    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type !== "tool_use") continue;
      const result = await handleToolCall(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        session.userId
      );
      toolResults.push({
        type: "tool_result" as const,
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content: response.content },
      { role: "user" as const, content: toolResults },
    ];
  }

  // If we exhausted iterations, return whatever we have
  return NextResponse.json({ reply: "I've completed the requested changes to your plan." });
}
