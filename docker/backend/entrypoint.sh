#!/usr/bin/env bash
set -euo pipefail

truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

configure_apache_port() {
  export APACHE_PORT="${PORT:-80}"
  sed -i "s/^Listen .*/Listen ${APACHE_PORT}/" /etc/apache2/ports.conf
  sed -i "s/<VirtualHost \*:[0-9][0-9]*>/<VirtualHost *:${APACHE_PORT}>/" /etc/apache2/sites-available/000-default.conf
  a2dismod mpm_event mpm_worker >/dev/null 2>&1 || true
  a2enmod mpm_prefork >/dev/null 2>&1 || true
}

mysql_args() {
  local db_host="${RENTEASE_DB_HOST:-${MYSQLHOST:-}}"
  local db_port="${RENTEASE_DB_PORT:-${MYSQLPORT:-3306}}"
  local db_name="${RENTEASE_DB_NAME:-${MYSQLDATABASE:-${MYSQL_DATABASE:-}}}"
  local db_user="${RENTEASE_DB_USER:-${MYSQLUSER:-${MYSQL_USER:-root}}}"

  if [ -z "$db_host" ] || [ -z "$db_name" ]; then
    return 1
  fi

  printf '%s\n' --protocol=TCP --host="$db_host" --port="$db_port" --user="$db_user" "$db_name"
}

prepare_mysql_password() {
  export MYSQL_PWD="${RENTEASE_DB_PASS:-${MYSQLPASSWORD:-${MYSQL_PASSWORD:-}}}"
}

wait_for_database() {
  local db_host="${RENTEASE_DB_HOST:-${MYSQLHOST:-}}"
  local db_port="${RENTEASE_DB_PORT:-${MYSQLPORT:-3306}}"
  local db_user="${RENTEASE_DB_USER:-${MYSQLUSER:-${MYSQL_USER:-root}}}"

  if [ -z "$db_host" ]; then
    echo "Skipping database migration: database host is not configured."
    return 1
  fi

  prepare_mysql_password

  for attempt in $(seq 1 30); do
    if mysqladmin --protocol=TCP --host="$db_host" --port="$db_port" --user="$db_user" ping --silent >/dev/null 2>&1; then
      return 0
    fi

    echo "Waiting for database connection (${attempt}/30)..."
    sleep 2
  done

  echo "Database did not become ready in time."
  return 1
}

run_sql_file() {
  local sql_file="$1"
  mapfile -t args < <(mysql_args)
  prepare_mysql_password
  mysql "${args[@]}" < "$sql_file"
}

table_count() {
  local table="$1"
  mapfile -t args < <(mysql_args)
  prepare_mysql_password
  mysql --batch --skip-column-names "${args[@]}" --execute="SELECT COUNT(*) FROM ${table};" 2>/dev/null || true
}

run_database_setup() {
  local auto_migrate="${RENTEASE_AUTO_MIGRATE:-true}"
  local auto_seed="${RENTEASE_AUTO_SEED:-true}"

  if ! truthy "$auto_migrate" && ! truthy "$auto_seed"; then
    return 0
  fi

  if ! wait_for_database; then
    return 0
  fi

  if truthy "$auto_migrate"; then
    echo "Applying RentEase base schema..."
    run_sql_file "/opt/rentease/database/rentease_base_schema.sql"
  fi

  if truthy "$auto_seed"; then
    local users_count
    users_count="$(table_count users | tr -d '[:space:]')"

    if [ "$users_count" = "0" ]; then
      echo "Applying RentEase staging seed because users table is empty..."
      run_sql_file "/opt/rentease/database/staging_seed.sql"
    else
      echo "Skipping staging seed because users table already has data."
    fi
  fi
}

configure_apache_port
run_database_setup

exec apache2-foreground
