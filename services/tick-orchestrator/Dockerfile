FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/tick-orchestrator/package.json services/tick-orchestrator/tsconfig.json ./services/tick-orchestrator/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/tick-orchestrator ./services/tick-orchestrator
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/tick-orchestrator run build
ENV NODE_ENV=production
CMD ["node", "services/tick-orchestrator/dist/index.js"]
