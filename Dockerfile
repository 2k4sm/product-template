# syntax=docker/dockerfile:1

FROM node:26.13.1-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:26.13.1-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY app.js server.js ./
COPY public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "server.js"]
