FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/api-service/package.json services/api-service/tsconfig.json ./services/api-service/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/api-service ./services/api-service
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/api-service run build
ENV NODE_ENV=production
CMD ["node", "services/api-service/dist/index.js"]
