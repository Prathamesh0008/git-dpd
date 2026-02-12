"use client";

import { DPD_TEMPLATE } from "./dpd-constants";

export const GLS_ENDPOINT = "/Label/Create?api-version=1.0";
export const GLS_CONTENT_TYPE = "application/json";
export const GLS_LABEL_TYPE = "pdf";

export const GLS_TEMPLATE = {
  shippingSystemName: "ASB Logistics WebApp",
  shippingSystemVersion: "1.0.0",
  shiptype: "p",
  reference: "ORDER-100245",
  trackingLinkType: "u",
  units: [
    {
      unitId: "1",
      unitType: "co",
      customerUnitReference: "BOX-1",
      weight: 2.5,
      dimensions: {
        length: 30,
        width: 20,
        height: 15,
      },
      additionalInfo1: "Fragile",
      additionalInfo2: "Handle with care",
    },
  ],
  labelType: "zpl",
  labelA4StartPosition: 1,
  labelA4MoveXMm: 0,
  labelA4MoveYMm: 0,
  notificationEmail: {
    sendMail: true,
    senderName: "ASB Logistics",
    senderReplyAddress: "support@asblogistics.com",
    senderContactName: "Dispatch Team",
    senderPhoneNo: "+31101234567",
    emailSubject: "Your GLS Shipment Tracking",
    emailAddressCC: "",
    emailAddressBCC: "",
  },
  returnRoutingData: false,
  addresses: {
    pickupAddress: {
      name1: "ASB Logistics BV",
      name2: "",
      name3: "",
      street: "Main Logistics Street",
      houseNo: "12",
      houseNoExt: "",
      zipCode: "1234AB",
      city: "Amsterdam",
      countryCode: "NL",
      contact: "Warehouse Manager",
      phone: "+31101234567",
      email: "dispatch@asblogistics.com",
    },
    deliveryAddress: {
      name1: "John Doe",
      name2: "",
      name3: "",
      street: "Delivery Street",
      houseNo: "45",
      houseNoExt: "",
      zipCode: "5678CD",
      city: "Rotterdam",
      countryCode: "NL",
      contact: "John Doe",
      phone: "+31612345678",
      email: "john.doe@email.com",
      addresseeType: "b",
    },
  },
  services: {
    addresseeOnlyService: false,
    expressService: "none",
    expressConfirmSMS: "",
    economyParcel: false,
    letterBoxParcel: false,
    shopDeliveryService: false,
    shopDeliveryParcelShopId: "",
    shopDeliveryPlusService: false,
    shopReturnService: false,
    saturdayService: false,
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
  if (typeof labelSettings.customerSubjectName === "string") {
    nextPayload.customerSubjectName = labelSettings.customerSubjectName.trim();
  }
  const returnRouting =
    typeof labelSettings.returnRoutingData === "boolean"
      ? labelSettings.returnRoutingData
      : typeof GLS_TEMPLATE.returnRoutingData === "boolean"
        ? GLS_TEMPLATE.returnRoutingData
        : true;
  nextPayload.returnRoutingData = returnRouting;
  if (
    typeof nextPayload.customerSubjectName !== "string" ||
    !nextPayload.customerSubjectName.trim()
  ) {
    delete nextPayload.customerSubjectName;
  }
  if (labelSettings.includeShippingDate) {
    nextPayload.shippingDate = new Date().toISOString().slice(0, 10);
  }

  // A4 positioning options are only valid for A4 multi-label output types.
  const normalizedLabelType = String(nextPayload.labelType || "").toLowerCase();
  const isA4Layout = normalizedLabelType === "pdf2a4" || normalizedLabelType === "pdf4a4";
  if (!isA4Layout) {
    delete nextPayload.labelA4StartPosition;
    delete nextPayload.labelA4MoveXMm;
    delete nextPayload.labelA4MoveYMm;
  }

  return nextPayload;
}
