"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.user) {
          router.push("/dashboard");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isMounted) return;
        setChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-background px-6 py-12 text-muted">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-10 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(226,139,47,0.35),transparent_60%)]" />
        <div className="absolute bottom-10 left-10 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.4),transparent_60%)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <div className="rounded-3xl border border-black/10 bg-panel-strong p-8 shadow-[0_25px_60px_rgba(34,55,88,0.15)]">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">DPD + GLS Logistics</p>
            <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
            <p className="mt-2 text-sm text-muted">Access the label workspace.</p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">User ID</label>
              <input
                type="text"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="ops1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-accent-strong disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
