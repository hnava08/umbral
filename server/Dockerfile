FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/src ./src
CMD ["node", "src/index.js"]
