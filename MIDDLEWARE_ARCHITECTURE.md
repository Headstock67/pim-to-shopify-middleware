# Pendulum Ops Middleware: System Overview & Architecture

This document serves as the comprehensive, authoritative record of the `pendulum-ops-middleware` node. It maps out the exhaustive file structure, core responsibilities of every module, and the exact historical implementation steps taken to bridge Pendulum Ops with external scaling infrastructure (e.g., Cloudflare, Shopify, and Postgres).

---

## Part 1: Project Directory & Component Manifest

Below is the definitive structural map of the entire API middleware logic. Every file was systematically engineered to support extreme fault tolerance, fail-fast configurations, and dependency-light operation.

### Root Ecosystem
- **`StartMiddleware.sh`**: The primary operational bootscript. Executes the local environment hot-reloader (`nodemon`), mapping `dotenv` cleanly, allowing rapid iteration on port 4000.
- **`package.json`**: Outlines all strict zero-bloat dependencies. Excludes ORMs and heavy web frame architectures intentionally (utilizing native `pg`, standard `express`, `zod`, and `helmet`).
- **`Dockerfile` / `docker-compose.yml`**: Provisions containerization logic for production pipeline portability.
- **`jest.config.js`**: Core unit testing environment mapping natively enforcing tests cleanly across `.test.ts` definitions.
- **`.env`** (Ignored by Git): Retains critical secrets (`SHOPIFY_API_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`) explicitly protected via strict `.gitignore` inclusions.

### Application Logic (`src/`)

#### 1. Core Executables
- **`src/server.ts`**: The raw Node execution boundary. It explicitly binds `app.ts` to the configured `PORT` and securely registers asynchronous graceful-shutdown commands (SIGTERM, SIGINT) trapping open DB connections logically.
- **`src/app.ts`**: The main Express router scaffolding. Responsible natively for aggressively blocking unsafe browser requests via `helmet` (overriding default frameguards for Shopify), instantiating `asyncContext` logging, and declaring API endpoints.

#### 2. Configuration & State
- **`src/config/index.ts`**: The impenetrable Zod gatekeeper. Prevents the server from booting natively if essential variables (e.g. 64-hex Character Keys or valid Database URI strings) are structurally malformed. Imposes zero-trust on `.env` payloads.

#### 3. Execution Middleware (`src/middleware/`)
- **`asyncContext.ts`**: Safely injects unique `UUID` trace hashes securely deep into the call stack dynamically natively mapping isolated server loops to explicit log metrics natively.
- **`requestLogger.ts`**: Wraps the Node `pino-http` pipeline ensuring every endpoint execution safely organically reports to the console structurally.
- **`errorHandler.ts`**: Traps all untamed internal faults across the application cleanly preventing Native Node stack trace leaks to external browsers gracefully natively.

#### 4. Architecture Services (`src/services/`)
- **`db.ts`**: Exposes the single, immutable global Postgres connection logic natively utilizing `pg.Pool`. Ensures the system avoids transient connection throttling.
- **`encryption.ts`**: Pure symmetric AES-256-GCM cipher logic explicitly protecting and retrieving Shopify Tokens via a heavily bound 32-Byte buffer.
- **`shopifyHmac.ts`**: Implements raw alphabetical deterministic key-sorting logic verifying algorithmic origin guarantees.
- **`store.ts`**: Deprecated memory array logic that formerly retained authentication tokens.

#### 5. Routing Definitions (`src/routes/`)
- **`auth.ts`**: Executes the OAuth "start" and "callback" structural web logic physically trading native tokens securely via Shopify endpoints robustly.
- **`products.ts`**: Internal secure GraphQL diagnostic harness seamlessly rendering external Shopify products.
- **`root.ts`**: Evaluates native origin frames cleanly delivering React-less validation UI efficiently.
- **`health.ts`**: Unprotected infrastructure pulse physically pinging HTTP 200 properly.

#### 6. Utilities (`src/errors/`, `src/logging/`, `src/retry/`)
- **`AppError.ts`**: Application-level error structural prototype for consistent error payloads.
- **`index.ts` (Logging)**: Configures the core Pino logger instance for structured operational logging.
- **`index.ts` (Retry)**: Generic mathematical resilient backoff loop handler functionally dynamically enabling retry limits and exponential delays across HTTP calls.

---

## Part 2: Deployment & Scaffolding Journey

*(The following sections recount the specific steps taken to establish the middleware)*

## 1. Core Objectives & Tech Stack
The primary objective of this middleware is to serve as a secure, dependency-light bridge between the Pendulum Ops ecosystem and external platforms (primarily Shopify). 

**Tech Stack:**
- **Runtime:** Node.js + TypeScript
- **Web Framework:** Express.js
- **Validation:** Zod
- **Database:** PostgreSQL (via native `pg` client wrapper)
- **Security:** Helmet, pure symmetric Node `crypto` algorithms (AES-256-GCM)
- **Logging:** Pino
- **Infrastructure:** Cloudflare Tunnels (Local network ingress)

---

## 2. Infrastructure & Ingress (Cloudflare)
To natively handle OAuth callbacks and Shopify App verification, a public, HTTPS-secured ingress point was strictly required without compromising the local development environment.

1. **Cloudflare Integration:** We bound the domain `humanevolved.ai` to Cloudflare.
2. **Tunneling:** We established a persistent Cloudflare Tunnel pointing the public secure subdomain (e.g. `https://oauth.humanevolved.ai`) directly to `localhost:4000` running on the development machine.
3. **Implication:** All webhook traffic, OAuth handshakes, and Embedded App iframe requests hit the Cloudflare Edge and route securely inward, effectively replacing transient services like Ngrok for a static, production-like footprint.

---

## 3. Middleware Scaffolding & Request Pipeline
The base server was configured exclusively to handle strict, predictable environments with zero partial-start states.

1. **Strict Startup Validation:** Powered by Zod, the `config/index.ts` instantly crashes the server on boot if `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_REDIRECT_URI`, or `ENCRYPTION_KEY` are missing or mathematically invalid.
2. **Context Passing:** The `asyncContext.ts` module generates explicit UUIDs (`requestId`) at exactly the ingress edge, passing them natively throughout the execution cycle for robust, traceable logging.
3. **Helmet Security Parameters:** Since Shopify Embedded Apps are natively blocked by default `X-Frame-Options: SAMEORIGIN` headers, we surgically disabled the frameguard and implemented a strict, granular `Content-Security-Policy`.
    ```javascript
    frameAncestors: ["'self'", "https://*.myshopify.com", "https://admin.shopify.com"]
    ```

---

## 4. The Shopify OAuth Flow
We explicitly rejected using heavy, black-box libraries like Shopify CLI or external host databases, choosing to build a pure, transparent OAuth implementation tailored exactly to our constraints.

1. **Iframe Breakout (`GET /api/auth/start`)**:
   - Because Shopify blocks authorization pages natively rendering inside an iframe, the `/start` route evaluates a CSRF `state` nonce and intelligently returns an HTML snippet utilizing `window.top.location.href = ...` to force the host browser out of the iframe and towards the Shopify Permissions page.
2. **HMAC Integrity Validation**:
   - The system intercepts the Shopify callback and securely evaluates the `hmac` payload directly against the `SHOPIFY_API_SECRET` to prove the request explicitly originated from Shopify servers without interception.
3. **Offline Access Token Exchange**:
   - Following HMAC and state verification natively, a server-to-server POST request executes explicitly against Shopify to securely trade the authorization code for a permanent Offline Access Token dynamically.

---

## 5. Token Persistence & Cryptographic Security
To preserve tokens natively across server restarts without compromising on security, we built out a strict Postgres Database integration.

1. **Postgres Connection:** Configured a single, shared `pg.Pool` natively to ensure database calls behave asynchronously efficiently rather than transiently spinning up exhaustive single connections.
2. **Schema:**
   - A single, light table `shopify_sessions` binding the `shop` explicitly as the Primary Key natively preventing logical duplicates.
3. **App-Level Encryption (`src/services/encryption.ts`)**:
   - Instead of resting tokens locally as plaintext or relying exclusively on Database-level disk encryption, the token is intercepted natively by a symmetric AES-256-GCM cipher dynamically before touching the Postgres payload. 
   - Uses an explicit 32-byte `ENCRYPTION_KEY` statically stored in `.env`.
   - Produces safe `iv:authTag:ciphertext` payloads dynamically guaranteeing that if the database is breached natively, the offline tokens remain entirely useless cryptographically without the matching environment configuration natively.

---

## 6. The Product Diagnostic Harness
To explicitly prove the token capabilities natively, we mapped out a diagnostic user interface running actively inside the Shopify iframe organically.

1. **Diagnostic Form (`GET /`)**:
   - Detects the `shop` dynamically. Querying the Postgres DB securely confirms the offline token's presence intuitively.
   - If present natively, injects a pure HTML test harness supporting predetermined preset date math logically (Last 7, 30, 90 Days) and explicit From/To selections physically.
   - If missing, logically routes the user beautifully directly to the `/auth/start` execution.
2. **Server-Side Query Construction & Execution (`GET /api/products/harness`)**:
   - Evaluates the requested dates organically and constructs specific strict bounds: `created_at:>='YYYY-MM-DD' AND created_at:<='YYYY-MM-DD'`.
   - Executes securely against the Shopify `2026-01` GraphQL API seamlessly parsing output parameters effectively explicitly.
   - Supports forward cursor pagination correctly rendering `<a href="...&after=...">Next Page</a>` logic naturally perfectly handling >50 product constraints properly.

---

## Conclusion & Current Status
The current middleware scaffold actively represents a production-ready authentication and querying engine flawlessly decoupled from strict external dependencies.
