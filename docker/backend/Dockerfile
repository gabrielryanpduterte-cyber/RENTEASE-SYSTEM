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
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY backend/ /var/www/html/

CMD ["bash", "-lc", "export APACHE_PORT=${PORT:-80}; sed -i \"s/Listen 80/Listen ${APACHE_PORT}/\" /etc/apache2/ports.conf; sed -i \"s/<VirtualHost \\*:80>/<VirtualHost *:${APACHE_PORT}>/\" /etc/apache2/sites-available/000-default.conf; composer install --no-interaction && mkdir -p storage/uploads storage/private/proofs storage/private/ids storage/public/rooms storage/public/boarding_houses storage/profiles && chown -R www-data:www-data storage || true; apache2-foreground"]
