import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INTENTS_API,
  NEAR_USDC,
  resolveEventTreasury,
} from "@/lib/intents-config";
import {
  buildContributionMessage,
  EVENT_SIGNING_RECIPIENT,
} from "@/lib/event-auth";

const RPC = "https://rpc.mainnet.near.org";

function baseUnitsToDecimal(value: string, decimals: number) {
  const amount = BigInt(value);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEAR_INTENTS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "NEAR Intents API is not configured." },
        { status: 503 },
      );
    }

    const body = await request.json();

    const eventId = String(body.eventId || "").trim();
    const accountId = String(body.accountId || "").trim();
    const publicKey = String(body.publicKey || "").trim();
    const signature = String(body.signature || "").trim();
    const originAsset = String(body.originAsset || "").trim();
    const amount = String(body.amount || "").trim();
    const refundTo = String(body.refundTo || "").trim();
    const nonce = body.nonce;

    if (
      !eventId ||
      !/^[a-z0-9._-]{2,64}$/.test(accountId) ||
      !publicKey ||
      !signature ||
      !originAsset ||
      originAsset.length > 200 ||
      !/^[1-9]\d*$/.test(amount) ||
      amount.length > 80 ||
      !refundTo ||
      refundTo.length > 200 ||
      !Array.isArray(nonce) ||
      nonce.length !== 32 ||
      !nonce.every(
        (value: unknown) =>
          Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255,
      )
    ) {
      return NextResponse.json(
        { error: "Contribution authorization details are invalid." },
        { status: 400 },
      );
    }

    const signatureBytes = Buffer.from(signature, "base64");

    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature) ||
      signatureBytes.length !== 64 ||
      signatureBytes.toString("base64") !== signature
    ) {
      return NextResponse.json(
        { error: "Invalid NEP-413 signature encoding." },
        { status: 400 },
      );
    }

    let treasury: Awaited<ReturnType<typeof resolveEventTreasury>>;

    try {
      treasury = await resolveEventTreasury(eventId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to resolve event." },
        { status: 400 },
      );
    }

    const nonceBytes = Uint8Array.from(nonce);
    const nonceHash = createHash("sha256")
      .update(nonceBytes)
      .digest("hex");

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("event_auth_nonces")
      .select("nonce_hash,account_id,expires_at")
      .eq("nonce_hash", nonceHash)
      .eq("account_id", accountId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Wallet verification expired or was already used. Request a new one." },
        { status: 401 },
      );
    }

    const message = buildContributionMessage({
      eventId,
      daoAccountId: treasury.daoAccountId,
      accountId,
      originAsset,
      amount,
      refundTo,
    });

    try {
      await verifyMessage({
        signerAccountId: accountId,
        signerPublicKey: publicKey,
        payload: {
          message,
          recipient: EVENT_SIGNING_RECIPIENT,
          nonce: nonceBytes,
        },
        signature: Uint8Array.from(signatureBytes),
        provider: new JsonRpcProvider({ url: RPC }),
      });
    } catch (error) {
      console.error("Contribution signature verification failed:", error);

      return NextResponse.json(
        { error: "NEAR wallet signature verification failed." },
        { status: 401 },
      );
    }

    // Consume the one-time challenge before creating a payment quote.
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("event_auth_nonces")
      .delete()
      .eq("nonce_hash", nonceHash)
      .eq("account_id", accountId)
      .gt("expires_at", new Date().toISOString())
      .select("nonce_hash")
      .maybeSingle();

    if (consumeError || !consumed) {
      return NextResponse.json(
        { error: "This wallet authorization has already been used." },
        { status: 409 },
      );
    }

    const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const quoteRequest = {
      dry: false,
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
      deadline,
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
      console.error("NEAR Intents prepare failed:", response.status, result);

      return NextResponse.json(
        { error: "NEAR Intents could not prepare this deposit.", details: result },
        { status: response.status },
      );
    }

    const data = result as {
      quote?: Record<string, unknown>;
      signature?: string;
    };

    const quote = data.quote;

    if (
      !quote ||
      typeof quote.depositAddress !== "string" ||
      !quote.depositAddress.trim()
    ) {
      return NextResponse.json(
        { error: "NEAR Intents did not return a valid deposit address." },
        { status: 502 },
      );
    }

    const depositAddress = quote.depositAddress;
    const expectedAmountOut =
      typeof quote.amountOut === "string" ||
      typeof quote.amountOut === "number"
        ? String(quote.amountOut)
        : null;

    const depositMemo =
      typeof quote.depositMemo === "string"
        ? quote.depositMemo
        : typeof quote.memo === "string"
          ? quote.memo
          : null;

    if (
      expectedAmountOut &&
      !/^[1-9]\d*$/.test(expectedAmountOut)
    ) {
      return NextResponse.json(
        { error: "NEAR Intents returned an invalid expected output amount." },
        { status: 502 },
      );
    }

    // The amount is provisional until settlement is independently verified.
    const provisionalAmount = expectedAmountOut
      ? baseUnitsToDecimal(expectedAmountOut, 6)
      : "0.000001";

    const { data: contribution, error: insertError } = await supabaseAdmin
      .from("event_contributions")
      .insert({
        event_id: eventId,
        contributor_account_id: accountId,
        amount: provisionalAmount,
        token_symbol: "USDC",
        payment_provider: "near_intents",
        payment_reference: depositAddress,
        deposit_address: depositAddress,
        deposit_memo: depositMemo,
        origin_asset: originAsset,
        origin_amount: amount,
        expected_amount_out: expectedAmountOut,
        quote_deadline: deadline,
        status: "pending",
      })
      .select("id,event_id,deposit_address,deposit_memo,expected_amount_out,quote_deadline,status")
      .single();

    if (insertError || !contribution) {
      console.error("Contribution insert failed:", insertError);

      return NextResponse.json(
        {
          error: "The deposit was prepared but its tracking record could not be saved. Do not send funds; contact the community admin.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Deposit prepared. No funds have been transferred yet.",
        contribution,
        quote,
        signature: data.signature,
        destinationAsset: NEAR_USDC,
        recipient: treasury.daoAccountId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "TimeoutError";

    console.error("Intent prepare route error:", error);

    return NextResponse.json(
      {
        error: timedOut
          ? "The NEAR Intents request timed out."
          : "Unable to prepare the contribution deposit.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
