"use client";

import { useEffect, useState } from "react";

interface Exercise {
  id: string;
  name: string;
  category: string;
  targets: string | null;
  description: string | null;
  cues: string | null;
  explanation: string | null;
  warning: string | null;
  defaultRx: string | null;
}

const categoryMeta: Record<string, { label: string; color: string }> = {
  warmup_tool: { label: "Warm-Up Tools", color: "var(--org)" },
  mobility: { label: "Mobility", color: "var(--grn)" },
  recovery_tool: { label: "Recovery Tools", color: "var(--acc)" },
};

const categoryOrder = ["warmup_tool", "mobility", "recovery_tool"];

export default function LibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((d) => setExercises(d.exercises ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.targets && e.targets.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q))
      )
    : exercises;

  const grouped = categoryOrder
    .map((cat) => ({
      cat,
      items: filtered.filter((e) => e.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ padding: "16px", background: "var(--bg)", minHeight: "100%" }}>
      {/* Header */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--tx)",
          margin: "0 0 16px",
        }}
      >
        Exercise Library
      </h1>

      {/* Search */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          fontSize: 14,
          borderRadius: 10,
          border: "1px solid var(--brd)",
          background: "var(--s1)",
          color: "var(--tx)",
          outline: "none",
          boxSizing: "border-box",
          marginBottom: 20,
        }}
      />

      {loading && (
        <p style={{ color: "var(--tx3)", fontSize: 14, textAlign: "center" }}>
          Loading...
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <p style={{ color: "var(--tx3)", fontSize: 14, textAlign: "center" }}>
          No exercises found.
        </p>
      )}

      {grouped.map(({ cat, items }) => {
        const meta = categoryMeta[cat] ?? { label: cat, color: "var(--acc)" };
        return (
          <section key={cat} style={{ marginBottom: 24 }}>
            {/* Category header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 8,
                background: meta.color,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                {meta.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                {items.length}
              </span>
            </div>

            {/* Exercise cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((ex) => {
                const isOpen = expanded === ex.id;
                const cueList = ex.cues
                  ? ex.cues.split("\n").filter((c) => c.trim())
                  : [];

                return (
                  <div
                    key={ex.id}
                    onClick={() => setExpanded(isOpen ? null : ex.id)}
                    style={{
                      background: "var(--s2)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      border: "1px solid var(--brd)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Collapsed view */}
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--tx)",
                      }}
                    >
                      {ex.name}
                    </div>
                    {ex.targets && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--tx3)",
                          marginTop: 3,
                        }}
                      >
                        {ex.targets}
                      </div>
                    )}
                    {ex.defaultRx && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--tx2)",
                          marginTop: 2,
                        }}
                      >
                        Rx: {ex.defaultRx}
                      </div>
                    )}

                    {/* Expanded detail */}
                    {isOpen && (
                      <div
                        style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--brd)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ex.description && (
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--tx2)",
                              margin: "0 0 10px",
                              lineHeight: 1.5,
                            }}
                          >
                            {ex.description}
                          </p>
                        )}

                        {cueList.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--tx)",
                                marginBottom: 6,
                              }}
                            >
                              Cues
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 0,
                                listStyle: "none",
                              }}
                            >
                              {cueList.map((cue, i) => (
                                <li
                                  key={i}
                                  style={{
                                    fontSize: 12,
                                    color: "var(--tx2)",
                                    lineHeight: 1.6,
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 5,
                                      height: 5,
                                      borderRadius: "50%",
                                      background: "var(--acc)",
                                      flexShrink: 0,
                                      marginTop: 6,
                                    }}
                                  />
                                  {cue.trim()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {ex.explanation && (
                          <div style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--tx)",
                                marginBottom: 4,
                              }}
                            >
                              Why it works
                            </div>
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--tx2)",
                                margin: 0,
                                lineHeight: 1.5,
                              }}
                            >
                              {ex.explanation}
                            </p>
                          </div>
                        )}

                        {ex.warning && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--org)",
                              fontWeight: 500,
                              marginBottom: 10,
                              lineHeight: 1.5,
                            }}
                          >
                            {ex.warning}
                          </div>
                        )}

                        {/* YouTube demo link */}
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + " exercise demo")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--acc)",
                            textDecoration: "none",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="var(--acc)"
                          >
                            <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.4-1.9.5-3.9.5-5.8a31.6 31.6 0 00-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" />
                          </svg>
                          Watch Demo
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
