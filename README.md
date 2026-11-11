# CircleHub

**Community finance. Built together.**

CircleHub is a community finance platform built on NEAR. It gives clubs, student groups, collectives and other communities a shared space to manage treasuries, organize fundraising events, coordinate financial decisions and make community funds more transparent.

**Live demo:** https://circlehub7.vercel.app
**Repository:** https://github.com/theonlysamad7/Circlehub

## The problem

Community groups often collect money and organize shared expenses through disconnected chats, spreadsheets and individual wallets. This makes it difficult to maintain transparent records, coordinate spending decisions and build trust around shared funds.

CircleHub brings community organization, treasury management and financial coordination into one platform, with blockchain-based governance at its core.

## Features

- **Community treasuries:** Create and manage communities backed by NEAR SputnikDAO.
- **Wallet connection:** Connect a NEAR wallet to interact with community treasuries and governance.
- **Community dashboards:** View community information, members, treasury balances and governance activity.
- **Proposal-based governance:** Submit treasury actions and participate in DAO proposal voting.
- **NEAR and USDC transfers:** Create treasury transfer proposals for native NEAR and NEP-141 USDC.
- **Fundraising events:** Create community events with fundraising targets denominated in NEAR USDC.
- **Cross-asset contributions:** Accept supported origin assets through NEAR Intents and route contributions toward the community treasury in NEAR USDC.
- **Contribution verification:** Use wallet authorization, deposit instructions and settlement verification to record confirmed contributions.
- **AI budget assistant:** Use NEAR AI for community-aware budget planning, fundraising estimates, expense allocation and financial guidance.

## How it works

### 1. Create or access a community

Connect a NEAR wallet and create a community using the SputnikDAO infrastructure, or open an existing community.

### 2. Manage the community treasury

Community members can view treasury information and governance activity. Treasury actions are handled through DAO proposals and the community's configured approval policy.

### 3. Organize a fundraising event

A community administrator can create an event and set its fundraising target. Event creation is authorized using a NEP-413 wallet signature.

### 4. Contribute through NEAR Intents

Contributors select a supported origin asset and amount. CircleHub prepares a NEAR Intents payment quote with NEAR USDC as the destination asset and the community DAO as the recipient.

The contributor receives deposit instructions. CircleHub checks the resulting transaction status and verifies settlement before treating the contribution as confirmed.

### 5. Plan with AI

The NEAR AI assistant uses community information to provide relevant budgeting, fundraising and spending guidance. It does not have permission to execute transactions or approve DAO proposals.

## NEAR ecosystem integrations

| Integration | Purpose |
|---|---|
| NEAR Protocol | Blockchain infrastructure and wallet interactions |
| SputnikDAO | Community treasury and governance |
| NEAR Intents / 1Click | Cross-asset contribution routing |
| NEAR AI | Community-aware financial planning assistant |
| NEP-413 | Wallet message authorization for protected actions |

### Why NEAR?

Community funds need transparent ownership and accountable spending decisions. NEAR provides the account and transaction infrastructure, while SputnikDAO supplies proposal-based governance. NEAR Intents extends contribution access beyond a single asset, and NEAR AI adds practical planning assistance.

## Technology stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- NEAR Protocol
- `@hot-labs/near-connect`
- `near-api-js`
- NEAR SputnikDAO
- NEAR Intents 1Click API
- NEAR AI API

## Architecture overview

```text
Community member
      |
      v
CircleHub web application
      |
      +------ NEAR wallet connection
      |              |
      |              v
      |         NEAR Protocol
      |              |
      |              v
      |          SputnikDAO
      |       Treasury + governance
      |
      +------ Fundraising events
      |              |
      |              v
      |         NEAR Intents
      |              |
      |       Cross-asset routing
      |              |
      |              v
      |         NEAR USDC
      |              |
      |              v
      |         DAO treasury
      |
      +------ Supabase
      |       Community metadata
      |       Events and contributions
      |       Wallet authorization nonces
      |
      +------ NEAR AI
              Budget assistant
```

Supabase stores application records and metadata. NEAR and SputnikDAO provide the on-chain treasury and governance layer. NEAR Intents handles contribution routing, while the AI assistant provides guidance without controlling community funds.

## Local development

### Requirements

- Node.js and npm
- A Supabase project
- A NEAR wallet for blockchain interactions
- API credentials for the integrations you want to use

### 1. Clone the repository

```bash
git clone https://github.com/theonlysamad7/Circlehub.git
cd Circlehub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Add your own credentials to `.env.local`. Never commit this file or share secret values.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side Supabase secret key |
| `NEAR_INTENTS_API_KEY` | NEAR Intents API authentication |
| `NEARAI_API_KEY` | NEAR AI API authentication |

Supabase is required for application data. NEAR Intents and NEAR AI credentials are required for their respective features.

### 4. Configure Supabase

Create a Supabase project and configure the database tables and columns expected by the application:

- `communities`
- `community_events`
- `event_auth_nonces`
- `event_contributions`

The server uses the Supabase secret key for database operations. Keep it server-side and never expose it through a `NEXT_PUBLIC_` variable.

### 5. Start the development server

```bash
npm run dev
```

Open http://localhost:3000.

For environments such as Termux where the default Next.js compiler may not be available, use:

```bash
npx next dev --webpack
```

### 6. Build for production

```bash
npx tsc --noEmit
npx next build --webpack
```

## Deployment

CircleHub is deployed on Vercel:

https://circlehub7.vercel.app

Add the required environment variables to the Vercel project settings for the relevant deployment environments, then deploy the `main` branch.

## Security and financial safeguards

- Protected event actions use NEP-413 wallet message signatures.
- Event authorization uses short-lived, one-time nonces.
- Contribution records remain provisional until settlement is independently checked.
- NEAR Intents quote signatures are verified during contribution status processing.
- Treasury transfers are submitted through DAO governance rather than executed by the AI assistant.
- USDC recipient registration may require a NEAR storage deposit.
- API credentials and Supabase secret keys must remain server-side.

Always verify transaction status and DAO proposal outcomes on-chain. Displayed estimates and pending contribution amounts should not be treated as confirmed funds.

## Project structure

```text
src/
  app/
    api/
      ai/
      communities/
      events/
      intents/
      near/
    community/
    communities/
  components/
  data/
  lib/
```

## Project status

CircleHub is an active hackathon project. The live demo and repository are provided above. Some operations depend on external services, wallet availability, DAO configuration and network conditions.

## License

No open-source license has been declared for this repository yet. All rights remain with the project owner unless a license is added.
## Local development

### Requirements

- Node.js and npm
- A Supabase project
- A NEAR wallet for blockchain interactions
- API credentials for the integrations you want to use

### 1. Clone the repository

```bash
git clone https://github.com/theonlysamad7/Circlehub.git
cd Circlehub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Add your own credentials to `.env.local`. Never commit this file or share secret values.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-side Supabase secret key |
| `NEAR_INTENTS_API_KEY` | NEAR Intents API authentication |
| `NEARAI_API_KEY` | NEAR AI API authentication |

Supabase is required for application data. NEAR Intents and NEAR AI credentials are required for their respective features.

### 4. Configure Supabase

Create a Supabase project and configure the database tables and columns expected by the application:

- `communities`
- `community_events`
- `event_auth_nonces`
- `event_contributions`

The server uses the Supabase secret key for database operations. Keep it server-side and never expose it through a `NEXT_PUBLIC_` variable.

### 5. Start development

```bash
npm run dev
```

Open http://localhost:3000.

For environments such as Termux, you can use:

```bash
npx next dev --webpack
```

### 6. Build for production

```bash
npx tsc --noEmit
npx next build --webpack
```

## Deployment

CircleHub is deployed on Vercel:

https://circlehub7.vercel.app

Add the required environment variables to the Vercel project settings for the relevant deployment environments, then deploy the `main` branch.

## Security and financial safeguards

- Protected event actions use NEP-413 wallet message signatures.
- Event authorization uses short-lived, one-time nonces.
- Contribution records remain provisional until settlement is independently checked.
- NEAR Intents quote signatures are verified during contribution status processing.
- Treasury transfers are submitted through DAO governance rather than executed by the AI assistant.
- USDC recipient registration may require a NEAR storage deposit.
- API credentials and Supabase secret keys must remain server-side.

Always verify transaction status and DAO proposal outcomes on-chain. Displayed estimates and pending contribution amounts should not be treated as confirmed funds.

## Project structure

```text
src/
  app/
    api/
      ai/
      communities/
      events/
      intents/
      near/
    community/
    communities/
  components/
  data/
  lib/
```

## Project status

CircleHub is an active hackathon project. Some operations depend on external services, wallet availability, DAO configuration and network conditions.

## License

No open-source license has been declared for this repository yet. All rights remain with the project owner unless a license is added.
