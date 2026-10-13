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

  // ---- neglect-cost parsing: "a $250–$600 repair" -> {low:250, high:600} ----
  // Returns the largest dollar range in the text, or null when none found.
  function parseNeglectDollars(text) {
    var re = /\$\s*([\d,]+)(?:\s*[-\u2013\u2014]\s*\$\s*([\d,]+))?/g;
    var best = null, m;
    while ((m = re.exec(String(text || ''))) !== null) {
      var lo = parseInt(m[1].replace(/,/g, ''), 10);
      var hi = m[2] ? parseInt(m[2].replace(/,/g, ''), 10) : lo;
      if (isNaN(lo)) continue;
      var r = { low: Math.min(lo, hi), high: Math.max(lo, hi) };
      if (!best || r.high > best.high) best = r;
    }
    return best;
  }

  // Effort strings -> minutes. Null when the effort is unknowable ("book a visit").
  function effortMinutes(effort) {
    var s = String(effort || '').toLowerCase().trim();
    if (!s) return null;
    if (/book a visit|call a pro|hire/.test(s)) return null;
    var m;
    if ((m = /(\d+)\s*[-\u2013\u2014]\s*(\d+)\s*hour/.exec(s))) return parseInt(m[1], 10) * 60;
    if ((m = /(\d+(?:\.\d+)?)\s*hour/.exec(s))) return Math.round(parseFloat(m[1]) * 60);
    if ((m = /(\d+)\s*min/.exec(s))) return parseInt(m[1], 10);
    if (/half day/.test(s)) return 240;
    if (/full day|all day/.test(s)) return 480;
    return null;
  }

  function taskDone(checks, task, year) { return !!(checks && checks[taskCheckId(task, year)]); }
  function taskSkipped(checks, skipped, task, year) {
    var cid = taskCheckId(task, year);
    return !(checks && checks[cid]) && !!(skipped && skipped[cid]);
  }

  // Money dodged: sum of headline neglect costs for completed (not skipped) tasks.
  function avoidedCost(months, checks, skipped, year) {
    var done = 0, low = 0, high = 0, unpriced = 0;
    months.forEach(function (mo) {
      mo.tasks.forEach(function (t) {
        if (!taskDone(checks, t, year) || taskSkipped(checks, skipped, t, year)) return;
        var r = parseNeglectDollars(t.neglect);
        if (r) { done++; low += r.low; high += r.high; }
        else unpriced++;
      });
    });
    return { tasks: done, low: low, high: high, unpriced: unpriced };
  }

  // Tasks due in monthNum you can knock out fast (default: 15 minutes or less).
  function quickWins(months, checks, skipped, year, monthNum, maxMinutes) {
    var cap = maxMinutes == null ? 15 : maxMinutes;
    var mo = months[monthNum - 1];
    if (!mo) return [];
    return mo.tasks.filter(function (t) {
      if (taskDone(checks, t, year) || taskSkipped(checks, skipped, t, year)) return false;
      var mins = effortMinutes(t.effort);
      return mins != null && mins <= cap;
    });
  }

  // ---- defer: push a task into next month instead of skipping it ----
  function deferTask(deferred, task, year) {
    var d = {}; for (var k in deferred) d[k] = deferred[k];
    d[taskCheckId(task, year)] = true;
    return d;
  }
  function undeferTask(deferred, task, year) {
    var d = {}; for (var k in deferred) d[k] = deferred[k];
    delete d[taskCheckId(task, year)];
    return d;
  }
  function isDeferred(deferred, task, year) {
    return !!(deferred && deferred[taskCheckId(task, year)]);
  }
  // Returns a copy of months with deferred tasks moved into the following
  // month (tagged deferredFrom). Check-ids stay on the original month so
  // done/skip state follows the task.
  function applyDeferred(months, deferred, year) {
    var out = months.map(function (mo) {
      return { month: mo.month, name: mo.name, tasks: mo.tasks.slice() };
    });
    if (!deferred) return out;
    for (var i = 0; i < out.length; i++) {
      var kept = [], moved = [];
      out[i].tasks.forEach(function (t) {
        // deferredFrom marks a task already moved this pass — never move twice.
        if (!t.deferredFrom && deferred[taskCheckId(t, year)]) {
          var c = {}; for (var k in t) c[k] = t[k];
          c.deferredFrom = out[i].name;
          moved.push(c);
        } else kept.push(t);
      });
      out[i].tasks = kept;
      var next = out[(i + 1) % out.length];
      next.tasks = next.tasks.concat(moved);
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
  g.HK.parseNeglectDollars = parseNeglectDollars;
  g.HK.effortMinutes = effortMinutes;
  g.HK.avoidedCost = avoidedCost;
  g.HK.quickWins = quickWins;
  // ---- money at risk: neglect costs of everything still open this year ----
  // The complement of avoidedCost: tasks neither done nor skipped.
  function riskExposure(months, checks, skipped, year) {
    var low = 0, high = 0, tasks = 0, unpriced = 0;
    months.forEach(function (mo) {
      mo.tasks.forEach(function (t) {
        if (taskDone(checks, t, year) || taskSkipped(checks, skipped, t, year)) return;
        var r = parseNeglectDollars(t.neglect);
        if (r) { tasks++; low += r.low; high += r.high; }
        else unpriced++;
      });
    });
    return { tasks: tasks, low: low, high: high, unpriced: unpriced };
  }

  // ---- completion notes: {checkId: text}, pure in/out ----
  function setNote(notes, task, year, text) {
    var n = {};
    for (var k in notes) n[k] = notes[k];
    var t = String(text == null ? "" : text).trim();
    if (t) n[taskCheckId(task, year)] = t;
    else delete n[taskCheckId(task, year)];
    return n;
  }
  function getNote(notes, task, year) {
    return (notes && notes[taskCheckId(task, year)]) || "";
  }

  // ---- pro hint: tasks whose effort means hiring out ----
  function needsPro(task) {
    return /book a visit|call a pro|hire/i.test(String((task && task.effort) || ""));
  }

  // ---- vendor rolodex: [{id, name, trade, phone, notes}] ----
  function addVendor(vendors, v) {
    vendors = vendors || [];
    var name = String((v && v.name) || "").trim();
    if (!name) return { ok: false, error: "Vendor needs a name." };
    var vendor = {
      id: "v" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name,
      trade: String((v && v.trade) || "").trim(),
      phone: String((v && v.phone) || "").trim(),
      notes: String((v && v.notes) || "").trim()
    };
    vendors.push(vendor);
    return { ok: true, vendor: vendor, vendors: vendors };
  }
  function deleteVendor(vendors, id) {
    return (vendors || []).filter(function (v) { return v.id !== id; });
  }

  g.HK.riskExposure = riskExposure;
  g.HK.setNote = setNote;
  g.HK.getNote = getNote;
  g.HK.needsPro = needsPro;
  g.HK.addVendor = addVendor;
  g.HK.deleteVendor = deleteVendor;
  g.HK.deferTask = deferTask;
  g.HK.undeferTask = undeferTask;
  g.HK.isDeferred = isDeferred;
  g.HK.applyDeferred = applyDeferred;
})(typeof globalThis !== 'undefined' ? globalThis : this);
