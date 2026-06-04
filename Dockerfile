# build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV GENERATE_SOURCEMAP=false
RUN npm run build:clean

# production stage
FROM node:18-alpine as production

# Instalar nginx
RUN apk add --no-cache nginx

# Criar diretórios necessários
RUN mkdir -p /usr/share/nginx/html /run/nginx /app/kanban-api

# Copiar build do React
COPY --from=build /app/build /usr/share/nginx/html

# Copiar configuração do nginx
COPY ./dockerizer/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar entrypoint
COPY ./dockerizer/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copiar e instalar a Kanban API
COPY ./kanban-api/server.js /app/kanban-api/server.js
WORKDIR /app/kanban-api
RUN echo '{"name":"kanban-api","version":"1.0.0","main":"server.js"}' > package.json \
  && npm install pg --save --quiet

WORKDIR /
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
