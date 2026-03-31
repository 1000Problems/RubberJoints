"use client";

import { useState, useEffect, useCallback } from "react";

interface Exercise {
  id: string;
  name: string;
  category: string;
  targets: string | null;
  description: string | null;
  defaultRx: string | null;
}

interface Supplement {
  id: string;
  name: string;
  dose: string | null;
  time: string | null;
  timeGroup: string;
}

interface SettingsData {
  startDate: string | null;
  exercisesByCategory: Record<string, Exercise[]>;
  supplements: Supplement[];
  selectedExercises: string[];
  selectedSupplements: string[];
}

const categoryConfig = [
  { key: "warmup_tool", label: "Warm-Up", icon: "\uD83D\uDD25", color: "var(--org)" },
  { key: "mobility", label: "Mobility", icon: "\uD83E\uDDD8", color: "var(--grn)" },
  { key: "recovery_tool", label: "Recovery", icon: "\uD83E\uDDCA", color: "var(--acc)" },
];

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setData(json);
      if (json.startDate) {
        setStartDate(json.startDate.split("T")[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveStartDate() {
    if (!startDate) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
      if (res.ok) {
        setSavedMsg("Saved");
        setTimeout(() => setSavedMsg(""), 2000);
      }
    } catch {
      setSavedMsg("Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(type: "exercise" | "supplement", id: string, currentlyEnabled: boolean) {
    if (!data) return;
    const newEnabled = !currentlyEnabled;

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      if (type === "exercise") {
        const updated = newEnabled
          ? [...new Set([...prev.selectedExercises, id])]
          : prev.selectedExercises.filter((e) => e !== id);
        return { ...prev, selectedExercises: updated };
      } else {
        const updated = newEnabled
          ? [...new Set([...prev.selectedSupplements, id])]
          : prev.selectedSupplements.filter((s) => s !== id);
        return { ...prev, selectedSupplements: updated };
      }
    });

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, enabled: newEnabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setData((prev) => {
        if (!prev) return prev;
        if (type === "exercise") {
          const reverted = currentlyEnabled
            ? [...new Set([...prev.selectedExercises, id])]
            : prev.selectedExercises.filter((e) => e !== id);
          return { ...prev, selectedExercises: reverted };
        } else {
          const reverted = currentlyEnabled
            ? [...new Set([...prev.selectedSupplements, id])]
            : prev.selectedSupplements.filter((s) => s !== id);
          return { ...prev, selectedSupplements: reverted };
        }
      });
    }
  }

  async function resetProgress() {
    setResetting(true);
    try {
      await fetch("/api/settings/reset", { method: "POST" });
      setConfirmReset(false);
    } catch {
      // ignore
    } finally {
      setResetting(false);
    }
  }

  function getWeekAndPhase(): { week: number; phase: number; dayInProgram: number } | null {
    if (!startDate) return null;
    const start = new Date(startDate + "T12:00:00");
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { week: 0, phase: 1, dayInProgram: 0 };
    const week = Math.floor(diff / 7) + 1;
    const phase = week <= 6 ? 1 : 2;
    return { week, phase, dayInProgram: diff + 1 };
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
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Failed to load settings</div>
      </div>
    );
  }

  const weekInfo = getWeekAndPhase();

  return (
    <div style={{ padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      {/* Header */}
      <h1
        style={{
          textAlign: "center",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          color: "var(--tx3)",
          marginBottom: "20px",
          marginTop: "8px",
        }}
      >
        Settings
      </h1>

      {/* Program Start Date */}
      <div
        style={{
          background: "var(--s1)",
          borderRadius: "16px",
          border: "1px solid var(--brd)",
          padding: "16px",
          marginBottom: "16px",
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
          Program Start Date
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--brd)",
              background: "var(--s2)",
              color: "var(--tx)",
              fontSize: "15px",
              outline: "none",
            }}
          />
          <button
            onClick={saveStartDate}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              background: "var(--acc)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              opacity: saving ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Saving..." : "Save Start Date"}
          </button>
        </div>
        {savedMsg && (
          <div style={{ fontSize: "13px", color: "var(--grn)", marginTop: "8px", fontWeight: 600 }}>
            {savedMsg}
          </div>
        )}
        {weekInfo && weekInfo.dayInProgram > 0 && (
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              gap: "16px",
              fontSize: "13px",
              color: "var(--tx2)",
            }}
          >
            <span>
              Week <strong style={{ color: "var(--tx)" }}>{weekInfo.week}</strong>
            </span>
            <span>
              Phase <strong style={{ color: "var(--tx)" }}>{weekInfo.phase}</strong>
            </span>
            <span>
              Day <strong style={{ color: "var(--tx)" }}>{weekInfo.dayInProgram}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Exercise Toggle Cards */}
      {categoryConfig.map((cat) => {
        const exercises = data.exercisesByCategory[cat.key] || [];
        if (exercises.length === 0) return null;
        const enabledCount = exercises.filter((ex) =>
          data.selectedExercises.includes(ex.id)
        ).length;

        return (
          <div
            key={cat.key}
            style={{
              background: "var(--s1)",
              borderRadius: "16px",
              border: "1px solid var(--brd)",
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Category header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 16px",
                borderBottom: "1px solid var(--brd)",
              }}
            >
              <span style={{ fontSize: "18px" }}>{cat.icon}</span>
              <span
                style={{
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 700,
                  color: cat.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {cat.label}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--tx3)",
                }}
              >
                {enabledCount} / {exercises.length}
              </span>
            </div>

            {/* Exercise rows */}
            {exercises.map((ex, idx) => {
              const enabled = data.selectedExercises.includes(ex.id);
              return (
                <div
                  key={ex.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderBottom:
                      idx < exercises.length - 1 ? "1px solid var(--brd)" : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "var(--tx)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ex.name}
                    </div>
                    {(ex.targets || ex.defaultRx) && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--tx3)",
                          marginTop: "2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ex.targets && <span>{ex.targets}</span>}
                        {ex.targets && ex.defaultRx && <span> &middot; </span>}
                        {ex.defaultRx && <span>{ex.defaultRx}</span>}
                      </div>
                    )}
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => toggleItem("exercise", ex.id, enabled)}
                    style={{
                      position: "relative",
                      width: "46px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      cursor: "pointer",
                      background: enabled ? "var(--grn)" : "var(--s3)",
                      transition: "background 0.25s ease",
                      flexShrink: 0,
                      padding: 0,
                    }}
                    aria-label={`Toggle ${ex.name}`}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: enabled ? "20px" : "2px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "12px",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 0.25s ease",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Supplements Toggle Card */}
      {data.supplements.length > 0 && (() => {
        const enabledCount = data.supplements.filter((s) =>
          data.selectedSupplements.includes(s.id)
        ).length;

        return (
          <div
            style={{
              background: "var(--s1)",
              borderRadius: "16px",
              border: "1px solid var(--brd)",
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 16px",
                borderBottom: "1px solid var(--brd)",
              }}
            >
              <span style={{ fontSize: "18px" }}>{"\uD83D\uDC8A"}</span>
              <span
                style={{
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--yel)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Supplements
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--tx3)",
                }}
              >
                {enabledCount} / {data.supplements.length}
              </span>
            </div>

            {data.supplements.map((supp, idx) => {
              const enabled = data.selectedSupplements.includes(supp.id);
              return (
                <div
                  key={supp.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderBottom:
                      idx < data.supplements.length - 1
                        ? "1px solid var(--brd)"
                        : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "var(--tx)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {supp.name}
                    </div>
                    {(supp.dose || supp.time) && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--tx3)",
                          marginTop: "2px",
                        }}
                      >
                        {supp.dose && <span>{supp.dose}</span>}
                        {supp.dose && supp.time && <span> &middot; </span>}
                        {supp.time && <span>{supp.time}</span>}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleItem("supplement", supp.id, enabled)}
                    style={{
                      position: "relative",
                      width: "46px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      cursor: "pointer",
                      background: enabled ? "var(--grn)" : "var(--s3)",
                      transition: "background 0.25s ease",
                      flexShrink: 0,
                      padding: 0,
                    }}
                    aria-label={`Toggle ${supp.name}`}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: enabled ? "20px" : "2px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "12px",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 0.25s ease",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Data Section */}
      <div
        style={{
          background: "var(--s1)",
          borderRadius: "16px",
          border: "1px solid var(--brd)",
          padding: "16px",
          marginBottom: "32px",
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
          Data
        </div>

        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid var(--red)",
              background: "transparent",
              color: "var(--red)",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset all progress
          </button>
        ) : (
          <div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--tx2)",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              This will clear all check-ins, session logs, and milestones. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--brd)",
                  background: "var(--s2)",
                  color: "var(--tx)",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={resetProgress}
                disabled={resetting}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--red)",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
