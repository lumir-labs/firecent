#!/usr/bin/env bash
# Container entrypoint: runs the web (Next standalone, :$PORT) and the MCP
# server (bun bundle, :$MCP_PORT) side by side. If either exits, the other is
# stopped and the container exits with that status so Dokploy restarts it.
set -uo pipefail

node apps/web/server.js &
WEB_PID=$!
bun apps/mcp/dist/index.js &
MCP_PID=$!

trap 'kill -TERM "$WEB_PID" "$MCP_PID" 2>/dev/null' TERM INT

wait -n "$WEB_PID" "$MCP_PID"
STATUS=$?
kill -TERM "$WEB_PID" "$MCP_PID" 2>/dev/null
wait
exit "$STATUS"
