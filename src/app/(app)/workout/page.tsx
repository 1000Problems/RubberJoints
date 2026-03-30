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

export default function WorkoutPage() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);
  const [checks, setChecks] = useState<CheckState>({});
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
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

  useEffect(() => {
    loadDay();
  }, [loadDay]);

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
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  }

  const categories = ["warmup_tool", "mobility", "recovery_tool"];
  const categoryLabels: Record<string, string> = {
    warmup_tool: "Warm-Up",
    mobility: "Mobility",
    recovery_tool: "Recovery",
  };

  const suppGroups = ["am", "mid", "pm"];
  const suppGroupLabels: Record<string, string> = {
    am: "Morning",
    mid: "Midday",
    pm: "Evening",
  };

  function getCategoryProgress(cat: string) {
    const items = plan.filter((p) => p.category === cat);
    if (items.length === 0) return 0;
    const done = items.filter((p) => checks[`step:${p.exerciseId}:0`]).length;
    return Math.round((done / items.length) * 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Day header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => changeDay(-1)} className="p-2 text-gray-500 hover:text-gray-800">
          &larr;
        </button>
        <div className="text-center">
          <div className="font-semibold text-sm">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        <button onClick={() => changeDay(1)} className="p-2 text-gray-500 hover:text-gray-800">
          &rarr;
        </button>
      </div>

      {/* Progress bars */}
      <div className="px-4 py-3 flex gap-2">
        {categories.map((cat) => {
          const pct = getCategoryProgress(cat);
          return (
            <div key={cat} className="flex-1">
              <div className="text-[10px] text-gray-500 mb-1">{categoryLabels[cat]}</div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Exercises by category */}
      {categories.map((cat) => {
        const items = plan.filter((p) => p.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
              {categoryLabels[cat]}
            </div>
            {items.map((item) => {
              const key = `step:${item.exerciseId}:0`;
              const checked = checks[key] || false;
              const isExpanded = expanded.has(item.exerciseId);
              return (
                <div key={item.id} className="border-b border-gray-100">
                  <div className="flex items-center px-4 py-3 gap-3">
                    <button
                      onClick={() => toggleCheck("step", item.exerciseId, 0)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        checked
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {checked && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const next = new Set(expanded);
                        isExpanded ? next.delete(item.exerciseId) : next.add(item.exerciseId);
                        setExpanded(next);
                      }}
                      className="flex-1 text-left"
                    >
                      <div className={`text-sm font-medium ${checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                        {item.exercise.name}
                      </div>
                      {item.rx && (
                        <div className="text-xs text-gray-500">{item.rx}</div>
                      )}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-12 pb-3 text-xs text-gray-600 space-y-1">
                      {item.exercise.targets && <p><span className="font-medium">Targets:</span> {item.exercise.targets}</p>}
                      {item.exercise.description && <p>{item.exercise.description}</p>}
                      {item.exercise.cues && <p><span className="font-medium">Cues:</span> {item.exercise.cues}</p>}
                      {item.exercise.warning && <p className="text-amber-600"><span className="font-medium">Warning:</span> {item.exercise.warning}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Supplements */}
      {supplements.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
            Supplements
          </div>
          {suppGroups.map((group) => {
            const items = supplements.filter((s) => s.timeGroup === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-blue-600 uppercase">
                  {suppGroupLabels[group]}
                </div>
                {items.map((item) => {
                  const key = `supplement:${item.supplementId}:0`;
                  const checked = checks[key] || false;
                  return (
                    <div key={item.id} className="flex items-center px-4 py-2.5 gap-3 border-b border-gray-50">
                      <button
                        onClick={() => toggleCheck("supplement", item.supplementId, 0)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          checked
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <div className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          {item.supplement.name}
                        </div>
                        {item.supplement.dose && (
                          <div className="text-xs text-gray-500">{item.supplement.dose}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {plan.length === 0 && supplements.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No exercises planned for this day
        </div>
      )}
    </div>
  );
}
