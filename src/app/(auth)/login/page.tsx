"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.ok) {
      router.push("/ai");
    } else {
      setError(data.error || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-[380px] p-8 rounded-2xl"
        style={{
          background: "var(--s1)",
          border: "1px solid var(--brd)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="text-center text-[1.4rem] font-bold tracking-[3px] mb-2"
          style={{ color: "var(--acc)" }}
        >
          RUBBERJOINTS
        </div>
        <p className="text-center text-[0.9rem] mb-8" style={{ color: "var(--tx2)" }}>
          Sign in to continue
        </p>

        {error && (
          <div
            className="rounded-lg p-3 mb-5 text-[0.85rem]"
            style={{ background: "rgba(255,59,48,0.1)", color: "var(--red)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-[0.85rem] mb-1.5" style={{ color: "var(--tx2)" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] text-[1rem] outline-none transition-colors duration-150"
              style={{
                background: "var(--s2)",
                border: "1px solid var(--brd)",
                color: "var(--tx)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--acc)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--brd)")}
              autoFocus
            />
          </div>
          <div className="mb-5">
            <label className="block text-[0.85rem] mb-1.5" style={{ color: "var(--tx2)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] text-[1rem] outline-none transition-colors duration-150"
              style={{
                background: "var(--s2)",
                border: "1px solid var(--brd)",
                color: "var(--tx)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--acc)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--brd)")}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-[10px] text-[0.95rem] font-semibold text-white transition-opacity duration-150 disabled:opacity-50"
            style={{ background: "var(--acc)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-[0.9rem] mt-6" style={{ color: "var(--tx2)" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--acc)" }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
