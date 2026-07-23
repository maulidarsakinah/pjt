FROM node:24-bookworm-slim

ARG ORACLE_IC_VERSION=23.26.2.0.0
ARG ORACLE_IC_URL=https://download.oracle.com/otn_software/linux/instantclient/2326200v2/instantclient-basiclite-linux.x64-23.26.2.0.0.zip

ENV NODE_ENV=production
ENV PORT=3000
ENV ORACLE_USE_THICK_MODE=true
ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl libaio1 libnsl2 unzip \
  && mkdir -p /opt/oracle \
  && curl -fsSL "$ORACLE_IC_URL" -o /tmp/instantclient.zip \
  && unzip -q /tmp/instantclient.zip -d /opt/oracle \
  && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
  && rm -rf /tmp/instantclient.zip /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
