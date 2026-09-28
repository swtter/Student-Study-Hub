#!/bin/sh
cd "$(dirname "$0")"

if [ -f .study.pid ]; then
  SERVER_PID="$(cat .study.pid)"
  kill "$SERVER_PID" 2>/dev/null
  rm -f .study.pid
fi
