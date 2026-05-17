FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        default-mysql-client \
        git \
        unzip \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install gd mysqli pdo_mysql \
    && a2dismod mpm_event mpm_worker || true \
    && a2enmod mpm_prefork headers rewrite \
    && echo "ServerName localhost" > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY backend/ /var/www/html/

RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && mkdir -p storage/uploads storage/private/proofs storage/private/ids storage/public/rooms storage/public/boarding_houses storage/profiles \
    && chown -R www-data:www-data storage vendor

CMD ["bash", "-lc", "set -e; export APACHE_PORT=${PORT:-80}; sed -i \"s/^Listen .*/Listen ${APACHE_PORT}/\" /etc/apache2/ports.conf; sed -i \"s/<VirtualHost \\*:[0-9][0-9]*>/<VirtualHost *:${APACHE_PORT}>/\" /etc/apache2/sites-available/000-default.conf; a2dismod mpm_event mpm_worker >/dev/null 2>&1 || true; a2enmod mpm_prefork >/dev/null 2>&1 || true; apache2-foreground"]
