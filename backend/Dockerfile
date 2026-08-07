# Render offers no native PHP runtime for Web Services (only Node, Python,
# Ruby, Go, Rust, Elixir, or Docker) — this packages the Laravel backend to
# run under Docker instead. Two stages: build Filament's Vite assets with
# Node, then hand them to the PHP image that actually serves the app, so the
# final image doesn't carry a Node toolchain it never needs at runtime.

# ---------- Stage 1: Filament's Vite-built CSS/JS ----------
FROM node:20-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY resources/ resources/
RUN npm run build

# ---------- Stage 2: the PHP application ----------
FROM php:8.2-cli-bookworm AS app
WORKDIR /var/www/html

# pdo_pgsql/pgsql: Supabase Postgres. gd: dompdf embeds images in the
# Members List / Payment History PDF exports. zip + intl: common Laravel
# needs. bcmath: composer.json requires it directly.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libicu-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_pgsql pgsql bcmath zip intl gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . .
COPY --from=assets /app/public/build public/build

RUN composer install --no-dev --optimize-autoloader --no-interaction

# Render sets $PORT at runtime (not a fixed value), so this has to be a shell
# command (not exec-form CMD) for the variable to actually expand.
CMD php artisan config:cache && php artisan serve --host 0.0.0.0 --port ${PORT:-10000}
