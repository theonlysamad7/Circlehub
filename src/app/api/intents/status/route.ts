import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import bs58 from "bs58";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INTENTS_API,
  NEAR_USDC,
  resolveEventTreasury,
} from "@/lib/intents-config";

const MANAGER_PUBLIC_KEY =
  "ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc";

function sortObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        if (value[key] !== undefined) {
          result[key] = sortObject(value[key]);
        }
        return result;
      }, {});
  }

  return value;
}

function verifyOneClickQuote(response: any): boolean {
  try {
    const request = response.quoteRequest;
    const quote = response.quote;

    if (
      !request ||
      !quote ||
      typeof response.timestamp !== "string" ||
      typeof response.signature !== "string"
    ) {
      return false;
    }

    const signedRequest = {
      dry: request.dry,
      swapType: request.swapType,
      slippageTolerance: request.slippageTolerance,
      originAsset: request.originAsset,
      depositType: request.depositType,
      destinationAsset: request.destinationAsset,
      amount: request.amount,
      refundTo: request.refundTo,
      refundType: request.refundType,
      recipient: request.recipient,
      recipientType: request.recipientType,
      deadline: request.deadline,
      quoteWaitingTimeMs: request.quoteWaitingTimeMs
        ? request.quoteWaitingTimeMs
        : undefined,
      referral: request.referral ? request.referral : undefined,
      virtualChainRecipient: request.virtualChainRecipient
        ? request.virtualChainRecipient
        : undefined,
      virtualChainRefundRecipient: request.virtualChainRefundRecipient
        ? request.virtualChainRefundRecipient
        : undefined,
      customRecipientMsg: request.customRecipientMsg
        ? request.customRecipientMsg
        : undefined,
      sessionId: undefined,
      connectedWallets: undefined,
      correlationId: undefined,
      appFees: undefined,
      partnerId: undefined,
      userAccountId: undefined,
      depositMode: undefined,
    };

    const signedQuote = request.dry
      ? {
          amountIn: quote.amountIn,
          amountInFormatted: quote.amountInFormatted,
          amountInUsd: quote.amountInUsd,
          minAmountIn: quote.minAmountIn,
          amountOut: quote.amountOut,
          amountOutFormatted: quote.amountOutFormatted,
          amountOutUsd: quote.amountOutUsd,
          minAmountOut: quote.minAmountOut,
        }
      : {
          amountIn: quote.amountIn,
          amountInFormatted: quote.amountInFormatted,
          amountInUsd: quote.amountInUsd,
          minAmountIn: quote.minAmountIn,
          amountOut: quote.amountOut,
          amountOutFormatted: quote.amountOutFormatted,
          amountOutUsd: quote.amountOutUsd,
          minAmountOut: quote.minAmountOut,
          depositAddress: quote.depositAddress || undefined,
          depositMemo: quote.depositMemo || undefined,
          deadline: quote.deadline || undefined,
          timeWhenInactive: quote.timeWhenInactive || undefined,
          timeEstimate: quote.timeEstimate || undefined,
          refundFee: quote.refundFee || undefined,
          withdrawFee: quote.withdrawFee || undefined,
        };

    const serialized = JSON.stringify(
      sortObject({
        ...signedRequest,
        ...signedQuote,
        timestamp: response.timestamp,
      }),
    );

    const digest = createHash("sha256")
      .update(serialized, "utf8")
      .digest();

    const message = bs58.encode(digest);

    const signatureText = response.signature.startsWith("ed25519:")
      ? response.signature.slice("ed25519:".length)
      : response.signature;

    const publicKeyText = MANAGER_PUBLIC_KEY.slice("ed25519:".length);

    const signatureBytes = Buffer.from(bs58.decode(signatureText));
    const publicKeyBytes = Buffer.from(bs58.decode(publicKeyText));

    if (signatureBytes.length !== 64 || publicKeyBytes.length !== 32) {
      return false;
    }

    const publicKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        publicKeyBytes,
      ]),
      format: "der",
      type: "spki",
    });

    return verifySignature(
      null,
      Buffer.from(message, "utf8"),
      publicKey,
      signatureBytes,
    );
  } catch {
    return false;
  }
}

function baseUnitsToDecimal(value: string, decimals: number) {
  if (!/^\d+$/.test(value)) {
    throw new Error("Invalid settled amount.");
  }

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
    const contributionId = String(body.contributionId || "").trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        contributionId,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid contribution ID." },
        { status: 400 },
      );
    }

    const { data: contribution, error: contributionError } =
      await supabaseAdmin
        .from("event_contributions")
        .select(
          "id,event_id,amount,origin_asset,origin_amount,deposit_address,deposit_memo,status,destination_tx_hash",
        )
        .eq("id", contributionId)
        .maybeSingle();

    if (contributionError || !contribution) {
      return NextResponse.json(
        { error: "Contribution record not found." },
        { status: 404 },
      );
    }

    if (contribution.status === "verified") {
      return NextResponse.json({
        status: "SUCCESS",
        contribution,
        message: "This contribution has already been verified.",
      });
    }

    if (
      contribution.status === "failed" ||
      contribution.status === "refunded"
    ) {
      return NextResponse.json({
        status: contribution.status.toUpperCase(),
        contribution,
      });
    }

    if (!contribution.deposit_address) {
      return NextResponse.json(
        { error: "Contribution has no recorded deposit address." },
        { status: 409 },
      );
    }

    const treasury = await resolveEventTreasury(contribution.event_id);

    const query = new URLSearchParams({
      depositAddress: contribution.deposit_address,
    });

    if (contribution.deposit_memo) {
      query.set("depositMemo", contribution.deposit_memo);
    }

    const response = await fetch(
      `${INTENTS_API}/v0/status?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      },
    );

    const responseText = await response.text();

    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "NEAR Intents returned an unreadable status response." },
        { status: 502 },
      );
    }

    if (!response.ok) {
      console.error("NEAR Intents status error:", response.status);

      return NextResponse.json(
        { error: "Unable to retrieve contribution status." },
        { status: 502 },
      );
    }

    const quoteResponse = result.quoteResponse;
    const quoteRequest = quoteResponse?.quoteRequest;
    const quote = quoteResponse?.quote;
    const swapDetails = result.swapDetails;

    if (
      !quoteResponse ||
      !quoteRequest ||
      !quote ||
      !swapDetails ||
      !verifyOneClickQuote(quoteResponse)
    ) {
      return NextResponse.json(
        { error: "The 1Click status quote failed signature verification." },
        { status: 502 },
      );
    }

    // Bind the signed quote to the original contribution and its DAO treasury.
    if (
      quoteRequest.dry !== false ||
      quoteRequest.originAsset !== contribution.origin_asset ||
      String(quoteRequest.amount) !== String(contribution.origin_amount) ||
      quoteRequest.destinationAsset !== NEAR_USDC ||
      quoteRequest.recipient !== treasury.daoAccountId ||
      quoteRequest.recipientType !== "DESTINATION_CHAIN" ||
      quoteRequest.depositType !== "ORIGIN_CHAIN" ||
      quoteRequest.refundType !== "ORIGIN_CHAIN" ||
      quote.depositAddress !== contribution.deposit_address ||
      (quote.depositMemo || null) !== (contribution.deposit_memo || null)
    ) {
      console.error("1Click quote did not match contribution:", contribution.id);

      return NextResponse.json(
        { error: "The signed 1Click quote does not match this contribution." },
        { status: 409 },
      );
    }

    const upstreamStatus = String(result.status || "");

    if (
      ![
        "PENDING_DEPOSIT",
        "KNOWN_DEPOSIT_TX",
        "PROCESSING",
        "SUCCESS",
        "INCOMPLETE_DEPOSIT",
        "REFUNDED",
        "FAILED",
      ].includes(upstreamStatus)
    ) {
      return NextResponse.json(
        { error: "NEAR Intents returned an unknown contribution status." },
        { status: 502 },
      );
    }

    if (upstreamStatus === "SUCCESS") {
      const actualAmountOut = swapDetails.amountOut;
      const destinationHashes = swapDetails.destinationChainTxHashes;

      if (
        typeof actualAmountOut !== "string" ||
        !/^[1-9]\d*$/.test(actualAmountOut) ||
        !Array.isArray(destinationHashes) ||
        destinationHashes.length === 0 ||
        typeof destinationHashes[0]?.hash !== "string" ||
        !destinationHashes[0].hash.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "The swap reports success but its settled amount or destination transaction evidence is incomplete.",
          },
          { status: 502 },
        );
      }

      const actualAmount = baseUnitsToDecimal(actualAmountOut, 6);
      const destinationTxHash = destinationHashes[0].hash;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("event_contributions")
        .update({
          amount: actualAmount,
          status: "verified",
          destination_tx_hash: destinationTxHash,
          verified_at: new Date().toISOString(),
        })
        .eq("id", contribution.id)
        .eq("status", "pending")
        .select(
          "id,event_id,amount,token_symbol,status,destination_tx_hash,verified_at",
        )
        .maybeSingle();

      if (updateError) {
        console.error("Contribution settlement update failed:", updateError);

        return NextResponse.json(
          { error: "Settlement was confirmed but the contribution record could not be updated." },
          { status: 500 },
        );
      }

      if (!updated) {
        const { data: latest } = await supabaseAdmin
          .from("event_contributions")
          .select(
            "id,event_id,amount,token_symbol,status,destination_tx_hash,verified_at",
          )
          .eq("id", contribution.id)
          .maybeSingle();

        return NextResponse.json({
          status: upstreamStatus,
          contribution: latest,
        });
      }

      return NextResponse.json({
        status: upstreamStatus,
        contribution: updated,
        amountOutFormatted: swapDetails.amountOutFormatted || actualAmount,
        destinationTransaction: destinationHashes[0],
      });
    }

    if (upstreamStatus === "REFUNDED" || upstreamStatus === "FAILED") {
      const localStatus =
        upstreamStatus === "REFUNDED" ? "refunded" : "failed";

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("event_contributions")
        .update({ status: localStatus })
        .eq("id", contribution.id)
        .eq("status", "pending")
        .select("id,event_id,status")
        .maybeSingle();

      if (updateError) {
        console.error("Contribution status update failed:", updateError);

        return NextResponse.json(
          { error: "Unable to update the contribution status." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        status: upstreamStatus,
        contribution: updated,
      });
    }

    return NextResponse.json({
      status: upstreamStatus,
      contribution,
      message: "The deposit is not settled yet. Check again shortly.",
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "TimeoutError";

    console.error("Intent status route error:", error);

    return NextResponse.json(
      {
        error: timedOut
          ? "Checking the contribution status timed out."
          : "Unable to verify the contribution status.",
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
