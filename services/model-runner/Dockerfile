FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/model-runner/package.json services/model-runner/tsconfig.json ./services/model-runner/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/model-runner ./services/model-runner
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/model-runner run build
ENV NODE_ENV=production
CMD ["node", "services/model-runner/dist/index.js"]
