FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    DD_SERVICE=garage-billing-service \
    DD_ENV=production \
    DD_VERSION=1.0.0
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
EXPOSE 8081
USER node
CMD ["node", "dist/server.js"]
