"use client";

import { useState, useEffect, useCallback } from "react";

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

interface CheckState {
  [key: string]: boolean;
}

const categoryColors: Record<string, string> = {
  warmup_tool: "var(--org)",
  mobility: "var(--grn)",
  recovery_tool: "var(--acc)",
};

const categoryLabels: Record<string, string> = {
  warmup_tool: "WARM-UP",
  mobility: "MOBILITY",
  recovery_tool: "RECOVERY",
};

const suppGroupLabels: Record<string, string> = {
  am: "MORNING",
  mid: "MIDDAY",
  pm: "EVENING",
};

export default function WorkoutPage() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);
  const [checks, setChecks] = useState<CheckState>({});
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workout?date=${date}`);
      const data = await res.json();
      setPlan(data.plan || []);
      setSupplements(data.supplements || []);
      setChecks(data.checks || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadDay(); }, [loadDay]);

  async function toggleCheck(itemType: string, itemId: string, stepIndex: number) {
    const key = `${itemType}:${itemId}:${stepIndex}`;
    const newChecked = !checks[key];
    setChecks((prev) => ({ ...prev, [key]: newChecked }));
    try {
      await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, itemType, itemId, stepIndex, checked: newChecked }),
      });
    } catch {
      setChecks((prev) => ({ ...prev, [key]: !newChecked }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: "var(--tx3)", fontSize: "13px" }}>Loading...</div>
      </div>
    );
  }

  const categories = ["warmup_tool", "mobility", "recovery_tool"];
  const suppProgress = getSuppProgress();

  return (
    <div>
      {/* Day navigation */}
      <div
        className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
        style={{ background: "var(--bg)" }}
      >
        <button
          onClick={() => changeDay(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-[22px] font-bold"
          style={{ background: "var(--s1)", border: "1px solid var(--brd)", color: "var(--tx)" }}
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-[16px] font-bold" style={{ color: "var(--tx)" }}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        <button
          onClick={() => changeDay(1)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-[22px] font-bold"
          style={{ background: "var(--s1)", border: "1px solid var(--brd)", color: "var(--tx)" }}
        >
          ›
        </button>
      </div>

      {/* Activity Summary Card */}
      <div
        className="mx-4 mb-3 p-4 rounded-2xl"
        style={{ background: "var(--s1)", border: "1px solid var(--brd)" }}
      >
        <div
          className="text-[11px] font-extrabold uppercase mb-3"
          style={{ letterSpacing: "0.1em", color: "var(--tx3)" }}
        >
          TODAY&apos;S ACTIVITY
        </div>
        <div className="flex flex-col gap-2.5">
          {categories.map((cat) => {
            const { done, total, pct } = getCategoryProgress(cat);
            if (total === 0) return null;
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-20 text-[12px] font-bold" style={{ color: categoryColors[cat] }}>
                  {categoryLabels[cat]}
                </div>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--s3)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: categoryColors[cat],
                      transition: "width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    }}
                  />
                </div>
                <div className="w-9 text-right text-[12px] font-bold" style={{ color: "var(--tx2)" }}>
                  {done}/{total}
                </div>
              </div>
            );
          })}
          {suppProgress.total > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-20 text-[12px] font-bold" style={{ color: "var(--yel)" }}>
                VITAMINS
              </div>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--s3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${suppProgress.pct}%`,
                    background: "var(--yel)",
                    transition: "width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                />
              </div>
              <div className="w-9 text-right text-[12px] font-bold" style={{ color: "var(--tx2)" }}>
                {suppProgress.done}/{suppProgress.total}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exercise sections by category */}
      {categories.map((cat) => {
        const items = plan.filter((p) => p.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-3">
            {/* Section header */}
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: "var(--s2)", borderBottom: "1px solid var(--brd)" }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: categoryColors[cat] }}
              />
              <span
                className="text-[11px] font-bold uppercase flex-1"
                style={{ letterSpacing: "1px", color: "var(--tx3)" }}
              >
                {categoryLabels[cat]}
              </span>
              <span className="text-[12px] font-bold" style={{ color: "var(--tx3)" }}>
                {getCategoryProgress(cat).done}/{getCategoryProgress(cat).total}
              </span>
            </div>

            {/* Exercise items */}
            <div style={{ background: "var(--s1)" }}>
              {items.map((item) => {
                const key = `step:${item.exerciseId}:0`;
                const checked = checks[key] || false;
                const isExpanded = expanded.has(item.exerciseId);
                return (
                  <div key={item.id} style={{ borderBottom: "1px solid var(--brd)" }}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleCheck("step", item.exerciseId, 0)}
                        className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          border: checked ? "none" : "2px solid var(--brd)",
                          background: checked ? "var(--grn)" : "transparent",
                          color: "white",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        {checked && "✓"}
                      </button>

                      {/* Name + rx */}
                      <button
                        onClick={() => {
                          const next = new Set(expanded);
                          isExpanded ? next.delete(item.exerciseId) : next.add(item.exerciseId);
                          setExpanded(next);
                        }}
                        className="flex-1 text-left"
                      >
                        <div
                          className="text-[15px]"
                          style={{
                            color: checked ? "var(--tx3)" : "var(--tx)",
                            textDecoration: checked ? "line-through" : "none",
                            opacity: checked ? 0.7 : 1,
                          }}
                        >
                          {item.exercise.name}
                        </div>
                        {item.rx && (
                          <div className="text-[13px]" style={{ color: "var(--tx2)" }}>
                            {item.rx}
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div
                        className="px-4 pb-3 text-[13px]"
                        style={{
                          paddingLeft: "54px",
                          background: "var(--s2)",
                          color: "var(--tx2)",
                        }}
                      >
                        {item.exercise.targets && (
                          <p className="mb-1">
                            <span className="font-semibold" style={{ color: "var(--acc)" }}>Targets:</span>{" "}
                            {item.exercise.targets}
                          </p>
                        )}
                        {item.exercise.description && <p className="mb-1">{item.exercise.description}</p>}
                        {item.exercise.cues && (
                          <p className="mb-1">
                            <span className="font-semibold" style={{ color: "var(--acc)" }}>Cues:</span>{" "}
                            {item.exercise.cues}
                          </p>
                        )}
                        {item.exercise.warning && (
                          <p className="mb-1" style={{ color: "var(--org)" }}>
                            <span className="font-semibold">⚠ Warning:</span> {item.exercise.warning}
                          </p>
                        )}
                        {/* YouTube demo link */}
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.exercise.name + " exercise demo")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
                          style={{ background: "#ff0000" }}
                        >
                          ▶ YouTube Demo
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Supplements */}
      {supplements.length > 0 && (
        <div className="mb-3">
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ background: "var(--s2)", borderBottom: "1px solid var(--brd)" }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--yel)" }} />
            <span
              className="text-[11px] font-bold uppercase flex-1"
              style={{ letterSpacing: "1px", color: "var(--tx3)" }}
            >
              SUPPLEMENTS
            </span>
            <span className="text-[12px] font-bold" style={{ color: "var(--tx3)" }}>
              {suppProgress.done}/{suppProgress.total}
            </span>
          </div>

          <div style={{ background: "var(--s1)" }}>
            {["am", "mid", "pm"].map((group) => {
              const items = supplements.filter((s) => s.timeGroup === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div
                    className="px-4 py-1.5 text-[11px] font-bold uppercase"
                    style={{
                      background: "var(--s2)",
                      letterSpacing: "0.05em",
                      color: "var(--tx3)",
                    }}
                  >
                    {suppGroupLabels[group]}
                  </div>
                  {items.map((item) => {
                    const key = `supplement:${item.supplementId}:0`;
                    const checked = checks[key] || false;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: "1px solid var(--brd)" }}
                      >
                        <button
                          onClick={() => toggleCheck("supplement", item.supplementId, 0)}
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            border: checked ? "none" : "2px solid var(--brd)",
                            background: checked ? "var(--grn)" : "transparent",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {checked && "✓"}
                        </button>
                        <div className="flex-1">
                          <div
                            className="text-[14px]"
                            style={{
                              color: checked ? "var(--tx3)" : "var(--tx)",
                              textDecoration: checked ? "line-through" : "none",
                              opacity: checked ? 0.7 : 1,
                            }}
                          >
                            {item.supplement.name}
                          </div>
                          {item.supplement.dose && (
                            <div className="text-[12px]" style={{ color: "var(--tx3)" }}>
                              {item.supplement.dose}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan.length === 0 && supplements.length === 0 && (
        <div className="text-center py-16 text-[13px]" style={{ color: "var(--tx3)" }}>
          No exercises planned for this day
        </div>
      )}
    </div>
  );
}
