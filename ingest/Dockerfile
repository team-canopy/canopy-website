# Canopy Website ingest shim — minimal, single-file Node service.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps against the committed lockfile for reproducible builds.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

# Run as the built-in unprivileged node user.
USER node

EXPOSE 8080
CMD ["node", "server.mjs"]
