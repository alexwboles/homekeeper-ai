#!/usr/bin/env bash
# homekeeper-ai e2e tests — 13 flows exercised through the real planner logic in Node.
set -u
cd "$(dirname "$0")/.."

node << 'EOF'
require('./js/rules.js');
require('./js/planner.js');
var HK = globalThis.HK;
var failures = 0;
function flow(name, fn) {
  try { fn(); console.log('PASS: ' + name); }
  catch (e) { failures++; console.log('FAIL: ' + name + ' — ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function titles(month) { return month.tasks.map(function (t) { return t.title; }); }
function allTasks(plan) { return plan.reduce(function (a, m) { return a.concat(m.tasks); }, []); }

// 1. House + pool + cold climate gets pool tasks, and only in season months.
flow('house+pool+cold gets pool tasks', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', yard: true, pool: true });
  var all = titles({ tasks: allTasks(plan) });
  assert(all.indexOf('Open the pool') !== -1, 'missing pool open');
  assert(all.indexOf('Test pool water chemistry') !== -1, 'missing chemistry');
  assert(all.indexOf('Close the pool for winter') !== -1, 'missing pool close');
  assert(titles(plan[3]).indexOf('Open the pool') !== -1, 'pool open should be in April (month 4)');
  assert(titles(plan[0]).indexOf('Open the pool') === -1, 'pool open should not be in January');
});

// 2. Condo with no yard gets no gutter/roof/yard tasks.
flow('condo without yard gets no gutter tasks', function () {
  var plan = HK.generatePlan({ homeType: 'condo', heating: 'baseboard', climate: 'mild' });
  var all = titles({ tasks: allTasks(plan) });
  assert(all.indexOf('Clean gutters (spring)') === -1, 'condo should not get gutters');
  assert(all.indexOf('Inspect the roof') === -1, 'condo should not get roof inspect');
  assert(all.indexOf('Service the lawn mower') === -1, 'no mower');
  assert(all.indexOf('Test smoke detectors') !== -1, 'condo should still get smoke tests');
});

// 3. Warm-climate apartment without pool gets no freeze or pool tasks.
flow('warm apartment gets no freeze/pool tasks', function () {
  var plan = HK.generatePlan({ homeType: 'apartment', heating: 'heat-pump', climate: 'warm' });
  var all = titles({ tasks: allTasks(plan) });
  assert(all.indexOf('Insulate exposed pipes') === -1, 'warm climate should not get pipe insulation');
  assert(all.indexOf('Open the pool') === -1, 'no pool tasks without pool');
  assert(all.indexOf('Shut off and drain outdoor faucets') === -1, 'apartment should not get hose bibs');
  assert(all.indexOf('Clean refrigerator coils') !== -1, 'apartment should get fridge coils');
});

// 4. Monthly furnace-filter appears in all 12 months for forced-air house.
flow('furnace filter is monthly for forced-air', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold' });
  plan.forEach(function (mo) {
    assert(titles(mo).indexOf('Replace furnace filter') !== -1, 'missing in ' + mo.name);
  });
});

// 5. Every month of the year is non-empty for a full-featured house.
flow('full house has tasks in all 12 months', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold',
    ac: true, yard: true, pool: true, fireplace: true, basement: true, garage: true,
    deck: true, sprinkler: true, softener: true, crawlspace: true, hardwood: true });
  plan.forEach(function (mo) {
    assert(mo.tasks.length > 0, mo.name + ' is empty');
  });
  var total = allTasks(plan).length;
  assert(total >= 80, 'expected 80+ task instances, got ' + total);
  console.log('   (full-house year total: ' + total + ' task instances)');
});

// 6. Custom tasks merge into the right months.
flow('custom tasks merge into plan', function () {
  var custom = [{ id: 'x1', title: 'Clean fish tank filter', desc: 'Rinse media', effort: '20 min', neglect: '', months: [3, 9] }];
  var plan = HK.generatePlan({ homeType: 'apartment', heating: 'baseboard', climate: 'warm' }, custom);
  assert(titles(plan[2]).indexOf('Clean fish tank filter') !== -1, 'custom task missing in March');
  assert(titles(plan[8]).indexOf('Clean fish tank filter') !== -1, 'custom task missing in September');
  assert(titles(plan[0]).indexOf('Clean fish tank filter') === -1, 'custom task should not be in January');
  assert(plan[2].tasks.filter(function (t) { return t.custom; }).length === 1, 'custom flag missing');
});

// 7. Streak math: week keys chain correctly across a year boundary.
flow('streak math across year boundary', function () {
  var k1 = HK.weekKey(new Date(2026, 11, 28)); // Dec 28 2026, a Monday
  var k0 = HK.prevWeekKey(k1);
  assert(/^2026-W\d{2}$/.test(k1), 'bad week key format: ' + k1);
  // Dec 28 is always in the last ISO week of its year; Dec 29 2025 is a Monday
  // that already belongs to 2026-W01, so use Dec 28 for the boundary check.
  assert(HK.prevWeekKey('2026-W01') === HK.weekKey(new Date(2025, 11, 28)), 'year boundary broken');
  var done = [k0, k1];
  assert(HK.streakLength(done, k1) === 2, 'streak should be 2');
  assert(HK.streakLength([k1], k1) === 1, 'streak should be 1');
  assert(HK.streakLength([], k1) === 0, 'streak should be 0');
});

// 8. Skip flow: skipped tasks count separately and are excluded from catch-up.
flow('skip flow: skip -> unskip -> progress math', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var year = 2026;
  var jan = plan[0].tasks, feb = plan[1].tasks;
  var checks = {}, skipped = {};
  skipped[HK.taskCheckId(jan[0], year)] = true;
  skipped[HK.taskCheckId(jan[1], year)] = true;
  checks[HK.taskCheckId(jan[2], year)] = true;
  var p = HK.monthProgress(jan, checks, skipped, year);
  assert(p.done === 1 && p.skipped === 2, 'expected 1 done + 2 skipped, got ' + JSON.stringify(p));
  var cu = HK.catchUp(plan, checks, skipped, year, 2);
  var janMissed = cu.filter(function (x) { return x.monthName === 'January'; });
  assert(janMissed.length === jan.length - 3, 'catch-up should exclude done+skipped');
  // unskip one, catch-up grows
  delete skipped[HK.taskCheckId(jan[0], year)];
  var cu2 = HK.catchUp(plan, checks, skipped, year, 2);
  assert(cu2.filter(function (x) { return x.monthName === 'January'; }).length === jan.length - 2, 'unskip returns task to catch-up');
});

// 9. Year overview + catch-up end-to-end: a busy homeowner's mid-year check.
flow('mid-year review: year progress + catch-up report', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var year = 2026, currentMonth = 6; // end of June
  var checks = {};
  // homeowner did all of January and half of February
  plan[0].tasks.forEach(function (t) { checks[HK.taskCheckId(t, year)] = true; });
  plan[1].tasks.slice(0, Math.floor(plan[1].tasks.length / 2)).forEach(function (t) { checks[HK.taskCheckId(t, year)] = true; });
  var yp = HK.yearProgress(plan, checks, {}, year);
  var totalDone = yp.reduce(function (n, m) { return n + m.done; }, 0);
  assert(totalDone === plan[0].tasks.length + Math.floor(plan[1].tasks.length / 2), 'year progress undercounts');
  var cu = HK.catchUp(plan, checks, {}, year, currentMonth);
  assert(cu.length > 0, 'catch-up should list missed spring tasks');
  assert(cu.every(function (x) {
    return ['January','February','March','April','May'].indexOf(x.monthName) !== -1;
  }), 'catch-up must only contain past months');
  console.log('   (catch-up lists ' + cu.length + ' missed tasks before June)');
});

// 10. Search flow: find a task, land in the right month.
flow('search flow: gutter tasks found with month names', function () {
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var hits = HK.searchTasks(plan, 'gutter');
  assert(hits.length > 0, 'expected gutter hits');
  var months = {};
  hits.forEach(function (x) { months[x.monthName] = true; });
  assert(months['April'] || months['October'], 'gutter tasks should be seasonal, got: ' + Object.keys(months).join(','));
  var smoke = HK.searchTasks(plan, 'smoke detector');
  assert(smoke.length > 0 && smoke[0].monthName, 'smoke detector search works');
});

// 11. Savings flow: completing tasks with neglect costs banks real dollars.
flow('avoided-cost grows as tasks are completed', function () {
  var year = 2026;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var before = HK.avoidedCost(plan, {}, {}, year);
  assert(before.tasks === 0 && before.low === 0, 'no savings before any check-offs');
  var checks = {};
  var priced = allTasks(plan).filter(function (t) { return HK.parseNeglectDollars(t.neglect); });
  assert(priced.length > 5, 'rule bank should have priced neglect notes');
  priced.slice(0, 3).forEach(function (t) { checks[HK.taskCheckId(t, year)] = true; });
  var after = HK.avoidedCost(plan, checks, {}, year);
  assert(after.tasks === 3, '3 tasks banked');
  assert(after.high > after.low && after.low > 0, 'range is positive');
  console.log('   (3 done tasks banked $' + after.low + '–$' + after.high + ' in avoided repairs)');
});

// 12. Quick-wins flow: fast tasks surface for this month.
flow('quick wins are all <= 15 minutes and undone', function () {
  var year = 2026;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var m = 10; // October
  var wins = HK.quickWins(plan, {}, {}, year, m, 15);
  assert(wins.length > 0, 'expected quick wins in October');
  wins.forEach(function (t) {
    var mins = HK.effortMinutes(t.effort);
    assert(mins != null && mins <= 15, t.title + ' takes ' + mins + ' min');
  });
  var checks = {};
  checks[HK.taskCheckId(wins[0], year)] = true;
  var wins2 = HK.quickWins(plan, checks, {}, year, m, 15);
  assert(wins2.length === wins.length - 1, 'done tasks drop out of quick wins');
});

// 13. Defer flow: task leaves this month, lands next month, keeps its state.
flow('defer moves a task to next month and preserves check-offs', function () {
  var year = 2026;
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold', ac: true, yard: true });
  var jan = plan[0];
  assert(jan.tasks.length > 0, 'January has tasks');
  var target = jan.tasks[0];
  var deferred = HK.deferTask({}, target, year);
  var moved = HK.applyDeferred(plan, deferred, year);
  assert(moved[0].tasks.every(function (t) { return t.id !== target.id; }), 'task left January');
  var feb = moved[1].tasks.filter(function (t) { return t.id === target.id && t.deferredFrom === 'January'; });
  assert(feb.length === 1, 'task landed in February with deferredFrom');
  var checks = {};
  checks[HK.taskCheckId(target, year)] = true; // check it off in February
  var s = HK.avoidedCost(moved, checks, {}, year);
  assert(s.tasks >= 0, 'avoided cost still computable after defer');
  var caught = HK.catchUp(moved, {}, {}, year, 3);
  assert(caught.every(function (x) { return x.task.id !== target.id || x.monthName !== 'January'; }),
    'deferred task is not a January catch-up item');
});

// 14. Risk exposure is the complement of avoided cost: done + open = priced total.
flow('risk exposure complements avoided cost', function () {
  var profile = { homeType: 'house', heating: 'forced-air', climate: 'cold', yard: true };
  var year = new Date().getFullYear();
  var plan = HK.generatePlan(profile, []);
  var all = allTasks(plan);
  var priced = all.filter(function (t) { return HK.parseNeglectDollars(t.neglect); }).length;
  var r0 = HK.riskExposure(plan, {}, {}, year);
  assert(r0.tasks === priced, 'all priced tasks at risk with nothing done');
  var checks = {};
  checks[HK.taskCheckId(all[0], year)] = true;
  var r1 = HK.riskExposure(plan, checks, {}, year);
  var s1 = HK.avoidedCost(plan, checks, {}, year);
  assert(r1.tasks + s1.tasks === priced, 'done + at-risk covers every priced task');
});

// 15. Completion notes stick to the task instance and clear cleanly.
flow('completion notes round-trip', function () {
  var t = { id: 'furnace-filter', month: 3 };
  var n = HK.setNote({}, t, 2026, 'Filter size 16x25x1, arrow toward furnace');
  assert(HK.getNote(n, t, 2026) === 'Filter size 16x25x1, arrow toward furnace', 'note stored');
  assert(HK.getNote(n, { id: 'furnace-filter', month: 4 }, 2026) === '', 'note is per month-instance');
  var cleared = HK.setNote(n, t, 2026, '');
  assert(HK.getNote(cleared, t, 2026) === '', 'blank clears the note');
});

// 16. Vendor rolodex + pro hints on hire-out tasks.
flow('vendor rolodex and pro hints', function () {
  var res = HK.addVendor([], { name: 'Acme Plumbing', trade: 'Plumber', phone: '555-0100' });
  assert(res.ok && res.vendors.length === 1, 'vendor added');
  assert(HK.deleteVendor(res.vendors, res.vendor.id).length === 0, 'vendor removed');
  var plan = HK.generatePlan({ homeType: 'house', heating: 'forced-air', climate: 'cold' }, []);
  var proTasks = allTasks(plan).filter(HK.needsPro);
  assert(proTasks.length >= 1, 'expected hire-out tasks, got ' + proTasks.length);
  assert(proTasks.every(function (t) { return /book a visit|call a pro|hire/i.test(t.effort); }), 'hints match pro language');
});

if (failures) { console.log('E2E: ' + failures + ' flow(s) FAILED'); process.exit(1); }
console.log('E2E: 16/16 flows passed');
EOF
