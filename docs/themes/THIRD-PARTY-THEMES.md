# Third-Party Themes — Design Boundary (Audit 2.7)

**Status: DECISION REQUIRED — do not build a theme upload endpoint until an
isolation strategy below is chosen.** This document exists so nobody ships
"just a zip upload" without reading it.

## The constraint

A Matjar theme is a **React bundle executed on the merchant's storefront
origin**. Any JavaScript a theme ships runs with full access to:

- the shopper's `customer_token` in `localStorage` (see
  `storefront-themes/_shared/api/client.ts`) and any cookies scoped to the
  store domain;
- the storefront API surface as the logged-in shopper (cart, checkout,
  account, order history);
- the DOM of every page, including the checkout form.

Accepting **arbitrary, untrusted third-party JS** therefore hands a hostile
theme author every shopper session on every store that installs the theme.
That is a materially different trust model from first-party themes, where the
code is reviewed in this repo and deployed by us.

`middlewares/storefrontServe.js`'s protections (slug allowlist, path
containment, single-bundle expectations) are filesystem-boundary defenses for
**first-party** bundles. They do nothing about what the JS does once it runs.

## Phase 1 scope (current)

The SDK (audit Part 2: workspaces, `createThemeApp`, manifest single-sourcing,
`validate-theme`, mock dev server) targets **first-party and trusted-partner
themes only**. "Trusted partner" means: we read the source, we build the
bundle, we deploy it — the same pipeline as our own themes, just authored
elsewhere.

Everything in items 2.1–2.5 deliberately treats a theme as
"a directory containing `dist/manifest.json`", so a future upload path needs
only: extraction → package validation (2.5) → catalog sync (2.4). No
architectural rework is required later; only the isolation decision below.

## Candidate isolation strategies (pick one before building upload)

### A. Source-review pipeline (process, not tech)
Submissions arrive as **source**, not bundles. Automated lint (2.5's
`validate-theme` extended with JS static analysis: no `fetch` to non-platform
hosts, no `localStorage` access outside the SDK client, no `eval`/dynamic
import of remote code) plus **human review**, then WE build and deploy the
bundle through the existing pipeline.
- ✅ No runtime changes; full theme capability preserved; matches the
  "trusted partner" model at slightly larger scale.
- ❌ Doesn't scale to an open marketplace; review quality is the security
  boundary; supply-chain risk via theme npm deps must be pinned/vendored.

### B. Per-theme CSP + SRI + SDK-only network
Serve third-party bundles under a strict per-theme Content-Security-Policy:
`script-src` limited to the theme's own hashed bundles (SRI), `connect-src`
limited to the platform API origin, no inline script. Move the session token
out of `localStorage` into an `HttpOnly` cookie so theme JS cannot read it
(requires CSRF work on the API).
- ✅ Real technical containment of exfiltration channels; themes keep full
  rendering power.
- ❌ CSP cannot stop a malicious theme from *acting as* the shopper against
  the platform API (it runs on the origin); the token migration + CSRF is a
  meaningful auth project; UI-redressing on checkout remains possible.

### C. Iframe-isolated sections (capability sandbox)
Third-party code never runs on the storefront origin. A third-party "theme"
is a manifest + section definitions whose custom sections render inside
sandboxed cross-origin iframes with a narrow postMessage bridge (the
live-preview protocol in `ThemeProvider.tsx` is a starting point). Layout,
routing, cart, and checkout remain first-party.
- ✅ Strongest isolation; shopper session never exposed.
- ❌ Third parties can only style/compose sections, not ship whole themes;
  significant bridge/API design; performance cost per iframe.

## Recommendation (to be ratified)

Start with **A** for the first external partners (it is pure process on top
of the phase-1 SDK), and treat **B's token migration** (HttpOnly session +
CSRF) as independently valuable hardening to schedule regardless. Revisit C
only if an open marketplace becomes a product goal.

## Explicitly out of scope until a strategy is ratified

- `POST /themes/upload` or any zip-extraction endpoint.
- Marketplace listing/monetization for external authors.
- The Liquid templating engine described in
  `E-commerce Templating Engine Design.md` — superseded (see its banner).
