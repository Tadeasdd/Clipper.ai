# Clipper.ai frontend — Vite + React dev server for the local stack. Serves the
# marketing site, the /ops dashboard, and the /portal, proxying /api to the
# backend container (BACKEND_ORIGIN). This is the dev/demo image; production
# ships the static `vite build` output behind a CDN/host.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# --host binds 0.0.0.0 so the port is reachable from the host machine.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
