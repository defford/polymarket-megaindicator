FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

COPY config ./config
COPY server ./server
COPY client ./client

RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev --workspace=server

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY config ./config

RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/server

CMD ["node", "dist/index.js"]
