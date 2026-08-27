# ─────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Install libc6-compat for native module compatibility (e.g. @solana/web3.js)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests first for Docker layer caching
COPY package.json package-lock.json ./

# Install production + dev dependencies (dev needed for build step)
RUN npm ci


# ─────────────────────────────────────────────────────────────────
# Stage 2: Build the application
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Bring in installed modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree
COPY . .

# Build-time environment variables required by Next.js
# These are injected at build time via --build-arg or docker-compose build.args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Produce the .next/standalone output (requires output: 'standalone' in next.config.js)
RUN npm run build


# ─────────────────────────────────────────────────────────────────
# Stage 3: Production runner (minimal image — no source, no devDeps)
# ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root system user for security best practice
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only the standalone build output and static assets
COPY --from=builder /app/public                            ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

USER nextjs

# Next.js standalone server listens on PORT (default 3000)
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone build produces a self-contained server.js
CMD ["node", "server.js"]
