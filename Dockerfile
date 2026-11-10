# DEBONE website: small, production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server ./server
COPY public ./public
# Data (database, sessions, backups) lives in a volume so it survives redeploys
RUN mkdir -p /app/server/data && chown -R node:node /app
VOLUME ["/app/server/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server/server.js"]
