import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ daoAccountId: string }> },
) {
  try {
    const { daoAccountId } = await params;

    if (!/^[a-z0-9._-]{2,64}$/.test(daoAccountId)) {
      return NextResponse.json({ error: "Invalid DAO account." }, { status: 400 });
    }

    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("dao_account_id", daoAccountId)
      .single();

    if (communityError || !community) {
      return NextResponse.json({ error: "Community not found." }, { status: 404 });
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from("community_events")
      .select("id,title,description,funding_goal,currency,deadline,status,created_by,created_at")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false });

    if (eventsError) throw eventsError;

    const eventIds = (events || []).map((event) => event.id);
    let contributions: {
      event_id: string;
      contributor_account_id: string;
      amount: number | string;
      token_symbol: string;
    }[] = [];

    if (eventIds.length) {
      const { data, error } = await supabaseAdmin
        .from("event_contributions")
        .select("event_id,contributor_account_id,amount,token_symbol")
        .in("event_id", eventIds)
        .eq("status", "verified");

      if (error) throw error;
      contributions = data || [];
    }

    const enriched = (events || []).map((event) => {
      const donors = contributions.filter(
        (item) => item.event_id === event.id,
      );

      const raised = donors.reduce(
        (total, item) => total + Number(item.amount),
        0,
      );

      return {
        ...event,
        raised,
        contributorCount: new Set(
          donors.map((item) => item.contributor_account_id),
        ).size,
        contributors: donors.map((item) => ({
          accountId: item.contributor_account_id,
          amount: item.amount,
          token: item.token_symbol,
        })),
      };
    });

    return NextResponse.json({ events: enriched });
  } catch (error) {
    console.error("Events listing error:", error);
    return NextResponse.json(
      { error: "Unable to load community events." },
      { status: 500 },
    );
  }
}
