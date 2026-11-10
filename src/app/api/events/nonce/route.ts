import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId = String(body.accountId || "").trim();

    if (!/^[a-z0-9._-]{2,64}$/.test(accountId)) {
      return NextResponse.json(
        { error: "Invalid NEAR account ID." },
        { status: 400 },
      );
    }

    const nonce = randomBytes(32);
    const nonceHash = createHash("sha256")
      .update(nonce)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("event_auth_nonces")
      .insert({
        account_id: accountId,
        nonce_hash: nonceHash,
        expires_at: expiresAt,
      });

    if (error) {
      console.error("Nonce creation error:", error);
      return NextResponse.json(
        { error: "Unable to prepare wallet verification." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      nonce: Array.from(nonce),
      expiresAt,
    });
  } catch (error) {
    console.error("Nonce route error:", error);
    return NextResponse.json(
      { error: "Unable to prepare wallet verification." },
      { status: 500 },
    );
  }
}
