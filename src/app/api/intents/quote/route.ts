import { NextRequest, NextResponse } from "next/server";
import {
  INTENTS_API,
  NEAR_USDC,
  resolveEventTreasury,
} from "@/lib/intents-config";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEAR_INTENTS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "NEAR Intents API credentials are not configured." },
        { status: 503 },
      );
    }

    const body = await request.json();

    const eventId = String(body.eventId || "").trim();
    const originAsset = String(body.originAsset || "").trim();
    const amount = String(body.amount || "").trim();
    const refundTo = String(body.refundTo || "").trim();

    if (
      !eventId ||
      !originAsset ||
      !/^[1-9]\d*$/.test(amount) ||
      !refundTo
    ) {
      return NextResponse.json(
        { error: "Provide eventId, originAsset, a positive base-unit amount, and refundTo." },
        { status: 400 },
      );
    }

    if (
      originAsset.length > 200 ||
      refundTo.length > 200 ||
      amount.length > 80
    ) {
      return NextResponse.json(
        { error: "One or more fields exceed the permitted length." },
        { status: 400 },
      );
    }

    let treasury: Awaited<ReturnType<typeof resolveEventTreasury>>;

    try {
      treasury = await resolveEventTreasury(eventId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to resolve event treasury." },
        { status: 400 },
      );
    }

    const quoteRequest = {
      dry: true,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: NEAR_USDC,
      amount,
      refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: treasury.daoAccountId,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const response = await fetch(`${INTENTS_API}/v0/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(quoteRequest),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });

    const responseText = await response.text();

    let result: unknown;

    try {
      result = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "NEAR Intents returned an unreadable response." },
        { status: 502 },
      );
    }

    if (!response.ok) {
      console.error("NEAR Intents quote failed:", response.status, result);

      return NextResponse.json(
        { error: "NEAR Intents could not provide a quote.", details: result },
        { status: response.status },
      );
    }

    return NextResponse.json(
      {
        eventId: treasury.eventId,
        destinationAsset: NEAR_USDC,
        recipient: treasury.daoAccountId,
        result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "TimeoutError";

    console.error("Intent quote route error:", error);

    return NextResponse.json(
      {
        error: timedOut
          ? "The quote request timed out. Please try again."
          : "Unable to connect to NEAR Intents.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
