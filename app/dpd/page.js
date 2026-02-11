"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { base64ToBlob, buildDpdXml } from "@/lib/labeling";
import { DPD_TEMPLATE } from "@/lib/dpd-constants";

export default function DpdPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [delivery, setDelivery] = useState({
    name1: "",
    street: "",
    houseNo: "",
    zipCode: "",
    city: "",
    countryCode: "",
    phone: "",
    email: "",
  });
  const [settings, setSettings] = useState({
    print: {
      paperSize: "A4",
      dropOffType: "FULL_LABEL",
      printerLanguage: "PDF",
    },
  });
  const [dpdView, setDpdView] = useState("shipments");
  const [dpdSearch, setDpdSearch] = useState("");
  const [shipments, setShipments] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [dpdLoading, setDpdLoading] = useState(false);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);
  const [bulkLabelUrl, setBulkLabelUrl] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [labelUrl, setLabelUrl] = useState("");
  const [labelMeta, setLabelMeta] = useState(null);
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
    loadDpdData();
    loadSettings();
  }, [user]);

  useEffect(() => {
    return () => {
      if (labelUrl) {
        URL.revokeObjectURL(labelUrl);
      }
      if (bulkLabelUrl) {
        URL.revokeObjectURL(bulkLabelUrl);
      }
    };
  }, [labelUrl, bulkLabelUrl]);

  const loadDpdData = async () => {
    setDpdLoading(true);
    try {
      const [shipmentsRes, recipientsRes] = await Promise.all([
        fetch("/api/shipments?provider=dpd"),
        fetch("/api/recipients?provider=dpd"),
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
      setDpdLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings?provider=dpd");
      const data = await response.json();
      if (response.ok && data.settings) {
        setSettings((prev) => ({
          ...prev,
          ...data.settings,
          print: {
            ...prev.print,
            ...(data.settings.print || {}),
          },
        }));
      }
    } catch (error) {
      // keep defaults
    }
  };

  const filteredShipments = useMemo(() => {
    const query = dpdSearch.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((shipment) => {
      const deliveryName = shipment.delivery?.name1 || "";
      const tracking = shipment.trackingNumber || "";
      const city = shipment.delivery?.city || "";
      return `${deliveryName} ${tracking} ${city}`.toLowerCase().includes(query);
    });
  }, [dpdSearch, shipments]);

  const filteredRecipients = useMemo(() => {
    const query = dpdSearch.trim().toLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) => {
      const address = recipient.address || {};
      const name = address.name1 || "";
      const street = address.street || "";
      const city = address.city || "";
      return `${name} ${street} ${city}`.toLowerCase().includes(query);
    });
  }, [dpdSearch, recipients]);

  const selectedShipments = useMemo(
    () => shipments.filter((shipment) => selectedShipmentIds.includes(shipment.id)),
    [shipments, selectedShipmentIds]
  );

  const toggleShipment = (id) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllShipments = () => {
    if (!filteredShipments.length) return;
    const allIds = filteredShipments.map((shipment) => shipment.id);
    const allSelected = allIds.every((id) => selectedShipmentIds.includes(id));
    setSelectedShipmentIds(allSelected ? [] : allIds);
  };

  const handleBulkPrint = async () => {
    if (!selectedShipments.length) return;
    setBulkLoading(true);
    setLabelError("");
    try {
      const response = await fetch("/api/dpd/bulk-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveries: selectedShipments.map((shipment) => shipment.delivery),
          printSettings: settings.print,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Bulk print failed.");
      }

      const blob = base64ToBlob(data.labelBase64, "application/pdf");
      if (bulkLabelUrl) {
        URL.revokeObjectURL(bulkLabelUrl);
      }
      const url = URL.createObjectURL(blob);
      setBulkLabelUrl(url);
    } catch (error) {
      setLabelError(error.message || "Bulk print failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const handleGenerateLabel = async (event) => {
    event.preventDefault();
    setLabelError("");
    setLabelMeta(null);
    setLabelLoading(true);

    try {
      const xmlBody = buildDpdXml(delivery, settings.print);
      const response = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "dpd",
          xmlBody,
          useValidate: false,
          expectLabel: true,
          delivery,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create label.");
      }

      const contentType = data.contentType || "application/pdf";
      const blob = base64ToBlob(data.labelBase64, contentType);
      const extension = contentType.includes("png") ? "png" : "pdf";

      if (labelUrl) {
        URL.revokeObjectURL(labelUrl);
      }

      const url = URL.createObjectURL(blob);
      setLabelUrl(url);
      setLabelMeta({
        trackingNumber: data.trackingNumber || "",
        filename: `label_dpd_${Date.now()}.${extension}`,
      });

      loadDpdData();
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
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white">
              <Image src="/dpd-logo.svg" alt="DPD" width={40} height={40} sizes="40px" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em]">DPD</p>
              <p className="text-sm text-white/80">Console</p>
            </div>
          </div>
          <nav className="flex-1 px-4">
            {["shipments", "recipients"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDpdView(item)}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                  dpdView === item ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white/80" />
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push("/dpd/settings")}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Pickup address</p>
            <div className="mt-2 text-xs text-white/80">
              <p className="font-semibold">{DPD_TEMPLATE.sender.name1}</p>
              <p>{DPD_TEMPLATE.sender.street}</p>
              <p>{DPD_TEMPLATE.sender.zipCode} {DPD_TEMPLATE.sender.city}</p>
              <p>{DPD_TEMPLATE.sender.country}</p>
            </div>
            <div className="mt-4">
              <p className="font-semibold">{user.name || user.email}</p>
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
          <header className="flex flex-col gap-3 border-b border-black/10 bg-[#f6f2ec] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#6f6a63]">DPD</p>
              <h1 className="text-2xl font-semibold capitalize">{dpdView}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6f6a63]">
              <span className="rounded-full border border-black/10 px-3 py-1">{DPD_TEMPLATE.product}</span>
              <span className="rounded-full border border-black/10 px-3 py-1">Depot {DPD_TEMPLATE.sendingDepot}</span>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:p-8">
            <section className="w-full lg:w-[320px] lg:shrink-0">
              <div className="mb-4 flex items-center justify-between text-xs text-[#6f6a63]">
                <span className="uppercase tracking-[0.2em]">{dpdView}</span>
                {dpdLoading && <span>Loading...</span>}
              </div>
              {dpdView === "shipments" && (
                <>
                  <div className="mb-3 flex items-center justify-between text-[11px] text-[#6f6a63]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        filteredShipments.length > 0 &&
                        filteredShipments.every((shipment) =>
                          selectedShipmentIds.includes(shipment.id)
                        )
                      }
                      onChange={toggleAllShipments}
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    onClick={handleBulkPrint}
                    disabled={!selectedShipments.length || bulkLoading}
                    className="rounded-full bg-[#c1002a] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {bulkLoading ? "Printing..." : `Bulk print (${selectedShipments.length})`}
                  </button>
                  </div>
                  {bulkLabelUrl && (
                    <a
                      href={bulkLabelUrl}
                      download={`dpd_bulk_${Date.now()}.pdf`}
                      className="mb-3 inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-[#c1002a]"
                    >
                      Download bulk PDF
                    </a>
                  )}
                </>
              )}
              <input
                value={dpdSearch}
                onChange={(event) => setDpdSearch(event.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:border-[#c1002a] focus:outline-none"
                placeholder={`Search ${dpdView}`}
              />
              <div className="mt-3 max-h-[420px] lg:max-h-[520px] space-y-3 overflow-auto">
                {dpdView === "shipments" ? (
                  filteredShipments.length ? (
                    filteredShipments.map((shipment) => (
                      <button
                        key={shipment.id}
                        type="button"
                        onClick={() => applyDeliveryAddress(shipment.delivery)}
                        className={`w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-xs shadow-sm transition ${
                          selectedShipmentIds.includes(shipment.id) ? "border-[#c1002a]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedShipmentIds.includes(shipment.id)}
                            onChange={() => toggleShipment(shipment.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                          <p className="text-sm font-semibold">
                            {shipment.delivery?.name1 || "Unknown recipient"}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[#6f6a63]">
                          {shipment.delivery?.street || ""} {shipment.delivery?.houseNo || ""},
                          {" "}{shipment.delivery?.zipCode || ""} {shipment.delivery?.city || ""}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[#6f6a63]">
                          <span>{formatDate(shipment.createdAt)}</span>
                          {shipment.trackingNumber && (
                            <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase">
                              {shipment.trackingNumber}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#6f6a63]">No shipments yet.</p>
                  )
                ) : filteredRecipients.length ? (
                  filteredRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => applyDeliveryAddress(recipient.address)}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-left text-xs shadow-sm"
                    >
                      <p className="text-sm font-semibold">
                        {recipient.address?.name1 || "Recipient"}
                      </p>
                      <p className="mt-1 text-xs text-[#6f6a63]">
                        {recipient.address?.street || ""} {recipient.address?.houseNo || ""},
                        {" "}{recipient.address?.zipCode || ""} {recipient.address?.city || ""}
                      </p>
                      <p className="mt-2 text-[11px] text-[#6f6a63]">
                        Last used {formatDate(recipient.updatedAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-[#6f6a63]">No recipients saved.</p>
                )}
              </div>
            </section>

            <section className="flex-1">
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Delivery address</p>
                <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleGenerateLabel}>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Name</label>
                    <input
                      value={delivery.name1}
                      onChange={(event) => setDelivery({ ...delivery, name1: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Street</label>
                    <input
                      value={delivery.street}
                      onChange={(event) => setDelivery({ ...delivery, street: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">House No</label>
                    <input
                      value={delivery.houseNo}
                      onChange={(event) => setDelivery({ ...delivery, houseNo: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">ZIP Code</label>
                    <input
                      value={delivery.zipCode}
                      onChange={(event) => setDelivery({ ...delivery, zipCode: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">City</label>
                    <input
                      value={delivery.city}
                      onChange={(event) => setDelivery({ ...delivery, city: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Country</label>
                    <input
                      value={delivery.countryCode}
                      onChange={(event) => setDelivery({ ...delivery, countryCode: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Phone</label>
                    <input
                      value={delivery.phone}
                      onChange={(event) => setDelivery({ ...delivery, phone: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a63]">Email</label>
                    <input
                      type="email"
                      value={delivery.email}
                      onChange={(event) => setDelivery({ ...delivery, email: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#c1002a] focus:outline-none"
                    />
                  </div>

                  {labelError && (
                    <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {labelError}
                    </div>
                  )}

                  <div className="md:col-span-2 flex items-center justify-between">
                    {labelMeta && labelUrl && (
                      <a
                        href={labelUrl}
                        download={labelMeta.filename}
                        className="inline-flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#c1002a]"
                      >
                        Download label
                      </a>
                    )}
                    <button
                      type="submit"
                      disabled={labelLoading}
                      className="rounded-full bg-[#c1002a] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#a10023] disabled:opacity-60"
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



