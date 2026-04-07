# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production Stage
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/build ./build

# Enforce secure non-root execution
USER node

# Expose mapped port correlating to the Zod config bindings
EXPOSE 3000

# Execute server payload
CMD ["node", "build/server.js"]
