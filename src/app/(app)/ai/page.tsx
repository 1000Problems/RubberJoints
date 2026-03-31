"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Stats {
  exercisesDone: number;
  exercisesTotal: number;
  supplementsDone: number;
  supplementsTotal: number;
}

interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  targets?: string;
}

interface SupplementItem {
  id: string;
  name: string;
  dose?: string;
  time?: string;
  timeGroup: string;
}

const JOKES = [
  "My joints just filed for workers' compensation.",
  "These knees have more cracks than a comedy show.",
  "I didn't choose the mobility life. My chiropractor did.",
  "My spine just sent me a strongly worded letter.",
  "Flexibility goal: touch my toes without narrating the journey.",
  "My hip flexors are tighter than my schedule.",
  "I stretch therefore I am... slightly less stiff.",
  "My joints sound like a bowl of Rice Krispies.",
  "Plot twist: the foam roller is the real workout.",
  "My mobility routine has more steps than my skincare.",
  "I'm not old, I'm just... acoustically gifted. *crack*",
  "My knees predict weather better than meteorologists.",
  "Squatting to the floor shouldn't feel like a trust fall.",
  "My hips don't lie. They say 'we need help.'",
  "I used to be flexible. Then I turned 25.",
  "My joints have entered their protest era.",
  "Deep squat? More like deep existential crisis.",
  "I'm one sneeze away from throwing out my back.",
  "My body makes sounds that aren't in any medical textbook.",
  "Recovery day = the only day my joints don't roast me.",
];

/* ── Picker Grid Component ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PickerGrid({
  items,
  selected,
  onToggle,
  labelKey,
  subKey,
  onConfirm,
}: {
  items: Record<string, any>[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  labelKey: string;
  subKey: string;
  onConfirm: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              style={{
                position: "relative",
                border: `2px solid ${isSelected ? "var(--acc)" : "var(--brd)"}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: isSelected ? "rgba(74,108,247,0.08)" : "var(--s1)",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {isSelected && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--grn, #22c55e)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              )}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--tx)",
                  lineHeight: 1.3,
                  paddingRight: isSelected ? 20 : 0,
                }}
              >
                {item[labelKey] as string}
              </div>
              {item[subKey] ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--tx3)",
                    marginTop: 3,
                    lineHeight: 1.3,
                  }}
                >
                  {String(item[subKey])}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        onClick={onConfirm}
        style={{
          width: "100%",
          padding: 12,
          background: "var(--acc)",
          color: "white",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Confirm ({selected.size} selected)
      </button>
    </div>
  );
}

export default function AIPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}><div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div></div>}>
      <AIPage />
    </Suspense>
  );
}

function AIPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jokeIndex, setJokeIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoPromptSent = useRef(false);

  // ── Personalize state ──
  const [personalizeStep, setPersonalizeStep] = useState<number | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [warmupExercises, setWarmupExercises] = useState<ExerciseItem[]>([]);
  const [mobilityExercises, setMobilityExercises] = useState<ExerciseItem[]>([]);
  const [recoveryExercises, setRecoveryExercises] = useState<ExerciseItem[]>([]);
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);
  const [selectedWarmup, setSelectedWarmup] = useState<Set<string>>(new Set());
  const [selectedMobility, setSelectedMobility] = useState<Set<string>>(new Set());
  const [selectedRecovery, setSelectedRecovery] = useState<Set<string>>(new Set());
  const [selectedSupplements, setSelectedSupplements] = useState<Set<string>>(new Set());
  const [personalizeLoading, setPersonalizeLoading] = useState(false);
  const [onboardingFinalized, setOnboardingFinalized] = useState(false);

  // Week/phase info (static for now, could be fetched)
  const currentWeek = 1;
  const totalWeeks = 4;
  const phaseName = "Foundation";
  const weekProgress = currentWeek / totalWeeks;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, personalizeStep]);

  useEffect(() => {
    // Pick a random joke on mount
    setJokeIndex(Math.floor(Math.random() * JOKES.length));
  }, []);

  useEffect(() => {
    // Fetch stats
    fetch("/api/ai/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {});
  }, []);

  // Auto-send prompt from ?prompt= query parameter
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && !autoPromptSent.current && !loading) {
      autoPromptSent.current = true;
      sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        const reply = data.reply;
        setMessages([...newMessages, { role: "assistant", content: reply }]);

        // Check if finalize_onboarding was called (the AI mentions profile saved or similar)
        // We detect this by checking if the reply indicates the profile was captured
        if (personalizeStep === 1 && !onboardingFinalized) {
          // The AI chat endpoint handles finalize_onboarding internally.
          // We check for keywords indicating the profile was saved.
          const finalizePhrases = [
            "profile", "saved", "noted", "recorded", "captured",
            "got it", "ready to", "let's move", "next step",
            "personali", "summar",
          ];
          const lower = reply.toLowerCase();
          if (finalizePhrases.some((p) => lower.includes(p))) {
            setOnboardingFinalized(true);
          }
        }
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch exercises by category
  const fetchExercises = useCallback(async (category: string): Promise<ExerciseItem[]> => {
    try {
      const res = await fetch(`/api/exercises?category=${category}`);
      const data = await res.json();
      return data.exercises || [];
    } catch {
      return [];
    }
  }, []);

  // Fetch all supplements
  const fetchSupplements = useCallback(async (): Promise<SupplementItem[]> => {
    try {
      const res = await fetch("/api/supplements?all=true");
      const data = await res.json();
      return data.supplements || [];
    } catch {
      return [];
    }
  }, []);

  // Start personalization step 1 (AI questionnaire)
  async function startQuestionnaire() {
    setPersonalizeStep(1);
    await sendMessage(
      "I want to personalize my plan. Ask me about my goals, problem areas, activity level, equipment access, how many days per week I want to train, and any injuries or cautions. Ask ONE question at a time."
    );
  }

  // Handle picking quick start vs customize
  async function handleQuickStart() {
    setPersonalizeLoading(true);
    try {
      // Fetch all exercises
      const [w, m, r] = await Promise.all([
        fetchExercises("warmup_tool"),
        fetchExercises("mobility"),
        fetchExercises("recovery_tool"),
      ]);
      const allExerciseIds = [...w, ...m, ...r].map((e) => e.id);

      await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedExercises: allExerciseIds,
          selectedSupplements: [],
          daysPerWeek,
        }),
      });
      setPersonalizeStep(7);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  async function handleCustomize() {
    setPersonalizeLoading(true);
    try {
      const exercises = await fetchExercises("warmup_tool");
      setWarmupExercises(exercises);
      setSelectedWarmup(new Set(exercises.map((e) => e.id)));
      setPersonalizeStep(3);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  async function confirmWarmup() {
    setPersonalizeLoading(true);
    try {
      const exercises = await fetchExercises("mobility");
      setMobilityExercises(exercises);
      setSelectedMobility(new Set(exercises.map((e) => e.id)));
      setPersonalizeStep(4);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  async function confirmMobility() {
    setPersonalizeLoading(true);
    try {
      const exercises = await fetchExercises("recovery_tool");
      setRecoveryExercises(exercises);
      setSelectedRecovery(new Set(exercises.map((e) => e.id)));
      setPersonalizeStep(5);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  async function confirmRecovery() {
    setPersonalizeLoading(true);
    try {
      const supps = await fetchSupplements();
      setSupplements(supps);
      setSelectedSupplements(new Set()); // all OFF by default
      setPersonalizeStep(6);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  async function confirmSupplements() {
    setPersonalizeLoading(true);
    try {
      const allSelected = [
        ...Array.from(selectedWarmup),
        ...Array.from(selectedMobility),
        ...Array.from(selectedRecovery),
      ];
      await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedExercises: allSelected,
          selectedSupplements: Array.from(selectedSupplements),
          daysPerWeek,
        }),
      });
      setPersonalizeStep(7);
    } catch {
      // ignore
    } finally {
      setPersonalizeLoading(false);
    }
  }

  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string
  ) {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setter(next);
  }

  const chips: { label: string; prompt: string }[] = [
    { label: "My status", prompt: "My status" },
    { label: "Today's focus", prompt: "Today's focus" },
    { label: "Weekly progress", prompt: "Weekly progress" },
    { label: "+ Add to plan", prompt: "I'd like to add something new to my plan — a tool, exercise, or supplement I have access to that isn't currently in my program." },
  ];

  // Whether we're in personalize mode
  const isPersonalizing = personalizeStep !== null;

  /* ── Render Personalize Step UI ── */
  function renderPersonalizeStep() {
    if (personalizeStep === null) return null;

    // Step 0: Welcome
    if (personalizeStep === 0) {
      return (
        <div
          style={{
            background: "var(--s2)",
            border: "1px solid var(--s3)",
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 8px",
            }}
          >
            Let&apos;s customize your plan!
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--tx2)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            I&apos;ll ask you a few questions, then you can pick your exercises
            and supplements.
          </p>
          <button
            onClick={startQuestionnaire}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "14px 32px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Let&apos;s Go
          </button>
        </div>
      );
    }

    // Step 1: AI conversation (rendered as normal messages above)
    // Show "Continue" button when onboarding finalized
    if (personalizeStep === 1) {
      if (onboardingFinalized) {
        return (
          <div
            style={{
              background: "var(--s2)",
              border: "1px solid var(--s3)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--tx2)",
                margin: "0 0 12px",
              }}
            >
              Profile captured! Ready to select your exercises.
            </p>
            <button
              onClick={() => setPersonalizeStep(2)}
              style={{
                background: "var(--acc)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue to exercise selection
            </button>
          </div>
        );
      }
      return null; // Chat is ongoing, no extra UI
    }

    // Step 2: Quick Start vs Customize + days selector
    if (personalizeStep === 2) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h3
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--tx)",
              margin: 0,
              textAlign: "center",
            }}
          >
            How do you want to set up?
          </h3>

          {/* Days per week */}
          <div
            style={{
              background: "var(--s2)",
              border: "1px solid var(--s3)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--tx)",
                margin: "0 0 10px",
              }}
            >
              Training days per week
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {[2, 3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => setDaysPerWeek(d)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: `2px solid ${daysPerWeek === d ? "var(--acc)" : "var(--brd)"}`,
                    background:
                      daysPerWeek === d
                        ? "rgba(74,108,247,0.1)"
                        : "var(--s1)",
                    color:
                      daysPerWeek === d ? "var(--acc)" : "var(--tx)",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Choice cards */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleQuickStart}
              disabled={personalizeLoading}
              style={{
                flex: 1,
                background: "var(--s2)",
                border: "2px solid var(--s3)",
                borderRadius: 14,
                padding: 20,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 8,
                }}
              >
                ⚡
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--tx)",
                  marginBottom: 4,
                }}
              >
                Quick Start
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--tx3)",
                  lineHeight: 1.4,
                }}
              >
                Use all exercises, generate plan now
              </div>
            </button>

            <button
              onClick={handleCustomize}
              disabled={personalizeLoading}
              style={{
                flex: 1,
                background: "var(--s2)",
                border: "2px solid var(--acc)",
                borderRadius: 14,
                padding: 20,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 8,
                }}
              >
                🎯
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--tx)",
                  marginBottom: 4,
                }}
              >
                Customize First
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--tx3)",
                  lineHeight: 1.4,
                }}
              >
                Pick exercises per category
              </div>
            </button>
          </div>

          {personalizeLoading && (
            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--tx3)",
              }}
            >
              Setting up...
            </p>
          )}
        </div>
      );
    }

    // Steps 3-5: Exercise pickers
    if (personalizeStep === 3) {
      return (
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 4px",
            }}
          >
            Warm-Up Tools
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--tx3)",
              margin: "0 0 14px",
            }}
          >
            All selected by default. Tap to remove any you don&apos;t want.
          </p>
          <PickerGrid
            items={warmupExercises}
            selected={selectedWarmup}
            onToggle={(id) => toggleSet(selectedWarmup, setSelectedWarmup, id)}
            labelKey="name"
            subKey="targets"
            onConfirm={confirmWarmup}
          />
        </div>
      );
    }

    if (personalizeStep === 4) {
      return (
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 4px",
            }}
          >
            Mobility Exercises
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--tx3)",
              margin: "0 0 14px",
            }}
          >
            All selected by default. Tap to remove any you don&apos;t want.
          </p>
          <PickerGrid
            items={mobilityExercises}
            selected={selectedMobility}
            onToggle={(id) =>
              toggleSet(selectedMobility, setSelectedMobility, id)
            }
            labelKey="name"
            subKey="targets"
            onConfirm={confirmMobility}
          />
        </div>
      );
    }

    if (personalizeStep === 5) {
      return (
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 4px",
            }}
          >
            Recovery Tools
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--tx3)",
              margin: "0 0 14px",
            }}
          >
            All selected by default. Tap to remove any you don&apos;t want.
          </p>
          <PickerGrid
            items={recoveryExercises}
            selected={selectedRecovery}
            onToggle={(id) =>
              toggleSet(selectedRecovery, setSelectedRecovery, id)
            }
            labelKey="name"
            subKey="targets"
            onConfirm={confirmRecovery}
          />
        </div>
      );
    }

    // Step 6: Supplement picker
    if (personalizeStep === 6) {
      return (
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 4px",
            }}
          >
            Supplements
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--tx3)",
              margin: "0 0 14px",
            }}
          >
            None selected by default. Tap to add any you take.
          </p>
          <PickerGrid
            items={supplements}
            selected={selectedSupplements}
            onToggle={(id) =>
              toggleSet(selectedSupplements, setSelectedSupplements, id)
            }
            labelKey="name"
            subKey="dose"
            onConfirm={confirmSupplements}
          />
          {personalizeLoading && (
            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--tx3)",
                marginTop: 8,
              }}
            >
              Saving your plan...
            </p>
          )}
        </div>
      );
    }

    // Step 7: Complete
    if (personalizeStep === 7) {
      return (
        <div
          style={{
            background: "var(--s2)",
            border: "1px solid var(--s3)",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--tx)",
              margin: "0 0 8px",
            }}
          >
            Your plan is ready!
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--tx2)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Your personalized mobility program has been generated. Time to get
            moving!
          </p>
          <Link
            href="/workout"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "14px 32px",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
            }}
            onClick={() => setPersonalizeStep(null)}
          >
            Start Training
          </Link>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--s1)" }}>
      {/* ── Combined Top Bar ── */}
      <div
        className="flex items-center px-3 py-2.5 gap-3"
        style={{
          background: "var(--s1)",
          borderBottom: "1px solid var(--s3)",
        }}
      >
        {/* Hamburger menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col justify-center items-center w-9 h-9 shrink-0"
          style={{ gap: "4px" }}
          aria-label="Open sidebar"
        >
          <span style={{ display: "block", width: 20, height: 2, background: "var(--tx)", borderRadius: 1 }} />
          <span style={{ display: "block", width: 20, height: 2, background: "var(--tx)", borderRadius: 1 }} />
          <span style={{ display: "block", width: 20, height: 2, background: "var(--tx)", borderRadius: 1 }} />
        </button>

        {/* Center: Week + progress */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[13px] font-semibold" style={{ color: "var(--tx)" }}>
            Week {currentWeek} of {totalWeeks}
          </span>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 3, background: "var(--s3)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${weekProgress * 100}%`,
                background: "var(--grn)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Right: Phase badge */}
        <div
          className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{
            background: "rgba(74, 108, 247, 0.1)",
            color: "var(--acc)",
          }}
        >
          {phaseName}
        </div>
      </div>

      {/* ── START TRAINING Button ── */}
      <Link
        href="/workout"
        className="flex items-center justify-center gap-2 py-3 text-center no-underline"
        style={{
          background: "var(--acc)",
          color: "white",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "1.5px",
        }}
      >
        <span>🔥</span>
        <span>START TRAINING</span>
        <span>💪</span>
      </Link>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ background: "var(--s1)" }}>
        {messages.length === 0 && !isPersonalizing && (
          <div className="flex flex-col gap-3">
            {/* Joke Card */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "#fffbf0",
                border: "1px solid #f0e8d8",
              }}
            >
              <p className="text-[13px] leading-relaxed italic m-0" style={{ color: "var(--tx2)" }} suppressHydrationWarning>
                &ldquo;{JOKES[jokeIndex]}&rdquo;
              </p>
              <p className="text-[11px] mt-1.5 mb-0" style={{ color: "var(--tx3)" }}>
                -- Your joints, probably
              </p>
            </div>

            {/* Info Card */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--s2)",
                border: "1px solid var(--s3)",
              }}
            >
              {stats ? (
                <p className="text-[13px] m-0 font-medium" style={{ color: "var(--tx)" }}>
                  {stats.exercisesDone}/{stats.exercisesTotal} exercises &middot;{" "}
                  {stats.supplementsDone}/{stats.supplementsTotal} supplements
                </p>
              ) : (
                <p className="text-[13px] m-0 font-medium" style={{ color: "var(--tx3)" }}>
                  Loading stats...
                </p>
              )}
              <p className="text-[12px] mt-1.5 mb-0" style={{ color: "var(--tx3)" }}>
                Check Progress tab to track your journey
              </p>
            </div>

            {/* AI Avatar + intro */}
            <div className="flex flex-col items-center text-center px-4 pt-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <h2 className="text-[17px] font-bold mb-1" style={{ color: "var(--tx)" }}>
                Your Mobility Coach
              </h2>
              <p className="text-[13px] mb-4" style={{ color: "var(--tx3)" }}>
                Ask me about your exercises, supplements, or plan
              </p>

              {/* ── Personalize Plan Button ── */}
              <button
                onClick={() => setPersonalizeStep(0)}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 16,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                }}
              >
                Personalize Plan
              </button>

              {/* Chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => sendMessage(chip.prompt)}
                    className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
                    style={{
                      background: chip.label.startsWith("+") ? "rgba(74,108,247,0.06)" : "var(--s1)",
                      border: `1px solid ${chip.label.startsWith("+") ? "var(--acc)" : "var(--brd)"}`,
                      color: chip.label.startsWith("+") ? "var(--acc)" : "var(--tx)",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Personalization flow UI before messages (step 0 welcome, steps 2+ when no chat yet) */}
        {isPersonalizing && personalizeStep !== 1 && messages.length === 0 && (
          <div style={{ marginBottom: 16 }}>{renderPersonalizeStep()}</div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="flex gap-2 mb-3"
            style={{
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {msg.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
            )}
            <div
              className="max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed"
              style={{
                background: msg.role === "user" ? "var(--acc)" : "var(--s1)",
                color: msg.role === "user" ? "white" : "var(--tx)",
                border: msg.role === "assistant" ? "1px solid var(--s3)" : "none",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              }}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {/* Personalization UI after messages (step 1 continue button, or picker steps after chat) */}
        {isPersonalizing && messages.length > 0 && (
          <div style={{ marginTop: 8 }}>{renderPersonalizeStep()}</div>
        )}

        {loading && (
          <div className="flex gap-2 mb-3" style={{ animation: "fadeIn 0.3s ease" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div
              className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
              style={{ background: "var(--s1)", border: "1px solid var(--s3)" }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[7px] h-[7px] rounded-full"
                  style={{
                    background: "var(--tx3)",
                    animation: `aiBounce 1.4s infinite ease-in-out ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chips bar (when messages exist and not in picker steps) */}
      {messages.length > 0 && (!isPersonalizing || personalizeStep === 1) && (
        <div
          className="flex gap-1.5 px-3 py-2 overflow-x-auto"
          style={{
            background: "var(--bg)",
            borderTop: "1px solid var(--s3)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
              style={{
                background: chip.label.startsWith("+") ? "rgba(74,108,247,0.06)" : "var(--s1)",
                border: `1px solid ${chip.label.startsWith("+") ? "var(--acc)" : "var(--brd)"}`,
                color: chip.label.startsWith("+") ? "var(--acc)" : "var(--tx)",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      <div
        className="px-3 pt-2 pb-1"
        style={{
          background: "var(--bg)",
          borderTop: messages.length === 0 && !isPersonalizing ? "1px solid var(--s3)" : "none",
        }}
      >
        <div
          className="flex items-end gap-2 rounded-[20px] px-4 py-1.5"
          style={{ background: "var(--s1)", border: "1px solid var(--brd)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask your coach..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] leading-[1.4] py-1.5"
            style={{ color: "var(--tx)", maxHeight: "120px" }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-all duration-150"
            style={{
              background: loading || !input.trim() ? "var(--s3)" : "var(--acc)",
              color: loading || !input.trim() ? "var(--tx3)" : "white",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        {/* Disclaimer */}
        <div
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 mt-1.5 mb-1"
          style={{
            background: "#fff8e1",
            border: "1px solid #ffe082",
          }}
        >
          <span style={{ color: "#e65100", fontSize: 13, lineHeight: 1 }}>&#9888;</span>
          <span className="text-[11px]" style={{ color: "#8d6e00" }}>
            Not medical advice. Always consult a professional.
          </span>
        </div>
      </div>

      {/* ── Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 280,
          background: "var(--s1)",
          borderRight: "1px solid var(--s3)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--s3)" }}
        >
          <h3 className="text-[16px] font-bold m-0" style={{ color: "var(--tx)" }}>
            Chats
          </h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--s2)", color: "var(--tx2)" }}
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 py-3">
          <button
            onClick={() => {
              setMessages([]);
              setInput("");
              setPersonalizeStep(null);
              setOnboardingFinalized(false);
              setSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150"
            style={{
              background: "var(--acc)",
              color: "white",
              border: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Chat history list */}
        <div className="flex-1 overflow-y-auto px-3">
          <p className="text-[12px] text-center py-8" style={{ color: "var(--tx3)" }}>
            No chat history yet
          </p>
        </div>
      </div>
    </div>
  );
}
