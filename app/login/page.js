import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

export default async function LoginRedirect() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (token && verifyToken(token)) {
    redirect("/dashboard");
  }
  redirect("/");
}
