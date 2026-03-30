import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific, formatDate, addDays } from "@/lib/dates";

const anthropic = new Anthropic();

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

  const todayExercises = todayPlan.map((p) => `- ${p.exercise.name} (${p.category}) — ${p.rx || "no rx"}`).join("\n");
  const suppList = supplements.map((s) => `- ${s.supplement.name} (${s.timeGroup})`).join("\n");
  const recentSessions = sessionLogs.map((s) => `- ${formatDate(s.date)}: ${s.stepsDone}/${s.stepsTotal}`).join("\n");
  const milestoneList = milestones.map((m) => `- ${m.milestone.name}: ${m.done ? "DONE" : "not yet"}`).join("\n");

  return `You are a friendly AI mobility coach for the RubberJoints app. You help users with joint health, mobility, and recovery.

User: ${user?.username}
Program: ${enrollment?.program.name || "None"}
Day: ${formatDate(today)}
Profile: ${prefs?.profileNotes || "No profile yet"}
Days/week: ${prefs?.daysPerWeek || 5}

Today's exercises:
${todayExercises || "None planned"}

Active supplements:
${suppList || "None"}

Last 7 days sessions:
${recentSessions || "No sessions logged"}

Milestones:
${milestoneList || "None tracked"}

Rules:
- Only recommend exercises from the catalog (warmup_tool, mobility, recovery_tool categories)
- Never add strength training, cardio, or weapon-related exercises
- Never add illegal substances, food items, or non-supplement items
- Keep responses concise and encouraging
- Use tools to modify the user's plan when they ask`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
