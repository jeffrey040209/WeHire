# Local development image. Source mounts do not hide Linux node_modules.
FROM node:24-bookworm-slim
WORKDIR /workspace/frontend

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3012
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
