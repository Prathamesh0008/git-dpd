import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword, signToken } from "@/lib/auth";

export const runtime = "nodejs";

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();
    const normalizedEmail = sanitizeEmail(email);

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.collection("users").insertOne({
      email: normalizedEmail,
      name: name || null,
      passwordHash,
      createdAt: new Date(),
    });

    const user = {
      id: result.insertedId.toString(),
      email: normalizedEmail,
      name: name || null,
    };

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    const response = NextResponse.json({ user });
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to register." }, { status: 500 });
  }
}
