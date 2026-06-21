#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$(cd "$ROOT_DIR/../../KungFuBackendService/backend-service" 2>/dev/null && pwd || true)"
LOCAL_ENV="$ROOT_DIR/.env.dev.local"

if [[ -f "$LOCAL_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$LOCAL_ENV"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kungfu_school}"
DB_USER="${DB_USER:-$(id -un)}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-8000}"
API_URL="${VITE_API_URL:-http://localhost:$BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"
BACKEND_PID=""
BACKEND_LOG="${TMPDIR:-/tmp}/kungfu-backend-$$.log"

info() {
  printf '\n[%s] %s\n' "dev" "$1"
}

fail() {
  printf '\n[error] %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    info "Deteniendo backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

configure_java() {
  if command_exists java && java -version >/dev/null 2>&1; then
    return
  fi

  local candidate
  for candidate in \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/usr/lib/jvm/java-21-openjdk" \
    "/usr/lib/jvm/java-21-openjdk-amd64"; do
    if [[ -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      return
    fi
  done
}

check_requirements() {
  info "Comprobando requisitos..."

  command_exists node || fail "Falta Node.js 20.19 o superior. Instálalo antes de continuar."
  command_exists npm || fail "Falta npm. Instálalo junto con Node.js."
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)' \
    || fail "Se necesita Node.js 20.19 o superior (actual: $(node --version))."

  configure_java
  command_exists java || fail "Falta Java 21. En macOS: brew install openjdk@21"
  local java_major
  java_major="$(java -version 2>&1 | awk -F '"' '/version/ { split($2, parts, "."); print parts[1]; exit }')"
  [[ "$java_major" =~ ^[0-9]+$ ]] && (( java_major >= 21 )) \
    || fail "Se necesita Java 21 o superior."

  command_exists psql || fail "Falta PostgreSQL. En macOS: brew install postgresql@16"
  command_exists createdb || fail "No se encuentra createdb; revisa la instalación de PostgreSQL."
  command_exists pg_isready || fail "No se encuentra pg_isready; revisa la instalación de PostgreSQL."
  command_exists curl || fail "Falta curl, necesario para comprobar los servicios."

  [[ -n "$BACKEND_DIR" && -f "$BACKEND_DIR/gradlew" ]] \
    || fail "No encuentro KungFuBackendService/backend-service. Inicializa los submódulos del proyecto."
  [[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] \
    || fail "DB_NAME sólo puede contener letras, números y guiones bajos."
}

start_postgres_if_needed() {
  if PGPASSWORD="$DB_PASSWORD" pg_isready -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
    return
  fi

  if command_exists brew && [[ "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ]]; then
    local formula
    formula="$(brew list --formula 2>/dev/null | awk '/^postgresql(@[0-9]+)?$/ { value=$0 } END { print value }')"
    if [[ -n "$formula" ]]; then
      info "Arrancando PostgreSQL con Homebrew..."
      brew services start "$formula" >/dev/null
      for _ in $(seq 1 20); do
        if PGPASSWORD="$DB_PASSWORD" pg_isready -q -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
          return
        fi
        sleep 1
      done
    fi
  fi

  fail "PostgreSQL no responde en $DB_HOST:$DB_PORT. Revisa el servicio y las variables DB_* en .env.dev.local."
}

ensure_database() {
  info "Preparando PostgreSQL en $DB_HOST:$DB_PORT..."
  start_postgres_if_needed

  local database_exists
  database_exists="$(PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null)" \
    || fail "No puedo conectar con PostgreSQL como '$DB_USER'. Configura DB_USER y DB_PASSWORD en .env.dev.local."

  if [[ "$database_exists" != "1" ]]; then
    info "Creando base de datos '$DB_NAME'..."
    PGPASSWORD="$DB_PASSWORD" createdb \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
  else
    info "La base de datos '$DB_NAME' ya existe."
  fi
}

install_frontend_dependencies() {
  info "Instalando dependencias del frontend..."
  (cd "$ROOT_DIR" && npm install --no-audit --no-fund)
}

backend_is_ready() {
  curl -fsS "$API_URL/api/database/health" >/dev/null 2>&1
}

start_backend() {
  if backend_is_ready; then
    info "Backend ya disponible en $API_URL."
    return
  fi

  info "Arrancando backend y aplicando migraciones Flyway..."
  (
    cd "$BACKEND_DIR"
    DB_HOST="$DB_HOST" \
    DB_PORT="$DB_PORT" \
    DB_NAME="$DB_NAME" \
    DB_USER="$DB_USER" \
    DB_PASSWORD="$DB_PASSWORD" \
    SERVER_PORT="$BACKEND_PORT" \
      bash ./gradlew bootRun
  ) >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!

  for _ in $(seq 1 120); do
    if backend_is_ready; then
      info "Backend preparado. Log: $BACKEND_LOG"
      return
    fi

    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      tail -80 "$BACKEND_LOG" >&2 || true
      fail "El backend terminó antes de estar preparado."
    fi

    sleep 1
  done

  tail -80 "$BACKEND_LOG" >&2 || true
  fail "El backend no respondió después de 120 segundos."
}

seed_demo_data() {
  info "Comprobando datos de demostración..."
  (cd "$ROOT_DIR" && VITE_API_URL="$API_URL" npm run seed:demo -- --if-empty)
}

start_frontend() {
  if curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
    info "Frontend ya disponible en $FRONTEND_URL."
    if [[ -n "$BACKEND_PID" ]]; then
      info "Pulsa Ctrl+C para detener el backend iniciado por este comando."
      wait "$BACKEND_PID"
    fi
    return
  fi

  info "Todo preparado. Frontend: $FRONTEND_URL · Backend: $API_URL"
  info "Pulsa Ctrl+C para detener los servicios iniciados por este comando."
  (cd "$ROOT_DIR" && VITE_API_URL="$API_URL" npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT")
}

check_requirements
install_frontend_dependencies
ensure_database
start_backend
seed_demo_data
start_frontend
