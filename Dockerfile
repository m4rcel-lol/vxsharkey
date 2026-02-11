FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY src/ ./src/

FROM node:22-alpine

RUN apk add --no-cache tini
RUN addgroup -g 1001 -S vxsharkey && adduser -u 1001 -S vxsharkey -G vxsharkey

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

USER vxsharkey

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
