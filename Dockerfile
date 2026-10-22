# Build context is the repository root.
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY data/ ./data/
COPY --from=client /app/client/dist ./client/dist
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "src/index.js"]
