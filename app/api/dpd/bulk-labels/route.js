import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument } from "pdf-lib";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { buildDpdXml } from "@/lib/dpd-xml";
import { createDpdLabel } from "@/lib/providers";

export const runtime = "nodejs";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

function normalizeDelivery(delivery) {
  const fields = ["name1", "street", "houseNo", "zipCode", "city", "countryCode"];
  return fields.map((field) => String(delivery?.[field] || "").trim().toLowerCase());
}

async function recordHistory({ userId, provider, delivery, trackingNumber }) {
  if (!delivery || typeof delivery !== "object") {
    return;
  }

  const db = await getDb();
  const now = new Date();
  const [name1, street, houseNo, zipCode, city, countryCode] = normalizeDelivery(delivery);
  const recipientKey = [name1, street, houseNo, zipCode, city, countryCode].join("|");

  await db.collection("recipients").findOneAndUpdate(
    { userId, provider, recipientKey },
    {
      $set: {
        address: delivery,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  await db.collection("shipments").insertOne({
    userId,
    provider,
    trackingNumber: trackingNumber || null,
    delivery,
    createdAt: now,
    status: "label_created",
  });
}

export async function POST(request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const deliveries = Array.isArray(body.deliveries) ? body.deliveries : [];
    const printSettings = body.printSettings || {};

    if (!deliveries.length) {
      return NextResponse.json({ error: "No deliveries provided." }, { status: 400 });
    }

    if (printSettings.dropOffType === "QR_CODE") {
      return NextResponse.json(
        { error: "Bulk print requires PDF output. Set label output to PDF or BOTH." },
        { status: 400 }
      );
    }

    const mergedPdf = await PDFDocument.create();
    const trackingNumbers = [];

    for (const delivery of deliveries) {
      const xmlBody = buildDpdXml(delivery, printSettings);
      const result = await createDpdLabel({
        xmlBody,
        useValidate: false,
        expectLabel: true,
      });

      if (!result.contentType || !result.contentType.includes("pdf")) {
        return NextResponse.json(
          { error: "Bulk print requires PDF labels. Update settings to PDF." },
          { status: 400 }
        );
      }

      const pdfBytes = Buffer.from(result.labelBase64, "base64");
      const document = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(document, document.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));

      if (result.trackingNumber) {
        trackingNumbers.push(result.trackingNumber);
      }

      await recordHistory({
        userId: auth.userId,
        provider: "dpd",
        delivery,
        trackingNumber: result.trackingNumber,
      });
    }

    const mergedBytes = await mergedPdf.save();
    const mergedBase64 = Buffer.from(mergedBytes).toString("base64");

    return NextResponse.json({
      labelBase64: mergedBase64,
      contentType: "application/pdf",
      trackingNumbers,
      count: deliveries.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Bulk print failed." }, { status: 500 });
  }
}
