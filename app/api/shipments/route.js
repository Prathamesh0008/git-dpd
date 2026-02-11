import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  const db = await getDb();
  const query = { userId: auth.userId };
  if (provider) query.provider = provider;

  const shipments = await db
    .collection("shipments")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json({
    shipments: shipments.map((shipment) => ({
      id: shipment._id.toString(),
      provider: shipment.provider,
      trackingNumber: shipment.trackingNumber || null,
      delivery: shipment.delivery || null,
      status: shipment.status || null,
      createdAt: shipment.createdAt || null,
    })),
  });
}
