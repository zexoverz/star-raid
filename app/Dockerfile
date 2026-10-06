# Star Raid web app: build app/ (it imports ../deployments), then serve dist/ and the share cards
# from a small Node server (app/server/index.mjs).
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY deployments ./deployments
COPY app/package.json app/pnpm-lock.yaml ./app/
RUN cd app && pnpm install --frozen-lockfile
COPY app ./app
ARG VITE_LIVE_URL=https://live-production-e50b.up.railway.app
ARG VITE_RPC_URL=https://testnet-rpc.monad.xyz
ENV VITE_LIVE_URL=$VITE_LIVE_URL VITE_RPC_URL=$VITE_RPC_URL
RUN cd app && pnpm build && pnpm prune --prod

FROM node:24-slim
WORKDIR /repo/app
ENV NODE_ENV=production
COPY --from=build /repo/app/node_modules ./node_modules
COPY --from=build /repo/app/dist ./dist
COPY --from=build /repo/app/server ./server
COPY --from=build /repo/app/src/lib/stars-meta.json ./src/lib/stars-meta.json
CMD ["node", "server/index.mjs"]
