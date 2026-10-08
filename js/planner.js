/* homekeeper-ai planner
 * generatePlan(profile, extraTasks) -> 12-month personalized calendar.
 * Pure logic, no DOM. Loadable in browser and Node.
 */
(function (g) {
  g.HK = g.HK || {};

  var MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

  // Heating types assumed to burn fuel (gas/oil) -> CO detector rules apply.
  var FUEL_HEATING = ['forced-air', 'boiler', 'radiator'];

  function profileValue(p, key) {
    return !!(p && p[key]);
  }

  // Derive virtual flags from the raw profile.
  function derive(p) {
    var d = {};
    var k;
    for (k in p) d[k] = p[k];
    // CO rules key off `fuel`; derive from heating type.
    if (FUEL_HEATING.indexOf(p.heating) !== -1) d.fuel = true;
    // Condos/apartments rarely own these even if checked; keep as-is (user's call).
    return d;
  }

  function matches(rule, dp) {
    if (rule.homeTypes.indexOf(dp.homeType) === -1) return false;
    if (rule.climates.indexOf(dp.climate) === -1) return false;
    if (rule.heating && rule.heating.indexOf(dp.heating) === -1) return false;
    if (rule.needs) {
      for (var key in rule.needs) {
        if (rule.needs[key] && !profileValue(dp, key)) return false;
      }
    }
    return true;
  }

  // extraTasks: [{id,title,desc,effort,neglect,months:[...] }]
  function generatePlan(profile, extraTasks) {
    var dp = derive(profile || {});
    var months = [];
    for (var m = 1; m <= 12; m++) {
      var tasks = [];
      for (var i = 0; i < g.HK.RULES.length; i++) {
        var r = g.HK.RULES[i];
        if (r.months.indexOf(m) !== -1 && matches(r, dp)) {
          tasks.push({ id: r.id, title: r.title, desc: r.desc, effort: r.effort,
                       neglect: r.neglect, month: m, custom: false });
        }
      }
      if (extraTasks) {
        for (var j = 0; j < extraTasks.length; j++) {
          var c = extraTasks[j];
          if (c.months && c.months.indexOf(m) !== -1) {
            tasks.push({ id: 'custom-' + c.id, title: c.title, desc: c.desc || '',
                         effort: c.effort || '', neglect: c.neglect || '', month: m, custom: true });
          }
        }
      }
      months.push({ month: m, name: MONTH_NAMES[m - 1], tasks: tasks });
    }
    return months;
  }

  // ISO-8601 week key like "2026-W39" for streak tracking.
  function weekKey(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = (d.getUTCDay() + 6) % 7; // Monday=0
    d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
    var firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    var fday = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
    var week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
    var y = d.getUTCFullYear();
    return y + '-W' + (week < 10 ? '0' + week : week);
  }

  // Previous week key, for streak math.
  function prevWeekKey(key) {
    var parts = key.split('-W');
    var y = parseInt(parts[0], 10), w = parseInt(parts[1], 10);
    if (w > 1) return y + '-W' + (w - 1 < 10 ? '0' + (w - 1) : (w - 1));
    // week 1 -> last week of previous year (use Dec 28, always in last ISO week)
    return weekKey(new Date(y - 1, 11, 28));
  }

  // Streak = consecutive completed weeks ending at currentKey (inclusive).
  function streakLength(completedWeeks, currentKey) {
    var n = 0, k = currentKey;
    while (completedWeeks.indexOf(k) !== -1) { n++; k = prevWeekKey(k); }
    return n;
  }

  // Check-id convention matches app.js: task.id + ':' + year + '-' + task.month.
  function taskCheckId(task, year) {
    return task.id + ':' + year + '-' + task.month;
  }

  // done / skipped / total for one month's task list.
  function monthProgress(monthTasks, checks, skipped, year) {
    var done = 0, skip = 0;
    for (var i = 0; i < monthTasks.length; i++) {
      var cid = taskCheckId(monthTasks[i], year);
      if (checks && checks[cid]) done++;
      else if (skipped && skipped[cid]) skip++;
    }
    return { done: done, skipped: skip, total: monthTasks.length };
  }

  // Per-month progress for the whole year: [{month, name, done, skipped, total}].
  function yearProgress(months, checks, skipped, year) {
    return months.map(function (mo) {
      var p = monthProgress(mo.tasks, checks || {}, skipped || {}, year);
      return { month: mo.month, name: mo.name, done: p.done, skipped: p.skipped, total: p.total };
    });
  }

  // Tasks from past months that were never done or skipped — [{task, monthName}].
  function catchUp(months, checks, skipped, year, currentMonth) {
    var out = [];
    for (var m = 0; m < months.length; m++) {
      var mo = months[m];
      if (mo.month >= currentMonth) continue;
      for (var i = 0; i < mo.tasks.length; i++) {
        var cid = taskCheckId(mo.tasks[i], year);
        if (!(checks && checks[cid]) && !(skipped && skipped[cid]))
          out.push({ task: mo.tasks[i], monthName: mo.name });
      }
    }
    return out;
  }

  // Search every month's tasks by title/desc — [{task, monthName}].
  function searchTasks(months, q) {
    var t = String(q || '').trim().toLowerCase();
    if (!t) return [];
    var out = [];
    for (var m = 0; m < months.length; m++) {
      var mo = months[m];
      for (var i = 0; i < mo.tasks.length; i++) {
        var task = mo.tasks[i];
        if ((task.title + ' ' + (task.desc || '')).toLowerCase().indexOf(t) !== -1)
          out.push({ task: task, monthName: mo.name });
      }
    }
    return out;
  }

  g.HK.MONTH_NAMES = MONTH_NAMES;
  g.HK.matches = matches;
  g.HK.generatePlan = generatePlan;
  g.HK.weekKey = weekKey;
  g.HK.prevWeekKey = prevWeekKey;
  g.HK.streakLength = streakLength;
  g.HK.taskCheckId = taskCheckId;
  g.HK.monthProgress = monthProgress;
  g.HK.yearProgress = yearProgress;
  g.HK.catchUp = catchUp;
  g.HK.searchTasks = searchTasks;
})(typeof globalThis !== 'undefined' ? globalThis : this);
