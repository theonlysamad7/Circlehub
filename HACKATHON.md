# CircleHub — NEAR Build Beyond Boundaries

**Project:** CircleHub  
**Live demo:** https://circlehub7.vercel.app  
**Source code:** https://github.com/theonlysamad7/Circlehub

## Overview

CircleHub is a community finance platform built on NEAR that helps groups organize shared funds, run fundraising events and make collective financial decisions.

It combines blockchain-based treasury governance, cross-asset contributions and AI-assisted financial planning in one community-focused application.

## Problem

Clubs, student organizations, collectives and other communities regularly need to collect contributions, organize events and pay shared expenses.

Their financial coordination is often fragmented across messaging applications, spreadsheets and personal wallets. Members may struggle to see how funds are managed, how spending decisions are made or whether fundraising targets have been reached.

CircleHub addresses this by bringing community finance and governance into a shared application.

## Solution

CircleHub gives each community a workspace for its financial activities.

Communities can use a NEAR DAO treasury, coordinate treasury actions through proposals and voting, create fundraising events, accept contributions routed through NEAR Intents and use an AI assistant to plan budgets.

The objective is not simply to put a payment button on a blockchain. It is to make shared financial activity more organized, accessible and accountable.

## Core capabilities

### Community treasuries and governance

- NEAR wallet connection.
- Community creation and access through SputnikDAO.
- Community dashboard with treasury and member information.
- Proposal-based treasury actions and voting.
- NEAR and NEP-141 USDC transfer proposals.

### Community fundraising

- Administrator-authorized event creation.
- Fundraising targets denominated in NEAR USDC.
- Cross-asset contribution preparation through NEAR Intents.
- Deposit instructions for contributors.
- Contribution status checks and settlement verification.
- Contribution records associated with fundraising events.

### AI-assisted financial planning

CircleHub integrates NEAR AI through a community-aware assistant.

It can help with:

- Fundraising target estimates.
- Event budget planning.
- Spending allocations.
- Expense reduction ideas.
- Community activity planning.
- General financial explanations.

The assistant provides recommendations only. It cannot access wallets, move funds, approve proposals or execute transactions.

## NEAR ecosystem usage

### NEAR Protocol
Provides the blockchain infrastructure and wallet interactions for CircleHub's community finance workflows.

### SputnikDAO
Supplies the community treasury and proposal-based governance infrastructure. Treasury actions follow the DAO's configured approval process.

### NEAR Intents
Allows contributors to start with supported assets while directing contributions toward NEAR USDC in the community DAO treasury.

The current workflow prepares a payment quote and deposit address, then checks settlement before confirming the contribution.

### NEAR AI
Powers the community-aware financial planning assistant. It adds practical planning support without receiving authority over treasury funds.

### NEP-413
Wallet message signatures authorize protected actions, including event creation and contribution preparation.

## Technical architecture

- **Frontend:** Next.js, React, TypeScript and Tailwind CSS.
- **Application data:** Supabase.
- **Wallet integration:** `@hot-labs/near-connect`.
- **Blockchain interaction:** `near-api-js`.
- **Community governance:** NEAR SputnikDAO.
- **Cross-asset payments:** NEAR Intents 1Click API.
- **AI assistant:** NEAR AI chat completions API.

Supabase stores community metadata, event records, contribution records and short-lived authorization nonces. Blockchain transactions and DAO governance remain on NEAR.

## Example user journey

1. A community member connects a NEAR wallet.
2. The member opens or creates a community.
3. The community uses its DAO treasury and governance process.
4. An authorized administrator creates a fundraising event.
5. A contributor chooses a supported asset and prepares a contribution.
6. NEAR Intents provides deposit instructions for routing the contribution into NEAR USDC.
7. CircleHub checks payment status and records the contribution after settlement verification.
8. Community members can use the AI assistant for budget and fundraising guidance.
9. Treasury spending continues through the DAO approval process.

## Why this matters

Community finance is fundamentally social: people contribute because they share a goal, and they need confidence that shared funds are handled responsibly.

CircleHub combines that social coordination with on-chain governance. NEAR Intents broadens how people can contribute, while NEAR AI makes financial planning more approachable for groups that may not have dedicated finance teams.

## Track alignment

**Primary alignment: Social Money**

CircleHub focuses on shared financial activity between members of a community: contributions, fundraising, collective treasuries and group spending decisions.

**Additional alignment: AI**

NEAR AI provides a practical assistant for budgeting, fundraising estimates and expense planning. It complements the financial workflow rather than replacing DAO governance.

## Demo and source

- Live application: https://circlehub7.vercel.app
- Public repository: https://github.com/theonlysamad7/Circlehub

## Build verification

```bash
npx tsc --noEmit
npx next build --webpack
```

## Important implementation boundaries

- The AI assistant does not control treasury funds or DAO approvals.
- Contributions are not treated as confirmed merely because a quote was prepared.
- Contribution confirmation depends on settlement verification.
- Treasury transfers and payouts remain subject to the DAO's governance configuration.
- USDC transfers can require recipient storage registration and sufficient NEAR for transaction costs.

## Submission note

This document describes the implemented application and its intended ecosystem integrations. The live demo is the best way to inspect the user experience, while the repository contains the source code.
