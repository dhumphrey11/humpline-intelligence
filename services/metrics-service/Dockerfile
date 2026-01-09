FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/metrics-service/package.json services/metrics-service/tsconfig.json ./services/metrics-service/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/metrics-service ./services/metrics-service
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/metrics-service run build
ENV NODE_ENV=production
CMD ["node", "services/metrics-service/dist/index.js"]
