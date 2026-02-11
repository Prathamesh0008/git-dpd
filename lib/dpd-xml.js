import { DPD_TEMPLATE } from "./dpd-constants";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildDpdXml(delivery, printOptions = {}) {
  const name1 = escapeXml(delivery?.name1 || "");
  const street = escapeXml(delivery?.street || "");
  const houseNo = escapeXml(delivery?.houseNo || "");
  const zipCode = escapeXml(delivery?.zipCode || "");
  const city = escapeXml(delivery?.city || "");
  const country = escapeXml(delivery?.countryCode || "NL");

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
