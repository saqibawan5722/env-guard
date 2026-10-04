FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
ENV DOCKER_BUILD_ID=102
EXPOSE 3000
CMD ["node", "src/server.js"]
