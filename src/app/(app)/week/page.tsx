"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DayCategories {
  [key: string]: { done: number; total: number };
}

interface DayData {
  date: string;
  dayName: string;
  dayShort: string;
  isToday: boolean;
  isFuture: boolean;
  dayType: string;
  label: string;
  duration: string;
  categories: DayCategories;
  vitaminsDone: number;
  vitaminsTotal: number;
  hasPlan: boolean;
}

interface WeekData {
  days: DayData[];
  weekNumber: number;
  totalWeeks: number;
  offset: number;
}

const catColors: Record<string, string> = {
  warmup_tool: "#ff9500",
  mobility: "#34c759",
  recovery_tool: "#4a6cf7",
};

const catLabels: Record<string, string> = {
  warmup_tool: "Warm-up",
  mobility: "Mobility",
  recovery_tool: "Recovery",
};

export default function WeekPage() {
  const router = useRouter();
  const [data, setData] = useState<WeekData | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/week?offset=${offset}`);
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 8px",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--tx)",
            margin: 0,
          }}
        >
          Weekly Activity
        </h1>
        <div
          style={{
            background: "var(--acc)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 12px",
            borderRadius: "20px",
            letterSpacing: "0.02em",
          }}
        >
          Week {data.weekNumber} of {data.totalWeeks}
        </div>
      </div>

      {/* Week navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px 16px",
        }}
      >
        <button
          onClick={() => setOffset((o) => o - 1)}
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            background: "var(--s1)",
            border: "1px solid var(--brd)",
            color: "var(--tx)",
            fontSize: "22px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--tx2)" }}>
          {data.days[0]?.dayShort} - {data.days[6]?.dayShort}
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            background: "var(--s1)",
            border: "1px solid var(--brd)",
            color: "var(--tx)",
            fontSize: "22px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ›
        </button>
      </div>

      {/* Day cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 16px 24px" }}>
        {data.days.map((day) => {
          const catKeys = Object.keys(day.categories);
          const hasContent = catKeys.length > 0 || day.vitaminsTotal > 0;

          return (
            <button
              key={day.date}
              onClick={() => router.push(`/workout?date=${day.date}`)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: "16px",
                background: "var(--s1)",
                border: day.isToday ? "2px solid var(--grn)" : "1px solid var(--brd)",
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
            >
              {/* Day header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: hasContent ? "10px" : "0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {day.isToday && (
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--grn)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: day.isToday ? "var(--grn)" : "var(--tx)",
                      }}
                    >
                      {day.dayName}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--tx3)", marginTop: "1px" }}>
                      {day.dayShort}
                    </div>
                  </div>
                </div>
                {day.hasPlan && (
                  <div style={{ fontSize: "12px", color: "var(--tx3)", textAlign: "right" }}>
                    <span style={{ color: "var(--tx2)", fontWeight: 500 }}>{day.label}</span>
                    <span style={{ margin: "0 4px" }}>&middot;</span>
                    <span>{day.duration}</span>
                  </div>
                )}
              </div>

              {/* Progress bars or Upcoming */}
              {day.isFuture && !day.isToday ? (
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--tx3)",
                    fontStyle: "italic",
                  }}
                >
                  Upcoming
                </div>
              ) : hasContent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {catKeys.map((cat) => {
                    const { done, total } = day.categories[cat];
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div
                        key={cat}
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: catColors[cat] || "var(--tx3)",
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            width: "60px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: catColors[cat] || "var(--tx3)",
                          }}
                        >
                          {catLabels[cat] || cat}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            height: "6px",
                            borderRadius: "3px",
                            background: "var(--s3)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: "3px",
                              width: `${pct}%`,
                              background: catColors[cat] || "var(--tx3)",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            width: "32px",
                            textAlign: "right",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--tx2)",
                          }}
                        >
                          {done}/{total}
                        </div>
                      </div>
                    );
                  })}
                  {day.vitaminsTotal > 0 && (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "8px" }}
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
                      <div
                        style={{
                          width: "60px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#ffcc00",
                        }}
                      >
                        Vitamins
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "3px",
                          background: "var(--s3)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: "3px",
                            width: `${day.vitaminsTotal > 0 ? Math.round((day.vitaminsDone / day.vitaminsTotal) * 100) : 0}%`,
                            background: "#ffcc00",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          width: "32px",
                          textAlign: "right",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--tx2)",
                        }}
                      >
                        {day.vitaminsDone}/{day.vitaminsTotal}
                      </div>
                    </div>
                  )}
                </div>
              ) : !day.hasPlan ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--tx3)",
                    fontStyle: "italic",
                  }}
                >
                  No exercises planned
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
