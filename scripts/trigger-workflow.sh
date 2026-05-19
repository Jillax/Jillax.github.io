#!/usr/bin/env bash
# 触发 GitHub Actions 工作流
# 用法: ./scripts/trigger-workflow.sh <workflow-file.yml>
# 例如: ./scripts/trigger-workflow.sh fetch-zhihu.yml

WORKFLOW="${1}"
if [ -z "$WORKFLOW" ]; then
  echo "请指定工作流文件名，例如: fetch-zhihu.yml"
  exit 1
fi

curl -s -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/Jillax/Jillax.github.io/actions/workflows/${WORKFLOW}/dispatches" \
  -d '{"ref":"main"}' \
  -w "\nHTTP: %{http_code}\n"