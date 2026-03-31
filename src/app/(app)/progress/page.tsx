"use client";

import { useState, useEffect, useCallback } from "react";

interface MilestoneData {
  id: string;
  name: string;
  description: string | null;
  done: boolean;
  achievedDate: string | null;
}

interface ProgressData {
  thisWeekSessions: number;
  totalSessions: number;
  todayWorkoutPct: number;
  vitaminsDone: number;
  vitaminsTotal: number;
  milestones: MilestoneData[];
  weekNumber: number;
  totalWeeks: number;
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/progress");
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(milestoneId: string) {
    if (!data) return;
    setMarking((prev) => new Set(prev).add(milestoneId));
    try {
      await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId }),
      });
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          milestones: prev.milestones.map((m) =>
            m.id === milestoneId
              ? { ...m, done: true, achievedDate: new Date().toISOString().split("T")[0] }
              : m
          ),
        };
      });
    } catch {
      // ignore
    } finally {
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(milestoneId);
        return next;
      });
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div>
      </div>
    );
  }

  const stats = [
    {
      label: "This Week",
      value: String(data.thisWeekSessions),
      sub: "sessions",
      color: "var(--acc)",
    },
    {
      label: "Total Sessions",
      value: String(data.totalSessions),
      sub: "all time",
      color: "var(--pur)",
    },
    {
      label: "Today's Workout",
      value: `${data.todayWorkoutPct}%`,
      sub: "completed",
      color: "var(--grn)",
    },
    {
      label: "Vitamins Today",
      value: `${data.vitaminsDone}/${data.vitaminsTotal}`,
      sub: "taken",
      color: "var(--yel)",
    },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* Header card */}
      <div
        style={{
          margin: "16px 16px 12px",
          background: "var(--s1)",
          border: "1px solid var(--brd)",
          borderRadius: "16px",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "13px",
            fontWeight: 800,
            color: "var(--tx3)",
            margin: "0 0 8px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Progress
        </h1>
        <span
          style={{
            background: "rgba(74,108,247,0.1)",
            color: "var(--acc)",
            fontSize: "12px",
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: "20px",
          }}
        >
          Week {data.weekNumber} of {data.totalWeeks}
        </span>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          padding: "0 16px 16px",
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--s1)",
              border: "1px solid var(--brd)",
              borderRadius: "16px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--tx3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: s.color,
                lineHeight: 1,
                marginBottom: "4px",
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: "11px", color: "var(--tx3)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Milestones Card */}
      <div
        style={{
          margin: "0 16px 16px",
          background: "var(--s1)",
          border: "1px solid var(--brd)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--brd)",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "var(--tx3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Milestones
          </div>
        </div>

        {data.milestones.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--tx3)", fontSize: "13px" }}>
            No milestones available
          </div>
        ) : (
          data.milestones.map((m, i) => {
            const isExpanded = expanded.has(m.id);
            const isMarking = marking.has(m.id);

            return (
              <div
                key={m.id}
                style={{
                  borderBottom:
                    i < data.milestones.length - 1 ? "1px solid var(--brd)" : "none",
                }}
              >
                {/* Milestone row */}
                <div
                  onClick={() => toggleExpand(m.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  {/* Dot/checkbox */}
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      border: m.done ? "none" : "2px solid var(--brd)",
                      background: m.done ? "var(--grn)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {m.done && "✓"}
                  </div>

                  {/* Name + date - clickable to expand */}
                  <button
                    onClick={() => toggleExpand(m.id)}
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
                        fontSize: "14px",
                        fontWeight: 600,
                        color: m.done ? "var(--tx3)" : "var(--tx)",
                        textDecoration: m.done ? "line-through" : "none",
                        opacity: m.done ? 0.7 : 1,
                      }}
                    >
                      {m.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--tx3)", marginTop: "2px" }}>
                      {m.done && m.achievedDate
                        ? `Achieved ${new Date(m.achievedDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                        : "Not yet"}
                    </div>
                  </button>

                  {/* Done button for incomplete */}
                  {!m.done && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markDone(m.id); }}
                      disabled={isMarking}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "var(--s2)",
                        color: "var(--grn)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: isMarking ? "default" : "pointer",
                        opacity: isMarking ? 0.6 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {isMarking ? "..." : "Done"}
                    </button>
                  )}

                  {/* Expand chevron */}
                  <span
                    style={{
                      color: "var(--tx3)",
                      fontSize: "16px",
                      flexShrink: 0,
                      transform: isExpanded ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    ›
                  </span>

                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "0 16px 12px",
                      paddingLeft: "38px",
                      background: "var(--s2)",
                    }}
                  >
                    {m.description && (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--tx2)",
                          margin: "8px 0",
                          lineHeight: 1.5,
                        }}
                      >
                        {m.description}
                      </p>
                    )}
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(m.name + " exercise demo")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "4px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: "#ff0000",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      &#9654; YouTube Demo
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "8px 16px 32px",
          fontSize: "11px",
          color: "var(--tx3)",
          fontStyle: "italic",
        }}
      >
        Sessions are saved automatically
      </div>
    </div>
  );
}
