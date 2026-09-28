#!/usr/bin/env bash
# homekeeper-ai e2e tests — 7 flows exercised through the real planner logic in Node.
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

if (failures) { console.log('E2E: ' + failures + ' flow(s) FAILED'); process.exit(1); }
console.log('E2E: 7/7 flows passed');
EOF
