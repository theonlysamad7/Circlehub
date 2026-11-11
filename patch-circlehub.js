const fs = require("fs");

const file = "src/app/community/[daoAccountId]/page.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first === -1) {
    console.error("PATCH FAILED: Could not find " + label);
    process.exit(1);
  }
  if (source.indexOf(oldText, first + oldText.length) !== -1) {
    console.error("PATCH FAILED: Duplicate match for " + label);
    process.exit(1);
  }
  source = source.slice(0, first) + newText + source.slice(first + oldText.length);
  console.log("Patched: " + label);
}

replaceOnce(
  'const RPC = "https://rpc.mainnet.near.org";',
  'const RPC = "https://rpc.mainnet.near.org";\nconst USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";',
  "USDC contract constant"
);

replaceOnce(
  `type DashboardData = {
  name: string;
  purpose: string;
  balance: string;`,
  `type DashboardData = {
  name: string;
  purpose: string;
  balanceNear: string;
  balanceUsdc: string;`,
  "dashboard balance types"
);

replaceOnce(
  `function formatNear(yocto: string) {
  const amount = Number(yocto) / 1e24;
  return Number.isFinite(amount)
    ? \`\${amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} NEAR\`
    : "Unavailable";
}`,
  `function formatNear(yocto: string) {
  const amount = Number(yocto) / 1e24;
  return Number.isFinite(amount)
    ? \`\${amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} NEAR\`
    : "Unavailable";
}

function formatUsdc(atomic: string) {
  const value = BigInt(atomic || "0");
  const whole = value / 1000000n;
  const fraction = (value % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");

  return \`\${whole.toLocaleString("en-US")}\${fraction ? "." + fraction : ""} USDC\`;
}

function parseUnits(value: string, decimals: number) {
  const cleaned = value.trim();

  if (!/^\\d+(\\.\\d*)?$/.test(cleaned)) {
    throw new Error("Enter a valid positive transfer amount.");
  }

  const [whole, fraction = ""] = cleaned.split(".");

  if (fraction.length > decimals) {
    throw new Error(\`This asset supports at most \${decimals} decimal places.\`);
  }

  const atomic = BigInt(whole) * (10n ** BigInt(decimals)) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");

  if (atomic <= 0n) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  return atomic;
}`,
  "USDC formatting and precise amount conversion"
);

replaceOnce(
  '  const [amount, setAmount] = useState("");',
  '  const [amount, setAmount] = useState("");\n  const [transferAsset, setTransferAsset] = useState<"NEAR" | "USDC">("NEAR");',
  "transfer asset state"
);

replaceOnce(
  `      const [account, configResult, policyResult, proposalsResult, savedProfile] =
        await Promise.all([
          rpcCall("query", {
            request_type: "view_account",
            finality: "final",
            account_id: daoAccountId,
          }),
          viewMethod(daoAccountId, "get_config"),
          viewMethod(daoAccountId, "get_policy"),
          viewMethod(daoAccountId, "get_proposals", {
            from_index: 0,
            limit: 20,
          }),
          profilePromise,
        ]);`,
  `      const [account, configResult, policyResult, proposalsResult, usdcResult, savedProfile] =
        await Promise.all([
          rpcCall("query", {
            request_type: "view_account",
            finality: "final",
            account_id: daoAccountId,
          }),
          viewMethod(daoAccountId, "get_config"),
          viewMethod(daoAccountId, "get_policy"),
          viewMethod(daoAccountId, "get_proposals", {
            from_index: 0,
            limit: 20,
          }),
          viewMethod(USDC_CONTRACT, "ft_balance_of", {
            account_id: daoAccountId,
          }).then((value) => ({ ok: true as const, value }))
            .catch(() => ({ ok: false as const, value: null })),
          profilePromise,
        ]);`,
  "load USDC balance"
);

replaceOnce(
  `      setData({
        name: config.name || daoAccountId,
        purpose: config.purpose || "Community treasury",
        balance: formatNear(account.amount || "0"),
        members,`,
  `      const usdcAtomic = usdcResult.ok
        ? String(decode(usdcResult.value) ?? "0")
        : null;

      setData({
        name: config.name || daoAccountId,
        purpose: config.purpose || "Community treasury",
        balanceNear: formatNear(account.amount || "0"),
        balanceUsdc: usdcAtomic === null ? "Unavailable" : formatUsdc(usdcAtomic),
        members,`,
  "store both treasury balances"
);

replaceOnce(
  `      if (proposalType === "Transfer") {
        if (!/^[a-z0-9._-]+$/.test(receiver.trim())) {
          throw new Error("Enter a valid NEAR receiver account ID.");
        }
        const nearAmount = Number(amount);
        if (!Number.isFinite(nearAmount) || nearAmount <= 0) {
          throw new Error("Enter a valid transfer amount.");
        }
        const yocto = BigInt(Math.round(nearAmount * 1e6)) * BigInt(10) ** BigInt(18);
        kind = {
          Transfer: {
            token_id: "",
            receiver_id: receiver.trim(),
            amount: yocto.toString(),
          },
        };
      }`,
  `      if (proposalType === "Transfer") {
        const recipient = receiver.trim().toLowerCase();

        if (
          recipient.length < 2 ||
          recipient.length > 64 ||
          !/^[a-z0-9._-]+$/.test(recipient)
        ) {
          throw new Error("Enter a valid NEAR receiver account ID.");
        }

        const decimals = transferAsset === "USDC" ? 6 : 24;
        const atomicAmount = parseUnits(amount, decimals);

        kind = {
          Transfer: {
            token_id: transferAsset === "USDC" ? USDC_CONTRACT : "",
            receiver_id: recipient,
            amount: atomicAmount.toString(),
          },
        };
      }`,
  "token-aware transfer proposal"
);

replaceOnce(
  `      setReceiver("");
      setAmount("");
      setMemberAccount("");
      setProposalType("Vote");`,
  `      setReceiver("");
      setAmount("");
      setTransferAsset("NEAR");
      setMemberAccount("");
      setProposalType("Vote");`,
  "reset transfer asset"
);

replaceOnce(
  `<div className={styles.balanceLine}><strong>{loading ? "Loading..." : data?.balance || "Unavailable"}</strong></div>`,
  `<div className={styles.balanceLine}><strong>{loading ? "Loading..." : data?.balanceNear || "Unavailable"}</strong></div>
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 600 }}>
              {loading ? "Loading USDC..." : data?.balanceUsdc || "Unavailable"}
            </div>`,
  "display USDC treasury balance"
);

replaceOnce(
  '<option value="Transfer">NEAR treasury transfer</option>',
  '<option value="Transfer">Treasury transfer (NEAR / USDC)</option>',
  "transfer proposal label"
);

replaceOnce(
  `                  {proposalType === "Transfer" && (
                    <>
                      <label>Recipient NEAR account
                        <input required value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="recipient.near" style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                      </label>
                      <label>Amount (NEAR)
                        <input required type="number" min="0.000001" step="0.000001" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.1" style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                      </label>
                    </>
                  )}`,
  `                  {proposalType === "Transfer" && (
                    <>
                      <label>Asset to transfer
                        <select
                          value={transferAsset}
                          onChange={(event) => setTransferAsset(event.target.value as "NEAR" | "USDC")}
                          style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }}
                        >
                          <option value="NEAR">NEAR</option>
                          <option value="USDC">USDC</option>
                        </select>
                      </label>
                      <label>Recipient NEAR account
                        <input required value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="recipient.near" style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                      </label>
                      <label>Amount ({transferAsset})
                        <input
                          required
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder={transferAsset === "USDC" ? "10.00" : "0.1"}
                          style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }}
                        />
                      </label>
                      <small>
                        {transferAsset === "USDC"
                          ? "USDC uses 6 decimal places. The recipient must already be registered with the USDC token contract."
                          : "NEAR amounts support up to 24 decimal places."}
                      </small>
                    </>
                  )}`,
  "asset selector and transfer form"
);

fs.writeFileSync(file, source);
console.log("\\nDashboard patch completed.");
