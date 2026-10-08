#!/usr/bin/env bash
# homekeeper-ai smoke tests — 11 checks. Exit non-zero on first failure.
set -u
cd "$(dirname "$0")/.."
PASS=0
check() { # $1 = description, rest = command
  local desc="$1"; shift
  if "$@" > /tmp/hk_smoke.log 2>&1; then
    echo "PASS: $desc"; PASS=$((PASS+1))
  else
    echo "FAIL: $desc"; sed 's/^/  /' /tmp/hk_smoke.log | head -20; exit 1
  fi
}

check "index.html exists" test -f index.html
check "css/style.css exists" test -f css/style.css
check "js/rules.js exists" test -f js/rules.js
check "js/planner.js exists" test -f js/planner.js
check "js/app.js exists" test -f js/app.js
check "rules.js syntax valid" node --check js/rules.js
check "planner.js syntax valid" node --check js/planner.js
check "app.js syntax valid" node --check js/app.js
check "rule bank has 60+ tasks" node -e "
  require('./js/rules.js');
  var n = globalThis.HK.RULES.length;
  if (n < 60) { console.error('only ' + n + ' rules'); process.exit(1); }
  console.log(n + ' rules');
"
check "every rule has required fields and valid months" node -e "
  require('./js/rules.js');
  var bad = [];
  globalThis.HK.RULES.forEach(function (r, i) {
    ['id','title','desc','effort','months','homeTypes','climates','neglect'].forEach(function (f) {
      if (r[f] === undefined || r[f] === null || r[f] === '') bad.push(i + ':' + f);
    });
    r.months.forEach(function (m) { if (m < 1 || m > 12) bad.push(i + ':bad-month'); });
    r.homeTypes.forEach(function (h) { if (['house','condo','apartment'].indexOf(h) === -1) bad.push(i + ':bad-hometype'); });
  });
  if (bad.length) { console.error(bad.join(', ')); process.exit(1); }
  console.log('all rules valid');
"
check "plan generates 12 named months" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var plan = globalThis.HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  if (plan.length !== 12) { console.error('months=' + plan.length); process.exit(1); }
  if (plan[0].name !== 'January' || plan[11].name !== 'December') { console.error('bad names'); process.exit(1); }
  console.log('12 months ok');
"
check "new planner fns exported (skip/progress/search/catchup)" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  ['taskCheckId','monthProgress','yearProgress','catchUp','searchTasks'].forEach(function (f) {
    if (typeof HK[f] !== 'function') { console.error('missing ' + f); process.exit(1); }
  });
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var yp = HK.yearProgress(plan, {}, {}, 2026);
  if (yp.length !== 12 || yp[0].name !== 'January' || typeof yp[0].total !== 'number') { console.error('yearProgress shape'); process.exit(1); }
  console.log('planner fns ok');
"
check "monthProgress counts done/skipped" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var jan = plan[0].tasks;
  var checks = {}, skipped = {};
  checks[HK.taskCheckId(jan[0], 2026)] = true;
  skipped[HK.taskCheckId(jan[1], 2026)] = true;
  var p = HK.monthProgress(jan, checks, skipped, 2026);
  if (p.done !== 1 || p.skipped !== 1 || p.total !== jan.length) { console.error(JSON.stringify(p)); process.exit(1); }
  var empty = HK.monthProgress(jan, {}, {}, 2026);
  if (empty.done !== 0 || empty.skipped !== 0) { console.error('empty counts'); process.exit(1); }
  console.log('monthProgress ok');
"
check "catchUp finds incomplete past-month tasks only" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var checks = {}, skipped = {};
  checks[HK.taskCheckId(plan[0].tasks[0], 2026)] = true;
  skipped[HK.taskCheckId(plan[1].tasks[0], 2026)] = true;
  var cu = HK.catchUp(plan, checks, skipped, 2026, 3);
  if (cu.some(function (x) { return x.monthName !== 'January' && x.monthName !== 'February'; })) { console.error('wrong months'); process.exit(1); }
  var janCount = plan[0].tasks.length, febCount = plan[1].tasks.length;
  if (cu.length !== (janCount - 1) + (febCount - 1)) { console.error('count ' + cu.length + ' vs ' + (janCount - 1 + febCount - 1)); process.exit(1); }
  console.log('catchUp ok: ' + cu.length + ' items');
"
check "searchTasks searches titles+descs across months" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true, pool: true });
  var hits = HK.searchTasks(plan, 'gutter');
  if (!hits.length) { console.error('no gutter hits'); process.exit(1); }
  if (hits.some(function (x) { return !x.monthName; })) { console.error('missing monthName'); process.exit(1); }
  if (HK.searchTasks(plan, 'zzz-no-match').length !== 0) { console.error('empty search wrong'); process.exit(1); }
  console.log('searchTasks ok: ' + hits.length + ' gutter hits');
"
check "new UI elements wired" bash -c "
  grep -q 'id=\"planSearch\"' index.html &&
  grep -q 'id=\"yearOverview\"' index.html &&
  grep -q 'id=\"printWeek\"' index.html &&
  grep -q 'id=\"catchUp\"' index.html &&
  grep -q 'planSearch' js/app.js &&
  grep -q '@media print' css/style.css
"
check "app.js wires skip button" bash -c "
  grep -q 'skipbtn' js/app.js && grep -q 'LS_SKIPPED' js/app.js
"

echo "SMOKE: $PASS/17 passed"
