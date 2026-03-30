"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.ok) {
      router.push("/ai");
    } else {
      setError(data.error || "Registration failed");
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--s2)",
    border: "1px solid var(--brd)",
    color: "var(--tx)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
      <div
        className="w-full max-w-[380px] p-8 rounded-2xl"
        style={{
          background: "var(--s1)",
          border: "1px solid var(--brd)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="text-center text-[1.4rem] font-bold tracking-[3px] mb-2" style={{ color: "var(--acc)" }}>
          RUBBERJOINTS
        </div>
        <p className="text-center text-[0.9rem] mb-8" style={{ color: "var(--tx2)" }}>
          Create your account
        </p>

        {error && (
          <div className="rounded-lg p-3 mb-5 text-[0.85rem]" style={{ background: "rgba(255,59,48,0.1)", color: "var(--red)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            { label: "Username", value: username, set: setUsername, type: "text", placeholder: "3+ characters" },
            { label: "Password", value: password, set: setPassword, type: "password", placeholder: "6+ characters" },
            { label: "Confirm Password", value: confirm, set: setConfirm, type: "password", placeholder: "" },
          ].map((f) => (
            <div key={f.label} className="mb-5">
              <label className="block text-[0.85rem] mb-1.5" style={{ color: "var(--tx2)" }}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3.5 py-3 rounded-[10px] text-[1rem] outline-none transition-colors duration-150"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--acc)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--brd)")}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-[10px] text-[0.95rem] font-semibold text-white transition-opacity duration-150 disabled:opacity-50"
            style={{ background: "var(--acc)" }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-[0.9rem] mt-6" style={{ color: "var(--tx2)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--acc)" }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
