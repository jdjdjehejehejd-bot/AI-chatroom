#!/usr/bin/env bash
# 화면 테스트(Playwright, 한국어 로케일 기준). 필요: pip install playwright && playwright install chromium
# 서버는 이 스크립트가 띄우고 끝나면 정리한다. 실행: bash test/ui/run.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; cd "$HERE"
fail=0
pids=""
cleanup() { for p in $pids; do kill "$p" 2>/dev/null; done; }
trap cleanup EXIT
(cd "$ROOT" && PORT=3101 DEMO_DELAY_MS=300 REQUIRE_LOGIN=0 node server.js >/dev/null 2>&1 & echo $! >"$HERE/.p1")
(cd "$ROOT" && PORT=3102 DEMO_DELAY_MS=300 ALLOW_DEV_PLAN=1 REQUIRE_LOGIN=0 node server.js >/dev/null 2>&1 & echo $! >"$HERE/.p2")
sleep 1.5; pids="$(cat .p1) $(cat .p2)"; rm -f .p1 .p2
U1=http://127.0.0.1:3101; U2=http://127.0.0.1:3102
run() { name=$1; shift; out=$(timeout 240 python3 "$name.py" "$@" 2>&1); echo "== $name: $(echo "$out" | tail -1)"; if echo "$out" | grep -q '^FAIL\|Traceback\|Error'; then echo "$out" | grep '^FAIL\|Error' | head -5; fail=1; fi; }
for t in ui_test mode_test lib_test feat_test; do run $t $U1 $U2; done
for t in ig_test tools_test report_ui_test i18n_test; do run $t $U1; done
cleanup; pids=""
# 자체 서버를 띄우는 환경 도우미(백그라운드)
for pair in growth_env:growth_ui_test auth_ui_env:auth_ui_test; do
  env=${pair%%:*}; t=${pair##*:}
  (node $env.js >/dev/null 2>&1 &) ; sleep 2.5
  run $t
  for p in $(pgrep -x node); do kill $p 2>/dev/null; done
done
run safety_ui_test
exit $fail
