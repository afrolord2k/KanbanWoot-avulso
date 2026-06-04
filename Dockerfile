# build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV GENERATE_SOURCEMAP=false
RUN npm run build:clean

# production stage
FROM nginx:stable as production

RUN apt-get update -qq && apt-get install -y nodejs npm -qq

RUN mkdir -p /app/kanban-api

COPY --from=build /app/build /usr/share/nginx/html
COPY ./dockerizer/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./dockerizer/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY ./kanban-api/server.js /app/kanban-api/server.js
WORKDIR /app/kanban-api
RUN echo '{"name":"kanban-api","version":"1.0.0","main":"server.js"}' > package.json \
  && npm install pg --save --quiet

WORKDIR /
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
