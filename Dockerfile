FROM node:20-alpine AS client-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:client

FROM node:20-alpine AS server-build
WORKDIR /app
COPY server/package*.json ./server/
COPY shared ./shared
COPY server ./server
RUN cd server && npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=client-build /app/dist ./dist
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/shared ./shared
RUN cd server && npm ci --omit=dev
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
