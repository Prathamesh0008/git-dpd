"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_SETTINGS = {
  label: {
    labelType: "pdf",
    shipType: "P",
    trackingLinkType: "U",
    returnRoutingData: true,
    includeShippingDate: true,
  },
};

const SETTINGS_MENU = ["Label", "Tracking", "Advanced", "System information"];

const LABEL_TYPES = [
  { value: "pdf", label: "PDF (Unit)" },
  { value: "zpl", label: "ZPL (Unit)" },
  { value: "pdfa6u", label: "PDF A6 (Unit)" },
  { value: "pdfa6s", label: "PDF A6 (Shipment)" },
  { value: "pdfroutingonly", label: "PDF Routing Only" },
  { value: "pdf2a4", label: "PDF 2xA4" },
  { value: "pdf4a4", label: "PDF 4xA4" },
  { value: "None", label: "None (Routing data only)" },
];

export default function GlsSettingsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Label");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

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

  useEffect(() => {
    if (!user) return;
    fetch("/api/settings?provider=gls")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          const labelSettings = data.settings.label || {};
          const normalizedLabelType =
            labelSettings.labelType === "None"
              ? "None"
              : labelSettings.labelType
                ? String(labelSettings.labelType).toLowerCase()
                : undefined;

          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            label: {
              ...prev.label,
              ...labelSettings,
              labelType: normalizedLabelType || prev.label.labelType,
              shipType: labelSettings.shipType ? String(labelSettings.shipType).toUpperCase() : prev.label.shipType,
              trackingLinkType: labelSettings.trackingLinkType
                ? String(labelSettings.trackingLinkType).toUpperCase()
                : prev.label.trackingLinkType,
              returnRoutingData:
                typeof labelSettings.returnRoutingData === "boolean"
                  ? labelSettings.returnRoutingData
                  : prev.label.returnRoutingData,
              includeShippingDate:
                typeof labelSettings.includeShippingDate === "boolean"
                  ? labelSettings.includeShippingDate
                  : prev.label.includeShippingDate,
            },
          }));
        }
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const updateLabel = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      label: {
        ...prev.label,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gls",
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings.");
      }

      setStatus("Saved");
    } catch (error) {
      setStatus(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a1e3c] px-6 py-12 text-blue-100">Loading session…</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#0a1e3c] px-6 py-12 text-blue-100">Redirecting…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a1e3c] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col bg-[#0b254f] text-white">
          <div className="flex items-center gap-3 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/20 text-lg font-semibold">
              G
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em]">GLS</p>
              <p className="text-sm text-blue-200/70">Settings</p>
            </div>
          </div>
          <nav className="flex-1 px-4">
            <button
              type="button"
              onClick={() => router.push("/gls")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-blue-100/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-blue-200/70" />
              Labels
            </button>
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-left text-sm text-white"
            >
              <span className="h-2 w-2 rounded-full bg-blue-200" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-blue-100/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-blue-200/70" />
              Switch provider
            </button>
          </nav>
          <div className="px-6 py-4 text-xs text-blue-100/70">
            <p className="font-semibold">{user.name || user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-lg bg-white/15 px-3 py-2 text-xs uppercase tracking-wide text-white"
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="flex flex-col gap-3 border-b border-white/10 bg-[#0f2b57] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-200">GLS</p>
              <h1 className="text-2xl font-semibold">Settings</h1>
            </div>
            <div className="flex items-center gap-3">
              {status && (
                <span className="text-xs text-blue-200">{status}</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:p-8">
            <aside className="w-full lg:w-[220px] lg:shrink-0">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                {SETTINGS_MENU.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveMenu(item)}
                    className={`mb-2 w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                      activeMenu === item
                        ? "bg-blue-500/20 text-blue-100"
                        : "text-blue-200/70 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex-1">
              {activeMenu !== "Label" ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-blue-200/80">
                  {activeMenu} settings will be added here.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold">Label output</h2>
                    <div className="mt-4 space-y-4 text-sm text-blue-200/80">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Label type</label>
                        <select
                          value={settings.label.labelType}
                          onChange={(event) => updateLabel("labelType", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white"
                        >
                          {LABEL_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Ship type</label>
                        <select
                          value={settings.label.shipType}
                          onChange={(event) => updateLabel("shipType", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white"
                        >
                          <option value="P">Parcel</option>
                          <option value="F">Freight</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Tracking link type</label>
                        <select
                          value={settings.label.trackingLinkType}
                          onChange={(event) => updateLabel("trackingLinkType", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white"
                        >
                          <option value="U">Unit</option>
                          <option value="S">Shipment</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold">Routing data</h2>
                    <div className="mt-4 space-y-4 text-sm text-blue-200/80">
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.label.returnRoutingData}
                          onChange={(event) => updateLabel("returnRoutingData", event.target.checked)}
                        />
                        Return routing data (barcode fields)
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.label.includeShippingDate}
                          onChange={(event) => updateLabel("includeShippingDate", event.target.checked)}
                        />
                        Include shipping date in request
                      </label>
                      <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-xs">
                        Shipping date defaults to today when enabled.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

