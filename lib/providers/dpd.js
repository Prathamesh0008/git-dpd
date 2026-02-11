const SOAP_ENV = "http://schemas.xmlsoap.org/soap/envelope/";

function buildDefaultHeader() {
  const delisId = process.env.DPD_DELIS_ID;
  const authToken = process.env.DPD_AUTH_TOKEN;
  const messageLanguage = process.env.DPD_MESSAGE_LANGUAGE || "en_EN";

  if (!delisId || !authToken) {
    return "";
  }

  return `
    <auth:authentication xmlns:auth="http://dpd.com/common/service/types/Authentication/2.0">
      <delisId>${delisId}</delisId>
      <authToken>${authToken}</authToken>
      <messageLanguage>${messageLanguage}</messageLanguage>
    </auth:authentication>
  `;
}

function buildEnvelope(xmlBody, xmlHeader) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_ENV}">
  <soapenv:Header>
    ${xmlHeader || ""}
  </soapenv:Header>
  <soapenv:Body>
    ${xmlBody}
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractFirstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function extractLabel(text) {
  const labelPatterns = [
    { regex: /<parcellabelsPNG_qr>([\s\S]*?)<\/parcellabelsPNG_qr>/i, contentType: "image/png" },
    { regex: /<parcellabelsPDF>([\s\S]*?)<\/parcellabelsPDF>/i, contentType: "application/pdf" },
    { regex: /<parcelLabelsPdf>([\s\S]*?)<\/parcelLabelsPdf>/i, contentType: "application/pdf" },
    { regex: /<pdfData>([\s\S]*?)<\/pdfData>/i, contentType: "application/pdf" },
    { regex: /<labelData>([\s\S]*?)<\/labelData>/i, contentType: "application/pdf" },
    { regex: /<label>([\s\S]*?)<\/label>/i, contentType: "application/pdf" },
    { regex: /<labelContent>([\s\S]*?)<\/labelContent>/i, contentType: "application/pdf" },
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern.regex);
    if (match && match[1]) {
      return {
        labelBase64: match[1].replace(/\s+/g, ""),
        contentType: pattern.contentType,
      };
    }
  }

  return null;
}

function extractTrackingNumber(text) {
  const trackingPatterns = [
    /<trackingNumber>([\s\S]*?)<\/trackingNumber>/i,
    /<parcelNumber>([\s\S]*?)<\/parcelNumber>/i,
    /<shipmentNumber>([\s\S]*?)<\/shipmentNumber>/i,
    /<parcelLabelNumber>([\s\S]*?)<\/parcelLabelNumber>/i,
  ];

  return extractFirstMatch(text, trackingPatterns);
}

function isSoapEnvelope(xmlBody) {
  if (typeof xmlBody !== "string") return false;
  return /<\s*(\w+:)?Envelope\b/i.test(xmlBody);
}

export async function createDpdLabel({
  xmlBody,
  soapAction,
  useValidate,
  xmlHeader,
  expectLabel = true,
}) {
  const storeUrl = process.env.DPD_STORE_URL;
  const validateUrl = process.env.DPD_VALIDATE_URL;
  const endpoint = useValidate ? validateUrl : storeUrl;

  if (!endpoint) {
    throw new Error("DPD_STORE_URL/DPD_VALIDATE_URL is not set in the environment.");
  }

  if (!xmlBody || typeof xmlBody !== "string") {
    throw new Error("xmlBody is required for DPD SOAP requests.");
  }

  const useRawEnvelope = isSoapEnvelope(xmlBody);
  const header = useRawEnvelope ? "" : xmlHeader || buildDefaultHeader();
  const envelope = useRawEnvelope ? xmlBody : buildEnvelope(xmlBody, header);

  const headers = {
    "Content-Type": "text/xml; charset=utf-8",
  };

  if (soapAction) {
    headers.SOAPAction = soapAction;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: envelope,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`DPD request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  if (!expectLabel) {
    return {
      raw: text,
      contentType: "text/xml",
    };
  }

  const label = extractLabel(text);
  if (!label) {
    const preview = text.slice(0, 500);
    throw new Error(
      `DPD response did not contain a recognizable label payload. Response preview: ${preview}`
    );
  }

  return {
    labelBase64: label.labelBase64,
    contentType: label.contentType || "application/pdf",
    trackingNumber: extractTrackingNumber(text),
  };
}
