FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY services/llm-commentary-service/package.json services/llm-commentary-service/tsconfig.json ./services/llm-commentary-service/
COPY shared/package.json shared/tsconfig.json ./shared/
RUN npm install
COPY shared ./shared
COPY services/llm-commentary-service ./services/llm-commentary-service
RUN npm --workspace @humpline/shared run build \
  && npm --workspace @humpline/llm-commentary-service run build
ENV NODE_ENV=production
CMD ["node", "services/llm-commentary-service/dist/index.js"]
