import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { createDpdLabel, createGlsLabel } from "@/lib/providers";
import { getDb } from "@/lib/mongodb";

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
    return { shipmentId: null, recipientId: null };
  }

  const db = await getDb();
  const now = new Date();
  const [name1, street, houseNo, zipCode, city, countryCode] = normalizeDelivery(delivery);
  const recipientKey = [name1, street, houseNo, zipCode, city, countryCode].join("|");

  const recipientResult = await db.collection("recipients").findOneAndUpdate(
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
    { upsert: true, returnDocument: "after" }
  );

  const shipmentResult = await db.collection("shipments").insertOne({
    userId,
    provider,
    trackingNumber: trackingNumber || null,
    delivery,
    createdAt: now,
    status: "label_created",
  });

  return {
    shipmentId: shipmentResult.insertedId?.toString() || null,
    recipientId: recipientResult?.value?._id?.toString() || null,
  };
}

export async function POST(request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const provider = String(body.provider || "").toLowerCase();

    if (provider === "gls") {
      const result = await createGlsLabel({
        endpointPath: body.endpointPath,
        payload: body.payload,
        contentType: body.contentType,
        accept: body.accept,
        expectLabel: body.expectLabel !== false,
        labelType: body.labelType,
      });

      let historyMeta = {};
      try {
        historyMeta = await recordHistory({
          userId: auth.userId,
          provider,
          delivery: body.delivery,
          trackingNumber: result.trackingNumber,
        });
      } catch (error) {
        console.error("Failed to record GLS history:", error);
      }

      return NextResponse.json({
        provider,
        labelBase64: result.labelBase64,
        contentType: result.contentType || "application/pdf",
        trackingNumber: result.trackingNumber || null,
        raw: result.raw,
        ...historyMeta,
      });
    }

    if (provider === "dpd") {
      const result = await createDpdLabel({
        xmlBody: body.xmlBody,
        soapAction: body.soapAction,
        useValidate: Boolean(body.useValidate),
        xmlHeader: body.xmlHeader,
        expectLabel: body.expectLabel !== false,
      });

      let historyMeta = {};
      try {
        historyMeta = await recordHistory({
          userId: auth.userId,
          provider,
          delivery: body.delivery,
          trackingNumber: result.trackingNumber,
        });
      } catch (error) {
        console.error("Failed to record DPD history:", error);
      }

      return NextResponse.json({
        provider,
        labelBase64: result.labelBase64,
        contentType: result.contentType || "application/pdf",
        trackingNumber: result.trackingNumber || null,
        raw: result.raw,
        ...historyMeta,
      });
    }

    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Label generation failed." }, { status: 500 });
  }
}
