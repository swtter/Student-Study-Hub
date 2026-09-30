#!/bin/sh
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  for OLD_ENV in "../study-v0.4.1/.env" "../study-v0.4.0/.env" "../study-v0.3.2/.env" "../study-v0.3.1/.env" "../study-v0.3.0/.env" "../study-v0.2 2/.env" "../study-v0.2.2/.env" "../study-v0.2/.env" "../personal-workstation-v0.1.1/.env" "../uts-study-hub-vNext/.env"; do
    if [ -f "$OLD_ENV" ]; then
      cp "$OLD_ENV" .env
      break
    fi
  done
fi
[ -f .env ] || cp .env.example .env

GEMINI_KEY="$(osascript -e 'display dialog "Paste your Gemini API key. It will be stored only in the local Study folder." default answer "" with hidden answer buttons {"Cancel", "Save"} default button "Save" with title "Connect Gemini"' -e 'text returned of result' 2>/dev/null)" || exit 0
[ -n "$GEMINI_KEY" ] || exit 0

set_env_value() {
  KEY_NAME="$1"
  KEY_VALUE="$2"
  TEMP_FILE="$(mktemp -t study-env)"
  awk -v key="$KEY_NAME" -v value="$KEY_VALUE" 'BEGIN{found=0} index($0,key"=")==1{print key"="value;found=1;next}{print} END{if(!found)print key"="value}' .env > "$TEMP_FILE" && mv "$TEMP_FILE" .env
}

set_env_value "AI_PROVIDER" "gemini"
set_env_value "AI_API_KEY" "$GEMINI_KEY"
set_env_value "AI_MODEL" "gemini-3.8-flash"
set_env_value "AI_BASE_URL" ""

if [ -f .study.pid ]; then
  kill "$(cat .study.pid)" 2>/dev/null
  rm -f .study.pid
fi

osascript -e 'display dialog "Gemini is connected. Study will restart now." buttons {"OK"} default button "OK" with title "Gemini ready"' >/dev/null 2>&1
exec ./start-study.command
