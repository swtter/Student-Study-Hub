#!/bin/sh
cd "$(dirname "$0")"
PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [ ! -f .env ]; then
  for OLD_ENV in "../study-v0.5.0/.env" "../study-v0.4.1/.env" "../study-v0.4.0/.env" "../study-v0.3.2/.env" "../study-v0.3.1/.env" "../study-v0.3.0/.env" "../study-v0.2 2/.env" "../study-v0.2.2/.env" "../study-v0.2/.env" "../personal-workstation-v0.1.1/.env" "../uts-study-hub-vNext/.env"; do
    if [ -f "$OLD_ENV" ]; then
      cp "$OLD_ENV" .env
      break
    fi
  done
fi

for OLD_PID_FILE in "../study-v0.5.0/.study.pid" "../study-v0.4.1/.study.pid" "../study-v0.4.0/.study.pid" "../study-v0.3.2/.study.pid" "../study-v0.3.1/.study.pid" "../study-v0.3.0/.study.pid" "../study-v0.2 2/.study.pid" "../study-v0.2.2/.study.pid" "../study-v0.2/.study.pid" "../personal-workstation-v0.1.1/.workstation.pid"; do
  if [ -f "$OLD_PID_FILE" ]; then
    OLD_PID="$(cat "$OLD_PID_FILE")"
    kill "$OLD_PID" 2>/dev/null
    rm -f "$OLD_PID_FILE"
  fi
done

if [ -f .study.pid ] && kill -0 "$(cat .study.pid)" 2>/dev/null; then
  open http://localhost:3001
  exit 0
fi

NODE_BIN="$(command -v node 2>/dev/null)"
if [ -z "$NODE_BIN" ]; then
  osascript -e 'display dialog "Study needs Node.js LTS to run. Install the macOS version, then open this launcher again." buttons {"OK", "Open Download Page"} default button "Open Download Page" with title "Node.js is required"' >/dev/null 2>&1
  open https://nodejs.org/en/download
  exit 1
fi

nohup "$NODE_BIN" server.js > study.log 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > .study.pid
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  rm -f .study.pid
  osascript -e 'display dialog "Study could not start. The error log will open now." buttons {"OK"} default button "OK" with title "Could not start Study"' >/dev/null 2>&1
  open -a TextEdit study.log
  exit 1
fi

open http://localhost:3001
