import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

const DEFAULT_DPD_SETTINGS = {
  print: {
    paperSize: "A4",
    a4StartPosition: "Bottom right",
    rememberLastA4Position: true,
    showPositionDialog: true,
    dropOffType: "FULL_LABEL",
    printerLanguage: "PDF",
    printNote: false,
    senderNote: "",
    senderNoteBeforeAddress: false,
    labelEnlargePart: "None",
    sortOrderLabels: "Date of creation",
    printRecipientReferenceId: false,
    printReference2OnProtocol: false,
    hideUsernameOnProtocol: false,
    acceptanceSortOrder: "Consignee Zip",
  },
};

const DEFAULT_GLS_SETTINGS = {
  label: {
    labelType: "pdf",
    shipType: "P",
    trackingLinkType: "U",
    returnRoutingData: true,
    includeShippingDate: true,
  },
};

const DEFAULT_SETTINGS_BY_PROVIDER = {
  dpd: DEFAULT_DPD_SETTINGS,
  gls: DEFAULT_GLS_SETTINGS,
};

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
  const provider = searchParams.get("provider") || "dpd";
  const defaults = DEFAULT_SETTINGS_BY_PROVIDER[provider] || DEFAULT_DPD_SETTINGS;

  const db = await getDb();
  const settings = await db.collection("settings").findOne({ userId: auth.userId, provider });

  if (!settings) {
    return NextResponse.json({ settings: defaults });
  }

  return NextResponse.json({ settings: settings.data || defaults });
}

export async function POST(request) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider = "dpd", settings } = await request.json();
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  await db.collection("settings").updateOne(
    { userId: auth.userId, provider },
    {
      $set: {
        data: settings,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}
