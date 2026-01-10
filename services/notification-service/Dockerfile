FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/notification-service/package.json services/notification-service/tsconfig.json ./services/notification-service/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/notification-service ./services/notification-service
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/notification-service run build
ENV NODE_ENV=production
CMD ["node", "services/notification-service/dist/index.js"]
