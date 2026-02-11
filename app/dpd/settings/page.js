"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_SETTINGS = {
  print: {
    paperSize: "A4",
    a4StartPosition: "Bottom right",
    rememberLastA4Position: true,
    showPositionDialog: true,
    dropOffType: "FULL_LABEL",
    printerLanguage: "PDF",
    printNote: false,
    senderNote: "",
    senderNoteBeforeAddress: false,
    labelEnlargePart: "None",
    sortOrderLabels: "Date of creation",
    printRecipientReferenceId: false,
    printReference2OnProtocol: false,
    hideUsernameOnProtocol: false,
    acceptanceSortOrder: "Consignee Zip",
  },
};

const SETTINGS_MENU = [
  "Basic",
  "Print",
  "Shipments import",
  "Routing database",
  "Configurations",
  "User management",
  "System information",
];

export default function DpdSettingsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Print");
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
    fetch("/api/settings?provider=dpd")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const updatePrint = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      print: {
        ...prev.print,
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
          provider: "dpd",
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
    return <div className="min-h-screen bg-[#eee9e3] px-6 py-12 text-[#6f6a63]">Loading session...</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#eee9e3] px-6 py-12 text-[#6f6a63]">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-[#eee9e3] text-[#2c2a29]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col bg-[#7e7a75] text-white">
          <div className="flex items-center gap-3 px-6 py-5">
            <div className="flex h-16 w-full items-center rounded-xl pl-2">
              <Image src="/dpd-logo.svg" alt="DPD" width={60} height={50} sizes="500px" />
            </div>
          </div>
          <nav className="flex-1 px-4">
            <button
              type="button"
              onClick={() => router.push("/dpd")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
              Shipments
            </button>
            <button
              type="button"
              onClick={() => router.push("/dpd")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
              Recipients
            </button>
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-left text-sm text-white"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
              Switch provider
            </button>
          </nav>
          <div className="px-6 py-4 text-xs text-white/70">
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
          <header className="flex flex-col gap-3 border-b border-black/10 bg-[#f6f2ec] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#6f6a63]">DPD</p>
              <h1 className="text-2xl font-semibold">Settings</h1>
            </div>
            <div className="flex items-center gap-3">
              {status && (
                <span className="text-xs text-[#6f6a63]">{status}</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-[#c1002a] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:p-8">
            <aside className="w-full lg:w-[220px] lg:shrink-0">
              <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                {SETTINGS_MENU.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveMenu(item)}
                    className={`mb-2 w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                      activeMenu === item
                        ? "bg-[#c1002a]/10 text-[#c1002a]"
                        : "text-[#6f6a63] hover:bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex-1">
              {activeMenu !== "Print" ? (
                <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-[#6f6a63]">
                  {activeMenu} settings will be added here.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-white p-6">
                    <h2 className="text-sm font-semibold">Print labels</h2>
                    <div className="mt-4 space-y-4 text-sm text-[#6f6a63]">
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Label output</label>
                        <select
                          value={settings.print.dropOffType}
                          onChange={(event) => updatePrint("dropOffType", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option value="FULL_LABEL">PDF label</option>
                          <option value="QR_CODE">QR code only</option>
                          <option value="BOTH">PDF + QR code</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Paper size for labels printing</label>
                        <select
                          value={settings.print.paperSize}
                          onChange={(event) => updatePrint("paperSize", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option value="A4">A4</option>
                          <option value="A6">Label printer (A6)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">A4 paper print start position</label>
                        <select
                          value={settings.print.a4StartPosition}
                          onChange={(event) => updatePrint("a4StartPosition", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option>Bottom right</option>
                          <option>Top left</option>
                          <option>Top right</option>
                          <option>Bottom left</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.rememberLastA4Position}
                          onChange={(event) => updatePrint("rememberLastA4Position", event.target.checked)}
                        />
                        Remember last A4 paper print position
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.showPositionDialog}
                          onChange={(event) => updatePrint("showPositionDialog", event.target.checked)}
                        />
                        Show label position dialog when position is not remembered
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.printNote}
                          onChange={(event) => updatePrint("printNote", event.target.checked)}
                        />
                        Print note on labels
                      </label>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Sender note on the label</label>
                        <input
                          value={settings.print.senderNote}
                          onChange={(event) => updatePrint("senderNote", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        />
                      </div>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.senderNoteBeforeAddress}
                          onChange={(event) => updatePrint("senderNoteBeforeAddress", event.target.checked)}
                        />
                        Sender note is before address
                      </label>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Part of labels to be printed larger</label>
                        <select
                          value={settings.print.labelEnlargePart}
                          onChange={(event) => updatePrint("labelEnlargePart", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option>None</option>
                          <option>Recipient</option>
                          <option>Reference</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Sort order for labels</label>
                        <select
                          value={settings.print.sortOrderLabels}
                          onChange={(event) => updatePrint("sortOrderLabels", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option>Date of creation</option>
                          <option>Recipient name</option>
                          <option>Zip code</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-6">
                    <h2 className="text-sm font-semibold">Print protocols</h2>
                    <div className="mt-4 space-y-4 text-sm text-[#6f6a63]">
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.printRecipientReferenceId}
                          onChange={(event) => updatePrint("printRecipientReferenceId", event.target.checked)}
                        />
                        Print recipient reference ID
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.printReference2OnProtocol}
                          onChange={(event) => updatePrint("printReference2OnProtocol", event.target.checked)}
                        />
                        Print reference 2 on acceptance protocols
                      </label>
                      <label className="flex items-center gap-3 text-xs">
                        <input
                          type="checkbox"
                          checked={settings.print.hideUsernameOnProtocol}
                          onChange={(event) => updatePrint("hideUsernameOnProtocol", event.target.checked)}
                        />
                        Hide username on the protocol
                      </label>
                      <div>
                        <label className="text-xs uppercase tracking-[0.2em]">Sort order for acceptance protocol</label>
                        <select
                          value={settings.print.acceptanceSortOrder}
                          onChange={(event) => updatePrint("acceptanceSortOrder", event.target.value)}
                          className="mt-2 w-full rounded-xl border border-black/10 bg-[#f3f2f1] px-3 py-2"
                        >
                          <option>Consignee Zip</option>
                          <option>Recipient name</option>
                          <option>Date of creation</option>
                        </select>
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
