FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/ingestion-service/package.json services/ingestion-service/tsconfig.json ./services/ingestion-service/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/ingestion-service ./services/ingestion-service
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/ingestion-service run build
ENV NODE_ENV=production
CMD ["node", "services/ingestion-service/dist/index.js"]
