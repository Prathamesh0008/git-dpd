"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GLS_CONTENT_TYPE,
  GLS_ENDPOINT,
  GLS_TEMPLATE,
  base64ToBlob,
  buildGlsPayload,
} from "@/lib/labeling";

const DEFAULT_DELIVERY = {
  name1: "",
  street: "",
  houseNo: "",
  zipCode: "",
  city: "",
  countryCode: "",
  phone: "",
  email: "",
};

const DEFAULT_SETTINGS = {
  label: {
    labelType: "pdf",
    shipType: "P",
    trackingLinkType: "U",
    returnRoutingData: true,
    includeShippingDate: true,
  },
};

export default function GlsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [delivery, setDelivery] = useState(DEFAULT_DELIVERY);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [glsView, setGlsView] = useState("shipments");
  const [glsSearch, setGlsSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [glsLoading, setGlsLoading] = useState(false);

  const [labelUrl, setLabelUrl] = useState("");
  const [labelMeta, setLabelMeta] = useState(null);
  const [labelNotice, setLabelNotice] = useState("");
  const [labelError, setLabelError] = useState("");
  const [labelLoading, setLabelLoading] = useState(false);

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
    loadGlsData();
    loadSettings();
  }, [user]);

  useEffect(() => {
    return () => {
      if (labelUrl) {
        URL.revokeObjectURL(labelUrl);
      }
    };
  }, [labelUrl]);

  const loadGlsData = async () => {
    setGlsLoading(true);
    try {
      const [shipmentsRes, recipientsRes] = await Promise.all([
        fetch("/api/shipments?provider=gls"),
        fetch("/api/recipients?provider=gls"),
      ]);

      const shipmentsData = await shipmentsRes.json();
      const recipientsData = await recipientsRes.json();

      if (shipmentsRes.ok) {
        setShipments(shipmentsData.shipments || []);
      }
      if (recipientsRes.ok) {
        setRecipients(recipientsData.recipients || []);
      }
    } finally {
      setGlsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings?provider=gls");
      const data = await response.json();
      if (response.ok && data.settings) {
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
    } catch (error) {
      // keep defaults
    }
  };

  const filteredShipments = useMemo(() => {
    const query = glsSearch.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((shipment) => {
      const deliveryName = shipment.delivery?.name1 || "";
      const tracking = shipment.trackingNumber || "";
      const city = shipment.delivery?.city || "";
      return `${deliveryName} ${tracking} ${city}`.toLowerCase().includes(query);
    });
  }, [glsSearch, shipments]);

  const filteredRecipients = useMemo(() => {
    const query = glsSearch.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => {
      const address = recipient.address || {};
      const name = address.name1 || "";
      const street = address.street || "";
      const city = address.city || "";
      return `${name} ${street} ${city}`.toLowerCase().includes(query);
    });
  }, [glsSearch, recipients]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleGenerateLabel = async (event) => {
    event.preventDefault();
    setLabelError("");
    setLabelMeta(null);
    setLabelNotice("");
    setLabelLoading(true);

    try {
      const payload = buildGlsPayload(delivery, settings);
      const labelType = settings.label?.labelType || "pdf";
      const expectLabel = labelType !== "None";

      const response = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gls",
          endpointPath: GLS_ENDPOINT,
          payload,
          contentType: GLS_CONTENT_TYPE,
          labelType,
          expectLabel,
          delivery,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create label.");
      }

      if (!data.labelBase64) {
        if (labelUrl) {
          URL.revokeObjectURL(labelUrl);
        }
        setLabelUrl("");
        setLabelMeta(null);
        setLabelNotice("Routing data returned. No label file for the selected label type.");
        loadGlsData();
        return;
      }

      const contentType = data.contentType || "application/pdf";
      const extension = contentType.includes("zpl") ? "zpl" : "pdf";
      const blob = base64ToBlob(data.labelBase64, contentType);

      if (labelUrl) {
        URL.revokeObjectURL(labelUrl);
      }

      const url = URL.createObjectURL(blob);
      setLabelUrl(url);
      setLabelMeta({
        trackingNumber: data.trackingNumber || "",
        filename: `label_gls_${Date.now()}.${extension}`,
      });

      loadGlsData();
    } catch (error) {
      setLabelError(error.message || "Failed to create label.");
    } finally {
      setLabelLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  };

  const applyDeliveryAddress = (address) => {
    if (!address) return;
    setDelivery({ ...delivery, ...address });
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a1e3c] px-6 py-12 text-blue-100">Loading session...</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#0a1e3c] px-6 py-12 text-blue-100">Redirecting...</div>;
  }

  const pickup = GLS_TEMPLATE.addresses?.pickupAddress || {};

  return (
    <div className="min-h-screen bg-[#0a1e3c] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col bg-[#0b254f] text-white">
          <div className="flex items-center gap-3 px-6 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/20 text-lg font-semibold">
              GLS
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em]">GLS</p>
              <p className="text-sm text-blue-200/70">Console</p>
            </div>
          </div>
          <nav className="flex-1 px-4">
            {["shipments", "recipients"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGlsView(item)}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                  glsView === item ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-blue-200" />
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push("/gls/settings")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-blue-200" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-blue-200" />
              Switch provider
            </button>
          </nav>
          <div className="px-6 py-4 text-xs text-blue-100/70">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-blue-200/60">Pickup address</p>
              <div className="mt-2 space-y-1 text-xs text-blue-100/80">
                <p className="font-semibold text-white">{pickup.name1 || "Pickup"}</p>
                <p className="break-words">{pickup.street || ""} {pickup.houseNo || ""}</p>
                <p className="break-words">{pickup.zipCode || ""} {pickup.city || ""}</p>
                <p className="break-words">{pickup.countryCode || ""}</p>
              </div>
              <div className="mt-3 border-t border-white/10 pt-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-blue-200/60">Signed in</p>
                <p className="mt-1 break-words text-xs font-semibold text-white">{user.name || user.email}</p>
              </div>
            </div>
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
              <h1 className="text-2xl font-semibold capitalize">{glsView}</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-200/70">
              <span className="rounded-full border border-blue-200/30 px-3 py-1">
                Ship type {settings.label?.shipType || "P"}
              </span>
              <span className="rounded-full border border-blue-200/30 px-3 py-1">
                Label {settings.label?.labelType || "pdf"}
              </span>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:p-8">
            <section className="w-full lg:w-[320px] lg:shrink-0">
              <div className="mb-4 flex items-center justify-between text-xs text-blue-200/70">
                <span className="uppercase tracking-[0.2em]">{glsView}</span>
                {glsLoading && <span>Loading...</span>}
              </div>
              <input
                value={glsSearch}
                onChange={(event) => setGlsSearch(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                placeholder={`Search ${glsView}`}
              />
              <div className="mt-3 max-h-[420px] lg:max-h-[520px] space-y-3 overflow-auto">
                {glsView === "shipments" ? (
                  filteredShipments.length ? (
                    filteredShipments.map((shipment) => (
                      <button
                        key={shipment.id}
                        type="button"
                        onClick={() => applyDeliveryAddress(shipment.delivery)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs shadow-sm transition hover:border-blue-200/40"
                      >
                        <p className="text-sm font-semibold">
                          {shipment.delivery?.name1 || "Unknown recipient"}
                        </p>
                        <p className="mt-1 text-xs text-blue-200/70">
                          {shipment.delivery?.street || ""} {shipment.delivery?.houseNo || ""},
                          {" "}{shipment.delivery?.zipCode || ""} {shipment.delivery?.city || ""}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-blue-200/70">
                          <span>{formatDate(shipment.createdAt)}</span>
                          {shipment.trackingNumber && (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase">
                              {shipment.trackingNumber}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-blue-200/70">No shipments yet.</p>
                  )
                ) : filteredRecipients.length ? (
                  filteredRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => applyDeliveryAddress(recipient.address)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs shadow-sm transition hover:border-blue-200/40"
                    >
                      <p className="text-sm font-semibold">
                        {recipient.address?.name1 || "Recipient"}
                      </p>
                      <p className="mt-1 text-xs text-blue-200/70">
                        {recipient.address?.street || ""} {recipient.address?.houseNo || ""},
                        {" "}{recipient.address?.zipCode || ""} {recipient.address?.city || ""}
                      </p>
                      <p className="mt-2 text-[11px] text-blue-200/70">
                        Last used {formatDate(recipient.updatedAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-blue-200/70">No recipients saved.</p>
                )}
              </div>
            </section>

            <section className="flex-1">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Recipient details</p>
                <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleGenerateLabel}>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Recipient name</label>
                    <input
                      value={delivery.name1}
                      onChange={(event) => setDelivery({ ...delivery, name1: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Street</label>
                    <input
                      value={delivery.street}
                      onChange={(event) => setDelivery({ ...delivery, street: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">House No</label>
                    <input
                      value={delivery.houseNo}
                      onChange={(event) => setDelivery({ ...delivery, houseNo: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">ZIP Code</label>
                    <input
                      value={delivery.zipCode}
                      onChange={(event) => setDelivery({ ...delivery, zipCode: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">City</label>
                    <input
                      value={delivery.city}
                      onChange={(event) => setDelivery({ ...delivery, city: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Country</label>
                    <input
                      value={delivery.countryCode}
                      onChange={(event) => setDelivery({ ...delivery, countryCode: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Phone</label>
                    <input
                      value={delivery.phone}
                      onChange={(event) => setDelivery({ ...delivery, phone: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Email</label>
                    <input
                      type="email"
                      value={delivery.email}
                      onChange={(event) => setDelivery({ ...delivery, email: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 focus:border-blue-200 focus:outline-none"
                    />
                  </div>

                  {labelError && (
                    <div className="md:col-span-2 rounded-xl border border-red-200/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {labelError}
                    </div>
                  )}

                  {labelNotice && (
                    <div className="md:col-span-2 rounded-xl border border-blue-200/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                      {labelNotice}
                    </div>
                  )}

                  <div className="md:col-span-2 flex items-center justify-between">
                    {labelMeta && labelUrl && (
                      <a
                        href={labelUrl}
                        download={labelMeta.filename}
                        className="inline-flex items-center justify-center rounded-full border border-blue-200/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-100"
                      >
                        Download label
                      </a>
                    )}
                    <button
                      type="submit"
                      disabled={labelLoading}
                      className="rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-400 disabled:opacity-60"
                    >
                      {labelLoading ? "Generating..." : "Generate label"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

