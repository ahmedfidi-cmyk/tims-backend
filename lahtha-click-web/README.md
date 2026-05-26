# LAHTHA Web — Customer Storefront

Customer-facing storefront for LAHTHA. Implements the "how to buy" journey end-to-end with mock data while the backend domains are being built.

## Stack
- **Next.js 14** (App Router, RSC by default, `'use client'` only where state is needed)
- **TypeScript** strict mode
- **Tailwind CSS** with brand design tokens from [`docs/brand/BRAND-IDENTITY.md`](../docs/brand/BRAND-IDENTITY.md)
- Arabic-first (RTL, `lang="ar"`, IBM Plex Sans Arabic preferred)
- Cart state in `localStorage` (no backend dependency yet)

## Customer journey covered

```
/          Landing (hero + 4-step explainer + featured 3 devices)
/devices         Catalog of all devices
/devices/[id]    Device detail + BNPL preview + add/buy
/cart            Cart with quantity controls + 5% commission breakdown
/checkout        Form + payment method (Tabby primary, Tamara, Card disabled)
/checkout/success  Confirmation page
```

## Run locally

```bash
cd lahtha-click-web
npm install
npm run dev
# open http://localhost:3001
```

The site lives on **port 3001** so it doesn't collide with the backend's `:3000`.

## Build for production

```bash
npm run build
npm start
```

## Layout

```
lahtha-click-web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # RTL root layout + header + footer
│   │   ├── page.tsx                # landing
│   │   ├── globals.css             # Tailwind + design tokens
│   │   ├── devices/
│   │   │   ├── page.tsx            # catalog
│   │   │   └── [id]/page.tsx       # detail
│   │   ├── cart/page.tsx
│   │   └── checkout/
│   │       ├── page.tsx
│   │       └── success/page.tsx
│   ├── components/
│   │   ├── brand/Logo.tsx          # LAHTHA SVG wordmark as React
│   │   ├── layout/SiteHeader.tsx   # client (cart badge)
│   │   └── cart/AddToCartButton.tsx
│   └── lib/
│       ├── money.ts                # halalat formatting + 5% commission
│       ├── cart/use-cart.ts        # localStorage cart hook
│       └── mock/devices.ts         # catalog fixtures (6 iPhones)
└── tailwind.config.ts              # brand tokens → Tailwind theme
```

## Design notes

- **Commission policy enforced visually**: 5% line item shown explicitly on cart, checkout summary, and (briefly) on device detail. The cap is also enforced in `money.ts`.
- **BNPL-first**: Tabby and Tamara are the only enabled payment options per the Stage-1 plan (see [`docs/adr/0002-bnpl-staging.md`](../docs/adr/0002-bnpl-staging.md)). Credit card is shown but disabled until commercial paperwork lands.
- **No real payment integration yet**: the checkout submit clears the cart and routes to `/checkout/success` after a 0.8s simulated delay. Real Tabby/Tamara handoff comes when the backend payment adapters land.

## What's next (follow-up workstreams)

- Vendor portal (`/vendor/*` routes) — register devices, view sales
- Admin dashboard (`/admin/*` routes) — KYC, disputes, financial view
- Backend integration: replace `MOCK_DEVICES` with `GET /api/devices` from `lahtha-click/`
- Real BNPL handoff via the payment-gateway adapter pattern
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
