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

  const recipients = await db
    .collection("recipients")
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    recipients: recipients.map((recipient) => ({
      id: recipient._id.toString(),
      provider: recipient.provider,
      address: recipient.address || null,
      updatedAt: recipient.updatedAt || null,
      createdAt: recipient.createdAt || null,
    })),
  });
}
