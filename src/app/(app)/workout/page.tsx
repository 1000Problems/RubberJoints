"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/* ── Types ── */

interface PlanItem {
  id: number;
  exerciseId: string;
  category: string;
  sortOrder: number;
  rx: string | null;
  exercise: {
    id: string;
    name: string;
    category: string;
    targets: string | null;
    description: string | null;
    cues: string | null;
    warning: string | null;
    defaultRx: string | null;
  };
}

interface SupplementItem {
  id: number;
  supplementId: string;
  timeGroup: string;
  supplement: {
    id: string;
    name: string;
    dose: string | null;
    time: string | null;
  };
}

interface WeekDay {
  date: string;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
}

interface CheckState {
  [key: string]: boolean;
}

interface PickerExercise {
  id: string;
  name: string;
  category: string;
  targets: string | null;
  defaultRx: string | null;
}

interface PickerSupplement {
  id: string;
  name: string;
  dose: string | null;
  timeGroup: string;
}

/* ── Constants ── */

const categoryColors: Record<string, string> = {
  warmup_tool: "#ff9500",
  mobility: "#34c759",
  recovery_tool: "#4a6cf7",
};

const categoryLabels: Record<string, string> = {
  warmup_tool: "Warm-up",
  mobility: "Mobility",
  recovery_tool: "Recovery",
};

const suppGroupLabels: Record<string, string> = {
  am: "MORNING",
  mid: "MIDDAY",
  pm: "EVENING",
};

const CATEGORIES = ["warmup_tool", "mobility", "recovery_tool"];

/* ── Component ── */

interface DayData {
  plan: PlanItem[];
  checks: CheckState;
  dayType: string;
  dayLabel: string;
  isFuture: boolean;
}

export default function WorkoutPage() {
  const router = useRouter();
  const [allDays, setAllDays] = useState<Record<string, DayData>>({});
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [username, setUsername] = useState("");

  // Derived from allDays for the selected date
  const currentDay = allDays[date];
  const plan = currentDay?.plan || [];
  const checks = currentDay?.checks || {};
  const dayLabel = currentDay?.dayLabel || "";
  const isFuture = currentDay?.isFuture || false;

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<"exercise" | "supplement">("exercise");
  const [pickerCategory, setPickerCategory] = useState("");
  const [pickerTimeGroup, setPickerTimeGroup] = useState("");
  const [pickerItems, setPickerItems] = useState<(PickerExercise | PickerSupplement)[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Swipe refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Track which week is loaded to avoid re-fetching within same week
  const loadedWeekMonday = useRef("");

  const loadWeek = useCallback(async (targetDate: string) => {
    // Calculate Monday for this date
    const d = new Date(targetDate + "T00:00:00Z");
    const day = d.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setUTCDate(mon.getUTCDate() + mondayOffset);
    const mondayStr = mon.toISOString().split("T")[0];

    // Skip fetch if this week is already loaded
    if (mondayStr === loadedWeekMonday.current) return;

    setLoading(Object.keys(allDays).length === 0);
    try {
      const res = await fetch(`/api/workout?date=${targetDate}`);
      const data = await res.json();
      setAllDays(data.days || {});
      setSupplements(data.supplements || []);
      setWeekDays(data.weekDays || []);
      loadedWeekMonday.current = mondayStr;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [allDays]);

  useEffect(() => {
    loadWeek(date);
  }, [date, loadWeek]);

  // Fetch username
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.username) setUsername(data.user.username);
      })
      .catch(() => {});
  }, []);

  // Session auto-logging: log progress when leaving the page
  const logSession = useCallback(() => {
    const stepsTotal = plan.length;
    if (stepsTotal === 0) return;
    const stepsDone = plan.filter((p) => checks[`step:${p.exerciseId}:0`]).length;
    const payload = JSON.stringify({ stepsDone, stepsTotal });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/session", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, [plan, checks]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        logSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Also log on unmount
      logSession();
    };
  }, [logSession]);

  // Swipe gestures
  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
    function handleTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (Math.abs(dx) > 80 && dy < 100) {
        if (dx > 0) changeDay(-1);
        else changeDay(1);
      }
    }
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function updateChecksForDate(dateKey: string, checkKey: string, value: boolean) {
    setAllDays((prev) => {
      const day = prev[dateKey];
      if (!day) return prev;
      return { ...prev, [dateKey]: { ...day, checks: { ...day.checks, [checkKey]: value } } };
    });
  }

  async function toggleCheck(itemType: string, itemId: string, stepIndex: number) {
    const key = `${itemType}:${itemId}:${stepIndex}`;
    const newChecked = !checks[key];
    updateChecksForDate(date, key, newChecked);
    try {
      await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, itemType, itemId, stepIndex, checked: newChecked }),
      });
    } catch {
      updateChecksForDate(date, key, !newChecked);
    }
  }

  function changeDay(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  }

  function getCategoryProgress(cat: string) {
    const items = plan.filter((p) => p.category === cat);
    if (items.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = items.filter((p) => checks[`step:${p.exerciseId}:0`]).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }

  function getSuppProgress() {
    if (supplements.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = supplements.filter((s) => checks[`supplement:${s.supplementId}:0`]).length;
    return { done, total: supplements.length, pct: Math.round((done / supplements.length) * 100) };
  }

  const todayPST = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const isToday = date === todayPST;

  function getDayDisplayLabel() {
    if (isToday) return "Today";
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  function getCardTitle() {
    if (isToday) return "TODAY'S WORKOUT";
    const d = new Date(date + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
  }

  // Picker helpers
  async function openExercisePicker(category: string) {
    setPickerType("exercise");
    setPickerCategory(category);
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/exercises?category=${category}`);
      const data = await res.json();
      setPickerItems(data.exercises || []);
    } catch {
      setPickerItems([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function openSupplementPicker(timeGroup: string) {
    setPickerType("supplement");
    setPickerTimeGroup(timeGroup);
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/supplements?timeGroup=${timeGroup}`);
      const data = await res.json();
      setPickerItems(data.supplements || []);
    } catch {
      setPickerItems([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function reloadWeek() {
    loadedWeekMonday.current = ""; // force re-fetch
    await loadWeek(date);
  }

  async function selectExercise(exerciseId: string) {
    setPickerOpen(false);
    try {
      await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, date }),
      });
      await reloadWeek();
    } catch {
      // ignore
    }
  }

  async function selectSupplement(supplementId: string, timeGroup: string) {
    setPickerOpen(false);
    try {
      await fetch("/api/supplements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplementId, timeGroup }),
      });
      await reloadWeek();
    } catch {
      // ignore
    }
  }

  async function removeExercise(exerciseId: string) {
    try {
      await fetch("/api/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
      await reloadWeek();
    } catch {
      // ignore
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
  }

  if (loading && Object.keys(allDays).length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div>
      </div>
    );
  }

  const suppProgress = getSuppProgress();
  const existingExerciseIds = new Set(plan.map((p) => p.exerciseId));

  // Progress bars data
  const progressRows: { key: string; label: string; color: string; done: number; total: number; pct: number }[] = [];
  for (const cat of CATEGORIES) {
    const prog = getCategoryProgress(cat);
    progressRows.push({ key: cat, label: categoryLabels[cat], color: categoryColors[cat], ...prog });
  }
  // Always show Vitamins row (even if 0/0)
  progressRows.push({ key: "vitamins", label: "Vitamins", color: "#ffcc00", ...suppProgress });

  return (
    <div>
      {/* ── 0. Username / Sign out bar ── */}
      {username && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 0",
            fontSize: "0.8rem",
            color: "var(--tx2)",
          }}
        >
          <span>{username}</span>
          <button
            onClick={handleSignOut}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "0.8rem",
              color: "var(--tx2)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sign out
          </button>
        </div>
      )}

      {/* ── 1. Day Navigation ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
        }}
      >
        <button
          onClick={() => changeDay(-1)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "var(--s1)",
            border: "1px solid var(--brd)",
            color: "var(--tx)",
            fontSize: "22px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          &#8249;
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--tx)" }}>
            {getDayDisplayLabel()}
          </div>
          {!isToday && (
            <button
              onClick={() => setDate(todayPST)}
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--acc)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginTop: "2px",
              }}
            >
              Back to Today
            </button>
          )}
        </div>
        <button
          onClick={() => changeDay(1)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "var(--s1)",
            border: "1px solid var(--brd)",
            color: "var(--tx)",
            fontSize: "22px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          &#8250;
        </button>
      </div>

      {/* Future notice removed — PREVIEW badge is inline in activity card */}

      {/* ── 2. Activity Summary Card ── */}
      <div
        style={{
          background: "var(--s1)",
          borderRadius: "16px",
          border: "1px solid var(--brd)",
          padding: "16px",
          margin: "16px 16px 12px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--tx3)",
            marginBottom: "4px",
          }}
        >
          {getCardTitle()}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "var(--tx2)",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>{dayLabel}</span>
          {isFuture && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--org)",
                background: "rgba(255,149,0,0.12)",
                padding: "2px 6px",
                borderRadius: "4px",
                textTransform: "uppercase",
              }}
            >
              Preview
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {progressRows.map((row) => (
            <div key={row.key} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: row.color,
                  marginRight: "8px",
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  width: "80px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--tx)",
                  flexShrink: 0,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  flex: 1,
                  height: "10px",
                  background: "var(--s3)",
                  borderRadius: "5px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${row.pct}%`,
                    background: row.color,
                    borderRadius: "5px",
                    transition: "width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                />
              </div>
              <div
                style={{
                  width: "36px",
                  textAlign: "right",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--tx2)",
                  flexShrink: 0,
                }}
              >
                {row.done}/{row.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Weekly Calendar Strip ── */}
      {weekDays.length > 0 && (
        <div
          style={{
            background: "var(--s1)",
            borderRadius: "16px",
            border: "1px solid var(--brd)",
            padding: "12px 8px",
            margin: "0 16px 16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {weekDays.map((wd) => {
              const selected = wd.date === date;
              const isHighlighted = wd.isToday || selected;
              let bg = "transparent";
              let labelColor = "var(--tx3)";
              let numColor = "var(--tx)";
              let opacity = 1;

              if (wd.isToday && selected) {
                bg = "#34c759";
                labelColor = "#ffffff";
                numColor = "#ffffff";
              } else if (wd.isToday) {
                bg = "#34c759";
                labelColor = "#ffffff";
                numColor = "#ffffff";
              } else if (selected) {
                bg = "var(--acc)";
                labelColor = "#ffffff";
                numColor = "#ffffff";
              }
              if (wd.isPast && !isHighlighted) {
                opacity = 0.5;
              }

              return (
                <button
                  key={wd.date}
                  onClick={() => setDate(wd.date)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 8px",
                    borderRadius: "12px",
                    minWidth: "38px",
                    textAlign: "center",
                    background: bg,
                    border: "none",
                    cursor: "pointer",
                    opacity,
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: labelColor,
                    }}
                  >
                    {wd.dayLabel}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: numColor,
                    }}
                  >
                    {wd.dayNumber}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Exercise Sections ── */}
      {CATEGORIES.map((cat) => {
        const items = plan.filter((p) => p.category === cat);
        const progress = getCategoryProgress(cat);

        return (
          <div
            key={cat}
            style={{
              margin: "0 16px 12px",
              background: "var(--s1)",
              border: "1px solid var(--brd)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            {/* Section Header */}
            <div
              style={{
                background: "var(--s2)",
                padding: "12px 16px",
                borderBottom: "1px solid var(--brd)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: categoryColors[cat],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "var(--tx3)",
                }}
              >
                {categoryLabels[cat]}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--tx3)",
                  marginLeft: "auto",
                }}
              >
                {progress.done}/{progress.total}
              </span>
              {/* Ask AI button */}
              {items.length > 0 && (
                <a
                  href={`/ai?prompt=${encodeURIComponent(`Help me with my ${categoryLabels[cat]} exercises`)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--tx3)",
                    textDecoration: "none",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </a>
              )}
              {/* Add exercise button */}
              <button
                onClick={() => openExercisePicker(cat)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  border: "2px solid var(--brd)",
                  background: "transparent",
                  color: "var(--tx3)",
                  fontSize: "18px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                +
              </button>
            </div>

            {/* Exercise Items or Empty State */}
            <div style={{ background: "var(--s1)" }}>
              {items.length === 0 ? (
                <div
                  style={{
                    padding: "12px 16px 8px 28px",
                    fontStyle: "italic",
                    fontSize: "13px",
                    color: "var(--tx3)",
                  }}
                >
                  Tap + to add exercises
                </div>
              ) : (
                items.map((item) => {
                  const key = `step:${item.exerciseId}:0`;
                  const checked = checks[key] || false;
                  const isExpanded = expanded.has(item.exerciseId);
                  return (
                    <div key={item.id} style={{ borderBottom: "1px solid var(--brd)", opacity: isFuture ? 0.65 : 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          background: "var(--s1)",
                        }}
                      >
                        {/* Checkbox / Future preview placeholder */}
                        {isFuture ? (
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "8px",
                              border: "2px dashed var(--brd)",
                              opacity: 0.5,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => toggleCheck("step", item.exerciseId, 0)}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "8px",
                              border: checked ? "2px solid var(--grn)" : "2px solid var(--brd)",
                              background: checked ? "var(--grn)" : "transparent",
                              color: "#ffffff",
                              fontSize: "14px",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              cursor: "pointer",
                            }}
                          >
                            {checked && "\u2713"}
                          </button>
                        )}

                        {/* Name + target area */}
                        <button
                          onClick={() => {
                            const next = new Set(expanded);
                            isExpanded ? next.delete(item.exerciseId) : next.add(item.exerciseId);
                            setExpanded(next);
                          }}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "15px",
                              color: isFuture ? "var(--tx3)" : (checked ? "var(--tx3)" : "var(--tx)"),
                              textDecoration: checked && !isFuture ? "line-through" : "none",
                              opacity: checked && !isFuture ? 0.7 : 1,
                            }}
                          >
                            {item.exercise.name}
                          </div>
                          {item.exercise.targets && (
                            <div style={{ fontSize: "12px", color: "var(--tx3)" }}>
                              {item.exercise.targets}
                            </div>
                          )}
                        </button>

                        {/* Reps */}
                        {item.rx && (
                          <div style={{ fontSize: "13px", color: isFuture ? "var(--tx3)" : "var(--tx2)", flexShrink: 0 }}>
                            {item.rx}
                          </div>
                        )}
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div
                          style={{
                            background: "var(--s2)",
                            padding: "0 16px 14px 54px",
                            fontSize: "13px",
                            color: "var(--tx2)",
                          }}
                        >
                          {item.exercise.description && (
                            <p style={{ margin: "0 0 8px" }}>{item.exercise.description}</p>
                          )}
                          {item.exercise.cues && (
                            <ul style={{ margin: "0 0 8px", paddingLeft: "0", listStyle: "none" }}>
                              {item.exercise.cues.split("\n").filter(Boolean).map((cue, i) => (
                                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--acc)", flexShrink: 0, marginTop: "5px" }} />
                                  <span>{cue}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {item.exercise.warning && (
                            <p style={{ margin: "0 0 8px", color: "#ff9500" }}>
                              <span style={{ fontWeight: 600 }}>&#9888; Warning:</span> {item.exercise.warning}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.exercise.name + " exercise demo")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                background: "#ff0000",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              &#9654; YouTube Demo
                            </a>
                            <button
                              onClick={() => removeExercise(item.exerciseId)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                background: "transparent",
                                border: "1px solid #dddddd",
                                color: "#999999",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* ── 5. Supplements Section ── */}
      <div
        style={{
          margin: "0 16px 12px",
          background: "var(--s1)",
          border: "1px solid var(--brd)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Supplements Header */}
        <div
          style={{
            background: "var(--s2)",
            padding: "12px 16px",
            borderBottom: "1px solid var(--brd)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#ffcc00",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "var(--tx3)",
            }}
          >
            Vitamins
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--tx3)",
              marginLeft: "auto",
            }}
          >
            {suppProgress.done}/{suppProgress.total}
          </span>
          {/* Ask AI button */}
          {supplements.length > 0 && (
            <a
              href={`/ai?prompt=${encodeURIComponent("Help me with my supplement routine")}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--tx3)",
                textDecoration: "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </a>
          )}
        </div>

        {/* Supplement groups */}
        <div style={{ background: "var(--s1)" }}>
          {(["am", "mid", "pm"] as const).map((group) => {
            const items = supplements.filter((s) => s.timeGroup === group);
            return (
              <div key={group}>
                {/* Time group header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: "var(--s2)",
                    borderTop: "1px solid var(--brd)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--tx3)",
                    }}
                  >
                    {suppGroupLabels[group]}
                  </span>
                  <button
                    onClick={() => openSupplementPicker(group)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "2px solid var(--brd)",
                      background: "transparent",
                      color: "var(--tx3)",
                      fontSize: "18px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Supplement items */}
                {items.map((item) => {
                  const key = `supplement:${item.supplementId}:0`;
                  const checked = checks[key] || false;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--brd)",
                        opacity: isFuture ? 0.65 : 1,
                      }}
                    >
                      {isFuture ? (
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "6px",
                            border: "2px dashed var(--brd)",
                            opacity: 0.5,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => toggleCheck("supplement", item.supplementId, 0)}
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "6px",
                            border: checked ? "2px solid var(--grn)" : "2px solid var(--brd)",
                            background: checked ? "var(--grn)" : "transparent",
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            cursor: "pointer",
                          }}
                        >
                          {checked && "\u2713"}
                        </button>
                      )}
                      <div
                        style={{
                          flex: 1,
                          fontSize: "14px",
                          fontWeight: 500,
                          color: isFuture ? "var(--tx3)" : (checked ? "var(--tx3)" : "var(--tx)"),
                          textDecoration: checked && !isFuture ? "line-through" : "none",
                          opacity: checked && !isFuture ? 0.7 : 1,
                        }}
                      >
                        {item.supplement.name}
                      </div>
                      {item.supplement.dose && (
                        <div style={{ fontSize: "12px", color: "var(--tx3)", whiteSpace: "nowrap" }}>
                          {item.supplement.dose}
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div
                    style={{
                      padding: "14px 16px",
                      textAlign: "center",
                      fontStyle: "italic",
                      fontSize: "13px",
                      color: "var(--tx3)",
                    }}
                  >
                    Tap + to add supplements
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. Picker Modal ── */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg)",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "70vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "slideUp 200ms ease-out",
            }}
          >
            {/* Picker header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--brd)",
              }}
            >
              <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--tx)" }}>
                {pickerType === "exercise"
                  ? `Add ${categoryLabels[pickerCategory]} Exercise`
                  : `Add ${suppGroupLabels[pickerTimeGroup]} Supplement`}
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  color: "var(--tx3)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                &#10005;
              </button>
            </div>

            {/* Picker items */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {pickerLoading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--tx3)", fontSize: "13px" }}>
                  Loading...
                </div>
              ) : pickerItems.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--tx3)", fontSize: "13px" }}>
                  No items available
                </div>
              ) : (
                pickerItems.map((item) => {
                  if (pickerType === "exercise") {
                    const ex = item as PickerExercise;
                    const alreadyAdded = existingExerciseIds.has(ex.id);
                    return (
                      <button
                        key={ex.id}
                        disabled={alreadyAdded}
                        onClick={() => !alreadyAdded && selectExercise(ex.id)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "14px 20px",
                          border: "none",
                          borderBottom: "1px solid var(--brd)",
                          background: "transparent",
                          cursor: alreadyAdded ? "default" : "pointer",
                          opacity: alreadyAdded ? 0.4 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "15px", color: "var(--tx)", fontWeight: 500 }}>{ex.name}</div>
                            {ex.targets && (
                              <div style={{ fontSize: "12px", color: "var(--tx3)", marginTop: "2px" }}>{ex.targets}</div>
                            )}
                          </div>
                          {alreadyAdded ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "var(--tx3)",
                                background: "var(--s2)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Added
                            </span>
                          ) : ex.defaultRx ? (
                            <span style={{ fontSize: "13px", color: "var(--tx2)", whiteSpace: "nowrap", marginLeft: "12px" }}>
                              {ex.defaultRx}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  } else {
                    const supp = item as PickerSupplement;
                    return (
                      <button
                        key={supp.id}
                        onClick={() => selectSupplement(supp.id, pickerTimeGroup)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "14px 20px",
                          border: "none",
                          borderBottom: "1px solid var(--brd)",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: "15px", color: "var(--tx)", fontWeight: 500 }}>{supp.name}</div>
                        {supp.dose && (
                          <div style={{ fontSize: "12px", color: "var(--tx3)", marginTop: "2px" }}>{supp.dose}</div>
                        )}
                      </button>
                    );
                  }
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
