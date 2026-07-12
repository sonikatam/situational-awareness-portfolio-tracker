import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export async function POST(request: Request) {
  const secret = process.env.REVALIDATION_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || supplied.length !== secret.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  for (const tag of ["dashboard", "portfolio", "filings", "changes"]) revalidateTag(tag);
  for (const path of ["/", "/portfolio", "/filings", "/changes"]) revalidatePath(path);
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
