import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ daoAccountId: string }> },
) {
  try {
    const { daoAccountId } = await params;

    if (
      !daoAccountId ||
      !/^[a-z0-9._-]{2,64}$/.test(daoAccountId)
    ) {
      return NextResponse.json(
        { error: "Invalid DAO account ID." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("communities")
      .select(
        "id, name, description, category, purpose, membership, dao_account_id, created_by, creation_tx_hash, created_at",
      )
      .eq("dao_account_id", daoAccountId)
      .maybeSingle();

    if (error) {
      console.error("Community profile lookup failed:", error.message);
      return NextResponse.json(
        { error: "Unable to load community profile." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Community profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ community: data });
  } catch (error) {
    console.error("Community API error:", error);
    return NextResponse.json(
      { error: "Unable to load community profile." },
      { status: 500 },
    );
  }
}
