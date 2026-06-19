# shellcheck shell=bash
# Source from other scripts: source "$(dirname "$0")/lib/env.sh"

load_env_file() {
  local file="${1:-.env}"
  [[ -f "$file" ]] || return 0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${line#*=}"
    # shellcheck disable=SC2163
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}
