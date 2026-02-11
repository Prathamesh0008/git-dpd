"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setUser(data.user || null);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background px-6 py-12 text-muted">Loading session…</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-background px-6 py-12 text-muted">Redirecting…</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-10 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(226,139,47,0.35),transparent_60%)]" />
        <div className="absolute bottom-10 left-10 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.4),transparent_60%)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">DPD + GLS Logistics</p>
            <h1 className="mt-3 text-3xl font-semibold">Select a provider</h1>
            <p className="mt-2 text-sm text-muted">
              Choose your carrier to manage shipments and create labels.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/dpd")}
            className="group rounded-3xl border border-black/10 bg-panel-strong p-6 text-left shadow-[0_25px_60px_rgba(34,55,88,0.15)] transition hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">DPD SOAP</p>
            <h2 className="mt-3 text-2xl font-semibold">DPD Console</h2>
            <p className="mt-2 text-sm text-muted">
              Shipments, recipients, and label printing in the DPD workflow.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
              Open DPD →
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/gls")}
            className="group rounded-3xl border border-black/10 bg-panel-strong p-6 text-left shadow-[0_25px_60px_rgba(15,118,110,0.18)] transition hover:border-accent"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">GLS REST</p>
            <h2 className="mt-3 text-2xl font-semibold">GLS Console</h2>
            <p className="mt-2 text-sm text-muted">
              Create GLS labels with a blue themed workspace.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
              Open GLS →
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}

