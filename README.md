# Pendulum Ops API Middleware

> **Status: Infrastructural Scaffold Only**
> This service acts as a foundational, production-ready scaffold. It currently has **zero** external integrations, **zero** Shopify domain logic, and **zero** functional API routes.

## Security & Architecture Assumptions
1. **Internal Only**: This middleware is **not** designed to be publicly exposed to the internet.
2. **Unauthenticated Health**: The `/health/live`, `/health/ready`, and `/health/status` endpoints do **not** have application-level authentication. They must be gated and restricted exclusively by the internal Docker network or your external load balancer / API Gateway.
3. **CORS is Restricted**: Cross-Origin requests are explicitly disabled globally by default, unless exact origins are supplied via `CORS_ALLOWED_ORIGINS`. Absolutely no wildcards are permitted.
4. **Resiliency Over Magic**: Unhandled promise rejections, parse errors, and config omissions explicitly crash the process rather than entering undefined "zombie" states. 

## Local Development
```bash
npm install
npm run dev
```

## Docker Orchestration
To boot this middleware securely alongside the wider workspace, execute Docker Compose from the **parent directory**:
```bash
cd ..
docker-compose up --build
```
This explicitly maps the middleware container natively onto the unified `pendulum_internal` bridge network. It strictly runs as the `node` user to sandbox file-system interactions.

**Exposure Safety Policy**: Docker compose is configured to bind the exposed port strictly to `127.0.0.1` locally. This explicitly prevents Docker's iptables from inadvertently opening port 3000 on the host machine to the wide internet, securely limiting access to localized development or the internal Docker bridge network.
