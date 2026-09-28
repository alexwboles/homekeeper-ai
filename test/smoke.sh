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

echo "SMOKE: $PASS/11 passed"
