function resolveEndpoint(endpointPath, baseUrl) {
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (/^https?:\/\//i.test(endpointPath)) {
    const target = new URL(endpointPath);
    if (target.origin !== base.origin) {
      throw new Error("Endpoint URL must match GLS_BASE_URL origin.");
    }
    return target;
  }

  const cleanPath = String(endpointPath || "").replace(/^\/+/, "");
  const target = new URL(cleanPath, base);

  if (target.origin !== base.origin) {
    throw new Error("Endpoint path must be relative to GLS_BASE_URL.");
  }

  return target;
}

function getValueCaseInsensitive(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  const target = key.toLowerCase();
  const match = Object.keys(obj).find((entry) => entry.toLowerCase() === target);
  return match ? obj[match] : undefined;
}

function getTrackingNumber(data) {
  const candidates = [
    "trackingNumber",
    "parcelNumber",
    "parcelNo",
    "unitNo",
    "unitNumber",
    "shipmentId",
    "unitId",
  ];

  for (const key of candidates) {
    const value = getValueCaseInsensitive(data, key);
    if (value) return value;
  }

  return undefined;
}

function extractLabelFromJson(data) {
  if (!data || typeof data !== "object") return null;

  const isProbablyBase64 = (value) => {
    if (typeof value !== "string") return false;
    const compact = value.replace(/\s+/g, "");
    if (compact.length < 40 || compact.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/=]+$/.test(compact);
  };

  const looksLikeZpl = (value) => {
    if (typeof value !== "string") return false;
    return value.includes("^XA") || value.includes("^XZ") || value.includes("~JO") || value.includes("~XA");
  };

  const normalizeLabel = (value, contentTypeHint) => {
    const contentType = contentTypeHint || (looksLikeZpl(value) ? "application/zpl" : "application/pdf");
    if (isProbablyBase64(value)) {
      return { labelBase64: value.replace(/\s+/g, ""), contentType };
    }
    return { labelBase64: Buffer.from(value, "utf-8").toString("base64"), contentType };
  };

  const directKeys = [
    { key: "label" },
    { key: "labelBase64" },
    { key: "labelData" },
    { key: "pdf" },
    { key: "pdfBase64" },
    { key: "zpl", contentType: "application/zpl" },
    { key: "labelShopReturn" },
    { key: "labels" },
  ];

  for (const entry of directKeys) {
    const value = getValueCaseInsensitive(data, entry.key);
    if (!value) continue;

    if (typeof value === "string" && value.length > 20) {
      const normalized = normalizeLabel(value, entry.contentType);
      return {
        ...normalized,
        trackingNumber: getTrackingNumber(data),
      };
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.length > 20) {
          const normalized = normalizeLabel(item, entry.contentType);
          return {
            ...normalized,
            trackingNumber: getTrackingNumber(data),
          };
        }
        if (item && typeof item === "object") {
          const nested = extractLabelFromJson(item);
          if (nested) return nested;
        }
      }
    }

    if (value && typeof value === "object") {
      const nested = extractLabelFromJson(value);
      if (nested) return nested;
    }
  }

  const collectionCandidates = ["labels", "labelList", "parcels", "shipments", "units"];
  for (const key of collectionCandidates) {
    const list = getValueCaseInsensitive(data, key);
    const normalizedList = Array.isArray(list) ? list : null;
    if (!normalizedList) continue;
    for (const item of normalizedList) {
      const found = extractLabelFromJson(item);
      if (found) return found;
    }
  }

  return null;
}

function hasKeyInsensitive(obj, key) {
  if (!obj || typeof obj !== "object") return false;
  const lowerKey = key.toLowerCase();
  return Object.keys(obj).some((entry) => entry.toLowerCase() === lowerKey);
}

function withInjectedCredentials(payload, { username, password, customerNo, labelType }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const enriched = { ...payload };

  if (username && !hasKeyInsensitive(enriched, "username")) {
    enriched.username = username;
  }

  if (password && !hasKeyInsensitive(enriched, "password")) {
    enriched.password = password;
  }

  if (customerNo && !hasKeyInsensitive(enriched, "customerno") && !hasKeyInsensitive(enriched, "customerNumber")) {
    enriched.customerNo = customerNo;
  }

  if (labelType && !hasKeyInsensitive(enriched, "labeltype")) {
    enriched.labelType = labelType;
  }

  return enriched;
}

export async function createGlsLabel({
  endpointPath,
  payload,
  contentType,
  accept,
  expectLabel = true,
  labelType,
}) {
  const baseUrl = process.env.GLS_BASE_URL;
  const apiVersion = process.env.GLS_API_VERSION;
  const username = process.env.GLS_USERNAME;
  const password = process.env.GLS_PASSWORD;
  const customerNo = process.env.GLS_CUSTOMER_NO;

  if (!baseUrl) {
    throw new Error("GLS_BASE_URL is not set in the environment.");
  }

  if (!endpointPath || typeof endpointPath !== "string") {
    throw new Error("endpointPath is required for GLS requests.");
  }

  if (password && password.length > 20) {
    throw new Error("GLS_PASSWORD exceeds 20 characters; update the credential for Label/Create.");
  }

  const url = resolveEndpoint(endpointPath, baseUrl);
  const finalPayload = withInjectedCredentials(payload, { username, password, customerNo, labelType });

  const headers = {
    "Content-Type": contentType || "application/json",
    Accept: accept || "application/pdf, application/json",
  };

  if (apiVersion) {
    headers["X-GLS-API-Version"] = apiVersion;
  }

  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(finalPayload ?? {}),
  });

  const responseContentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLS request failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  if (responseContentType.includes("application/pdf") || responseContentType.includes("application/zpl")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      labelBase64: buffer.toString("base64"),
      contentType: responseContentType.includes("application/zpl") ? "application/zpl" : "application/pdf",
    };
  }

  let data = null;
  if (responseContentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!expectLabel) {
    return {
      raw: data,
      contentType: responseContentType || "text/plain",
    };
  }

  const extracted = extractLabelFromJson(data);

  if (!extracted) {
    const hint =
      data && typeof data === "object"
        ? JSON.stringify(data).slice(0, 500)
        : String(data || "").slice(0, 500);
    throw new Error(
      `GLS response did not contain a recognizable label payload. Response preview: ${hint}`
    );
  }

  return extracted;
}
