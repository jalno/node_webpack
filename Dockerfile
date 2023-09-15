ARG PHP_TAG=7.4-cli-bullseye
ARG DEBIAN_FRONTEND=noninteractive
FROM php:${PHP_TAG}
RUN apt-get update && \
    apt-get install unzip -y --no-install-recommends && \
    curl -fsSL https://bun.sh/install | bash
COPY --chown=bun:bun . /home/bun/app

# VOLUME [ "/home/bun/app/packages/node_webpack/storage" ]

CMD [ "bun", "packages/node_webpack/nodejs/src/App.ts", "--help"]
