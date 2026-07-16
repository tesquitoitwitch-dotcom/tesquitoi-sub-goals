FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY public ./public
EXPOSE 3000
CMD ["npm", "start"]
