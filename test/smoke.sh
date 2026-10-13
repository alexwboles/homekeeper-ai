#!/usr/bin/env bash
# homekeeper-ai smoke tests — 23 checks. Exit non-zero on first failure.
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
check "parseNeglectDollars parses dollar ranges" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var r = HK.parseNeglectDollars('a \$250–\$600 repair');
  if (!r || r.low !== 250 || r.high !== 600) { console.error(JSON.stringify(r)); process.exit(1); }
  var r2 = HK.parseNeglectDollars('Emergency heat repair: \$300–\$1,500, usually on the coldest night.');
  if (!r2 || r2.low !== 300 || r2.high !== 1500) { console.error(JSON.stringify(r2)); process.exit(1); }
  var r3 = HK.parseNeglectDollars('A filter costs about \$5.');
  if (!r3 || r3.low !== 5 || r3.high !== 5) { console.error(JSON.stringify(r3)); process.exit(1); }
  if (HK.parseNeglectDollars('no dollars here') !== null) { console.error('false positive'); process.exit(1); }
  console.log('parseNeglectDollars ok');
"
check "effortMinutes parses effort strings" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var cases = [['5 min',5],['15 min',15],['30 min + wait',30],['1 hour',60],['1–2 hours',60],['2 hours',120],['half day',240],['book a visit',null],['',null]];
  cases.forEach(function (c) {
    var got = HK.effortMinutes(c[0]);
    if (got !== c[1]) { console.error(c[0] + ' -> ' + got + ' expected ' + c[1]); process.exit(1); }
  });
  console.log('effortMinutes ok');
"
check "avoidedCost sums completed neglect costs" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var months = [
    { month: 1, name: 'January', tasks: [
      { id: 'a', title: 'A', effort: '10 min', neglect: 'a \$250–\$600 repair', month: 1 },
      { id: 'b', title: 'B', effort: '10 min', neglect: 'no cost note', month: 1 }
    ]},
    { month: 2, name: 'February', tasks: [
      { id: 'c', title: 'C', effort: '10 min', neglect: 'a \$100 fix', month: 2 }
    ]}
  ];
  var checks = { 'a:2026-1': true, 'b:2026-1': true };
  var s = HK.avoidedCost(months, checks, {}, 2026);
  if (s.tasks !== 1 || s.low !== 250 || s.high !== 600 || s.unpriced !== 1) { console.error(JSON.stringify(s)); process.exit(1); }
  console.log('avoidedCost ok: ' + JSON.stringify(s));
"
check "quickWins lists only fast, undone tasks" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var months = [{ month: 1, name: 'January', tasks: [
    { id: 'a', title: 'A', effort: '5 min', month: 1 },
    { id: 'b', title: 'B', effort: '2 hours', month: 1 },
    { id: 'c', title: 'C', effort: '15 min', month: 1 },
    { id: 'd', title: 'D', effort: 'book a visit', month: 1 }
  ]}];
  var checks = { 'a:2026-1': true };
  var wins = HK.quickWins(months, checks, {}, 2026, 1, 15);
  if (wins.length !== 1 || wins[0].id !== 'c') { console.error(JSON.stringify(wins.map(function(w){return w.id;}))); process.exit(1); }
  console.log('quickWins ok');
"
check "defer moves a task to next month exactly once" node -e "
  require('./js/rules.js'); require('./js/planner.js');
  var HK = globalThis.HK;
  var months = [
    { month: 1, name: 'January', tasks: [{ id: 'a', title: 'A', effort: '10 min', month: 1 }] },
    { month: 2, name: 'February', tasks: [] },
    { month: 3, name: 'March', tasks: [] }
  ];
  var deferred = HK.deferTask({}, months[0].tasks[0], 2026);
  var out = HK.applyDeferred(months, deferred, 2026);
  if (out[0].tasks.length !== 0) { console.error('not removed from January'); process.exit(1); }
  if (out[1].tasks.length !== 1 || out[1].tasks[0].deferredFrom !== 'January') { console.error('not moved to February'); process.exit(1); }
  if (out[2].tasks.length !== 0) { console.error('cascaded to March'); process.exit(1); }
  if (!HK.isDeferred(deferred, months[0].tasks[0], 2026)) { console.error('isDeferred false'); process.exit(1); }
  var back = HK.undeferTask(deferred, months[0].tasks[0], 2026);
  if (HK.isDeferred(back, months[0].tasks[0], 2026)) { console.error('undefer failed'); process.exit(1); }
  console.log('defer ok');
"
check "new UI elements wired (savings, quick wins, defer)" bash -c "
  grep -q 'id=\"savings\"' index.html &&
  grep -q 'id=\"quickWins\"' index.html &&
  grep -q 'LS_DEFERRED' js/app.js &&
  grep -q 'renderSavings' js/app.js &&
  grep -q 'renderQuickWins' js/app.js
"
check "planner exports riskExposure/setNote/getNote/needsPro/addVendor/deleteVendor" node -e "
  require('./js/planner.js');
  var HK = globalThis.HK;
  ['riskExposure','setNote','getNote','needsPro','addVendor','deleteVendor'].forEach(function (f) {
    if (typeof HK[f] !== 'function') { console.error('missing ' + f); process.exit(1); }
  });
  // riskExposure: priced open tasks counted, done/skipped excluded
  var months = [{ month: 1, name: 'January', tasks: [
    { id: 'a', title: 'A', neglect: 'a \$250–\$600 repair', month: 1 },
    { id: 'b', title: 'B', neglect: 'a \$100 job', month: 1 },
    { id: 'c', title: 'C', neglect: '', month: 1 }
  ]}];
  var open = HK.riskExposure(months, {}, {}, 2026);
  if (open.tasks !== 2 || open.low !== 350 || open.high !== 700 || open.unpriced !== 1) { console.error(JSON.stringify(open)); process.exit(1); }
  var done = HK.riskExposure(months, { 'a:2026-1': true }, {}, 2026);
  if (done.tasks !== 1 || done.low !== 100) { console.error(JSON.stringify(done)); process.exit(1); }
  var skipped = HK.riskExposure(months, {}, { 'a:2026-1': true, 'b:2026-1': true }, 2026);
  if (skipped.tasks !== 0) { console.error(JSON.stringify(skipped)); process.exit(1); }
  // notes: set/get round-trip, blank clears, input map untouched
  var t = { id: 'a', month: 1 };
  var n0 = {};
  var n1 = HK.setNote(n0, t, 2026, 'Filter size 16x25x1');
  if (HK.getNote(n1, t, 2026) !== 'Filter size 16x25x1') process.exit(1);
  if (Object.keys(n0).length !== 0) { console.error('mutated input'); process.exit(1); }
  var n2 = HK.setNote(n1, t, 2026, '   ');
  if (HK.getNote(n2, t, 2026) !== '') process.exit(1);
  if (HK.getNote({}, t, 2026) !== '') process.exit(1);
  // needsPro: pro-language effort strings detected
  if (!HK.needsPro({ effort: 'book a visit' })) process.exit(1);
  if (!HK.needsPro({ effort: 'Call a pro' })) process.exit(1);
  if (HK.needsPro({ effort: '10 min' })) process.exit(1);
  if (HK.needsPro({})) process.exit(1);
  // vendors: validation, add, delete
  var bad = HK.addVendor([], { name: '   ' });
  if (bad.ok) { console.error('blank vendor accepted'); process.exit(1); }
  var good = HK.addVendor([], { name: \"Mike's HVAC\", trade: 'HVAC', phone: '555-1234', notes: 'great' });
  if (!good.ok || good.vendors.length !== 1 || !good.vendor.id) process.exit(1);
  if (good.vendor.name !== \"Mike's HVAC\" || good.vendor.trade !== 'HVAC') process.exit(1);
  var kept = HK.deleteVendor(good.vendors, 'nope');
  if (kept.length !== 1) process.exit(1);
  var gone = HK.deleteVendor(good.vendors, good.vendor.id);
  if (gone.length !== 0) process.exit(1);
  console.log('risk/notes/vendors ok');
"
check "new UI elements wired (risk line, notes, vendors)" bash -c "
  grep -q 'id=\"vendorSection\"' index.html &&
  grep -q 'id=\"vendorList\"' index.html &&
  grep -q 'id=\"addVendor\"' index.html &&
  grep -q 'renderVendors' js/app.js &&
  grep -q 'riskExposure' js/app.js &&
  grep -q 'needsPro' js/app.js &&
  grep -q 'LS_VENDORS' js/app.js
"

echo "SMOKE: $PASS/25 passed"
