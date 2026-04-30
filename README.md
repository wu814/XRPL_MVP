# XRPL MVP — XRPL Testnet DeFi dashboard

Full-stack web app for exploring **XRPL decentralized finance on Testnet**: wallets, asset management, trust lines, peer-to-peer DEX offers, automated market maker (AMM) pools and swaps, NFT minting/listing/trading, and simple social connections (friends & favorites).

**Production:** https://xrpl-hub.vercel.app/  

> **Note:** The app connects to **`wss://s.altnet.rippletest.net:51233`** (XRPL Testnet). Use Testnet faucets and experimental funds only — not production money.

---

## Features

| Area | What you get |
|------|----------------|
| **Auth** | Google sign-in via NextAuth; first-time username registration backed by Supabase |
| **Wallets** | Create and manage XRPL accounts; balances, flags, deposits, clawback, treasury views |
| **Assets & trustlines** | Trust lines; authorize / freeze-style flows exposed in the UI where implemented |
| **DEX** | Create and cancel offers; browse market and completed trades |
| **AMM** | Create pools; add/remove liquidity; swap with slippage controls |
| **NFTs** | Mint, list, and buy NFTs on Testnet |
| **Extras** | Transaction history; friends & pending requests; oracle-related tooling for displayed prices |

---

## Tech stack

- **Framework:** [Next.js](https://nextjs.org/) 15 (App Router), React 19, TypeScript  
- **Ledger:** [`xrpl`](https://js.xrpl.org/) SDK — Testnet WebSocket client  
- **Auth:** [NextAuth.js](https://next-auth.js.org/) (Google OAuth)  
- **Data / users:** [Supabase](https://supabase.com/) (`@supabase/ssr`)  
- **UI:** Tailwind CSS, Headless UI, Lucide icons  

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)  
- **npm** (or compatible package manager)  
- **Google Cloud OAuth** credentials (OAuth client ID + secret)  
- **Supabase** project with the `users` table and schema your app expects (see app code under `src/utils/auth` and API routes)

---

## Environment variables

Create a `.env.local` (never commit secrets) with at least:
```bash
# Supabase (public keys are bundled in the browser for client/server helpers)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Google OAuth (NextAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# NextAuth production (recommended for deployed URLs)
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=           # openssl rand -base64 32
```


For Google OAuth, set authorized redirect URIs to include:

https://your-domain.example/api/auth/callback/google
(and http://localhost:3000/api/auth/callback/google for local dev).

## Local development
```bash
npm install
npm run dev
```

Open http://localhost:3000 — landing page signs in with Google and routes registered users to the dashboard (/home).
