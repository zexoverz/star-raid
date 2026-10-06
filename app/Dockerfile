# Star Raid web app: build app/ (it imports ../deployments) and serve the static build.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY deployments ./deployments
COPY app/package.json app/pnpm-lock.yaml ./app/
RUN cd app && pnpm install --frozen-lockfile
COPY app ./app
ARG VITE_LIVE_URL=https://live-production-e50b.up.railway.app
ARG VITE_RPC_URL=https://testnet-rpc.monad.xyz
ENV VITE_LIVE_URL=$VITE_LIVE_URL VITE_RPC_URL=$VITE_RPC_URL
RUN cd app && pnpm build

FROM caddy:2-alpine
COPY app/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/app/dist /srv
