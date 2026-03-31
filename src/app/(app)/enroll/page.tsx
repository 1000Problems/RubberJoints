"use client";

import { useState, useEffect, useCallback } from "react";

interface Program {
  id: number;
  name: string;
  durationDays: number;
  description: string | null;
}

interface Enrollment {
  id: number;
  programId: number;
  startDate: string;
  status: string;
  program: Program;
}

interface EnrollData {
  enrollment: Enrollment | null;
  programs: Program[];
}

export default function EnrollPage() {
  const [data, setData] = useState<EnrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDates, setStartDates] = useState<Record<number, string>>({});
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/enroll");
      const json = await res.json();
      setData(json);
      // Default start dates to today
      const today = new Date().toISOString().split("T")[0];
      const dates: Record<number, string> = {};
      for (const p of json.programs) {
        dates[p.id] = today;
      }
      setStartDates(dates);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function enrollInProgram(programId: number) {
    setEnrolling(programId);
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          startDate: startDates[programId],
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setEnrolling(null);
    }
  }

  async function restartProgram() {
    if (!data?.enrollment) return;
    setRestarting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: data.enrollment.programId,
          startDate: today,
          restart: true,
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setRestarting(false);
    }
  }

  function formatDuration(days: number): string {
    if (days % 7 === 0) return `${days / 7} weeks`;
    return `${days} days`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Failed to load programs</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      {/* Title */}
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 600,
          color: "var(--tx)",
          marginBottom: "20px",
          marginTop: "8px",
        }}
      >
        Enroll in a Program
      </h1>

      {/* Current Enrollment */}
      {data.enrollment && (
        <div
          style={{
            background: "var(--s1)",
            borderRadius: "16px",
            border: "1px solid var(--brd)",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--tx3)",
              marginBottom: "12px",
            }}
          >
            Current Enrollment
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--tx)",
              marginBottom: "4px",
            }}
          >
            {data.enrollment.program.name}
          </div>
          <div style={{ fontSize: "13px", color: "var(--tx2)", marginBottom: "4px" }}>
            {formatDuration(data.enrollment.program.durationDays)}
          </div>
          <div style={{ fontSize: "13px", color: "var(--tx3)", marginBottom: "14px" }}>
            Started{" "}
            {new Date(data.enrollment.startDate + "T12:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <button
            onClick={restartProgram}
            disabled={restarting}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid var(--org)",
              background: "transparent",
              color: "var(--org)",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: restarting ? 0.6 : 1,
            }}
          >
            {restarting ? "Restarting..." : "Restart Program"}
          </button>
        </div>
      )}

      {/* Separator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "var(--brd)" }} />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Available Programs
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--brd)" }} />
      </div>

      {/* Programs Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "32px" }}>
        {data.programs.map((program) => {
          const isCurrentProgram = data.enrollment?.programId === program.id;
          return (
            <div
              key={program.id}
              style={{
                background: "var(--s1)",
                borderRadius: "16px",
                border: isCurrentProgram
                  ? "2px solid var(--acc)"
                  : "1px solid var(--brd)",
                padding: "16px",
                opacity: enrolling === program.id ? 0.7 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "var(--tx)",
                    flex: 1,
                  }}
                >
                  {program.name}
                </div>
                {isCurrentProgram && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--acc)",
                      background: "var(--s2)",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx2)", marginBottom: "6px" }}>
                {formatDuration(program.durationDays)}
              </div>
              {program.description && (
                <div style={{ fontSize: "14px", color: "var(--tx2)", lineHeight: 1.5, marginBottom: "14px" }}>
                  {program.description}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="date"
                  value={startDates[program.id] || ""}
                  onChange={(e) =>
                    setStartDates((prev) => ({ ...prev, [program.id]: e.target.value }))
                  }
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--brd)",
                    background: "var(--s2)",
                    color: "var(--tx)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => enrollInProgram(program.id)}
                  disabled={enrolling !== null}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: "var(--grn)",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: enrolling !== null ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {enrolling === program.id ? "Starting..." : "Start Program"}
                </button>
              </div>
            </div>
          );
        })}

        {data.programs.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              fontSize: "14px",
              color: "var(--tx3)",
            }}
          >
            No programs available yet
          </div>
        )}
      </div>
    </div>
  );
}
