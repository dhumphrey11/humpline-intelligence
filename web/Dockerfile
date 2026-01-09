FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY web/package.json web/tsconfig.json web/next-env.d.ts web/next.config.js ./web/
RUN npm install
COPY web ./web
RUN npm --workspace @humpline/web run build
ENV NODE_ENV=production
CMD ["npm", "--workspace", "@humpline/web", "run", "start"]
