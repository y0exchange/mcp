FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy shared package and mcp package
COPY packages/shared/ packages/shared/
COPY mcp/ mcp/

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build shared first, then mcp
RUN pnpm --filter @y0exchange/shared build && pnpm --filter @y0exchange/mcp build

# --- Production image ---
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/mcp/dist/ ./dist/
COPY --from=builder /app/mcp/package.json ./

# Remove workspace dependency (already bundled by tsup via noExternal)
RUN node -e "\
  const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));\
  delete pkg.dependencies['@y0exchange/shared'];\
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));\
"

# Install production deps only
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate \
    && pnpm install --prod --ignore-scripts \
    && rm -rf /root/.local/share/pnpm/store

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

CMD ["node", "dist/remote.js"]
