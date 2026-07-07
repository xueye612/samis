#!/usr/bin/env bash
# 统一 Node 运行器（固定 Node 22.11.0 LTS，对应 .nvmrc / .node-version）。
# 用法：
#   scripts/node-run.sh <npm script 或命令>
# 示例：
#   scripts/node-run.sh test
#   scripts/node-run.sh build
#   scripts/node-run.sh "vue-tsc --noEmit"
#
# 挂载项目目录到容器 /app，复用本地 node_modules（避免重复安装）。
set -euo pipefail

NODE_IMAGE="node:22.11.0-bookworm-slim"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <command>   (e.g. test, build, \"vue-tsc --noEmit\")" >&2
  exit 1
fi

# 单个 npm script 名直接跑 npm run；否则原样执行。
case "$1" in
  test|build|dev|dev:real|test:e2e|test:e2e:ui|test:screenshot|test:smoke|preview:local|lint:style)
    CMD="npm run $1"
    ;;
  *)
    CMD="$*"
    ;;
esac

exec docker run --rm \
  -v "$PROJECT_DIR:/app" \
  -w /app \
  --network host \
  "$NODE_IMAGE" \
  bash -lc "echo \"[node-run] Node \$(node -v) | npm \$(npm -v)\"; $CMD"
