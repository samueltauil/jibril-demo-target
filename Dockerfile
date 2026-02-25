# ── Build stage: compile the C payload binary ────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Compile the demo payload (tiny, benign binary)
COPY src/payload.c ./
RUN gcc -O2 -static -o demo-payload payload.c

# Install Node deps
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache bash curl sudo

WORKDIR /app

# Install demo payload binary
COPY --from=builder /app/demo-payload /usr/local/bin/demo-payload
RUN chmod +x /usr/local/bin/demo-payload

# Create dirs used by scenarios
RUN mkdir -p /dev/shm /etc/sudoers.d /root/.ssh && \
    touch /root/.ssh/id_rsa && \
    echo "demo-fake-ssh-key" > /root/.ssh/id_rsa

# Install Node deps (all, since we run with tsx in dev mode)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:8080/health || exit 1

CMD ["npx", "tsx", "src/app.ts"]
