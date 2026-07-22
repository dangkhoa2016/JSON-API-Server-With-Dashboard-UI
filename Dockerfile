FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache tini && \
    addgroup -S app && \
    adduser -S app app

COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/drizzle.config.ts ./
COPY .env.example .env.example

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R app:app /app

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

LABEL org.opencontainers.image.source="https://github.com/dangkhoa2016/JSON-API-Server-With-Dashboard-UI"
LABEL org.opencontainers.image.description="Full-stack CRUD application with REST + tRPC API and Vue 3 dashboard UI"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="1.0.0"

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/boot.js"]
