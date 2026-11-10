import { supabaseAdmin } from "@/lib/supabase-admin";

export const INTENTS_API = "https://1click.chaindefuser.com";

export const NEAR_USDC =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

export async function resolveEventTreasury(eventId: string) {
  if (
    typeof eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)
  ) {
    throw new Error("Invalid event ID.");
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("community_events")
    .select("id,community_id,status,deadline")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new Error("Event not found.");
  }

  if (event.status !== "fundraising") {
    throw new Error("This event is not accepting contributions.");
  }

  if (event.deadline && Date.parse(event.deadline) <= Date.now()) {
    throw new Error("The contribution deadline has passed.");
  }

  const { data: community, error: communityError } = await supabaseAdmin
    .from("communities")
    .select("dao_account_id")
    .eq("id", event.community_id)
    .single();

  if (communityError || !community?.dao_account_id) {
    throw new Error("The community treasury could not be found.");
  }

  return {
    eventId: event.id,
    daoAccountId: community.dao_account_id,
  };
}
