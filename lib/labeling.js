"use client";

import { DPD_TEMPLATE } from "./dpd-constants";

export const GLS_ENDPOINT = "/Label/Create?api-version=1.0";
export const GLS_CONTENT_TYPE = "application/json-patch+json";
export const GLS_LABEL_TYPE = "pdf";

export const GLS_TEMPLATE = {
  shippingSystemName: "ASB Logistics",
  shippingSystemVersion: "1.0",
  shiptype: "p",
  customerSubjectName: "",
  reference: "ORD-10001",
  trackingLinkType: "u",
  units: [
    {
      unitId: "1",
      unitType: "co",
      customerUnitReference: "ORD-10001",
      weight: 2.5,
      dimensions: {
        length: 30,
        width: 20,
        height: 10,
      },
      additionalInfo1: "Web order",
      additionalInfo2: "Handle with care",
    },
  ],
  labelA4StartPosition: null,
  labelA4MoveXMm: null,
  labelA4MoveYMm: null,
  returnRoutingData: true,
  addresses: {
    pickupAddress: {
      name1: "ASB Logistics",
      street: "Logisticsstraat",
      houseNo: "10",
      zipCode: "1012LG",
      city: "Amsterdam",
      countryCode: "NL",
      contact: "Warehouse",
      phone: "+31201234567",
      email: "warehouse@asblogistics.nl",
    },
    deliveryAddress: {
      name1: "John Doe",
      street: "Damrak",
      houseNo: "1",
      zipCode: "1012LG",
      city: "Amsterdam",
      countryCode: "NL",
      contact: "John Doe",
      phone: "+31612345678",
      email: "john.doe@example.com",
      addresseeType: "b",
    },
  },
  services: {
    economyParcel: true,
    expressService: "none",
  },
};

export function base64ToBlob(base64, contentType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildDpdXml(delivery, printOptions = {}) {
  const name1 = escapeXml(delivery.name1 || "");
  const street = escapeXml(delivery.street || "");
  const houseNo = escapeXml(delivery.houseNo || "");
  const zipCode = escapeXml(delivery.zipCode || "");
  const city = escapeXml(delivery.city || "");
  const country = escapeXml(delivery.countryCode || "NL");

  const houseNoLine = houseNo ? `<houseNo>${houseNo}</houseNo>` : "";
  const paperFormat = printOptions.paperSize === "A4" ? "A4" : "A6";
  const dropOffType = printOptions.dropOffType || "FULL_LABEL";
  const printerLanguage = printOptions.printerLanguage || "PDF";

  return `<v1:storeOrders xmlns:v1="http://dpd.com/common/service/types/ShipmentService/3.5">
  <printOptions>
    <printerLanguage>${escapeXml(printerLanguage)}</printerLanguage>
    <paperFormat>${escapeXml(paperFormat)}</paperFormat>
    <dropOffType>${escapeXml(dropOffType)}</dropOffType>
  </printOptions>
  <order>
    <generalShipmentData>
      <sendingDepot>${escapeXml(DPD_TEMPLATE.sendingDepot)}</sendingDepot>
      <product>${escapeXml(DPD_TEMPLATE.product)}</product>
      <sender>
        <name1>${escapeXml(DPD_TEMPLATE.sender.name1)}</name1>
        <street>${escapeXml(DPD_TEMPLATE.sender.street)}</street>
        <country>${escapeXml(DPD_TEMPLATE.sender.country)}</country>
        <zipCode>${escapeXml(DPD_TEMPLATE.sender.zipCode)}</zipCode>
        <city>${escapeXml(DPD_TEMPLATE.sender.city)}</city>
      </sender>
      <recipient>
        <name1>${name1}</name1>
        <street>${street}</street>
        ${houseNoLine}
        <country>${country}</country>
        <zipCode>${zipCode}</zipCode>
        <city>${city}</city>
      </recipient>
    </generalShipmentData>
    <parcels>
      <weight>${escapeXml(DPD_TEMPLATE.parcelWeight)}</weight>
    </parcels>
    <productAndServiceData>
      <orderType>${escapeXml(DPD_TEMPLATE.orderType)}</orderType>
    </productAndServiceData>
  </order>
</v1:storeOrders>`;
}

export function buildGlsPayload(delivery, settings = {}) {
  const deliveryAddress = {
    ...GLS_TEMPLATE.addresses.deliveryAddress,
    ...delivery,
    contact: delivery.contact || delivery.name1 || GLS_TEMPLATE.addresses.deliveryAddress.contact,
  };

  const nextPayload = {
    ...GLS_TEMPLATE,
    addresses: {
      ...GLS_TEMPLATE.addresses,
      deliveryAddress,
    },
  };

  const labelSettings = settings.label || {};
  if (labelSettings.labelType) {
    const labelTypeValue = String(labelSettings.labelType);
    nextPayload.labelType = labelTypeValue === "None" ? "None" : labelTypeValue.toLowerCase();
  }
  if (labelSettings.shipType) {
    nextPayload.shiptype = String(labelSettings.shipType).toUpperCase();
  }
  if (labelSettings.trackingLinkType) {
    nextPayload.trackingLinkType = String(labelSettings.trackingLinkType).toUpperCase();
  }
  if (typeof labelSettings.returnRoutingData === "boolean") {
    nextPayload.returnRoutingData = labelSettings.returnRoutingData ? "Y" : "N";
  }
  if (labelSettings.includeShippingDate) {
    nextPayload.shippingDate = new Date().toISOString().slice(0, 10);
  }

  return nextPayload;
}
