/* homekeeper-ai app UI — localStorage only, no network. */
(function () {
  'use strict';

  var LS_PROFILE = 'hk_profile_v1';
  var LS_CHECKS = 'hk_checks_v1';   // { "taskId:YYYY-M": true }
  var LS_WEEKS = 'hk_weeks_v1';     // ["2026-W39", ...] completed weeks
  var LS_CUSTOM = 'hk_custom_v1';   // [{id,title,desc,effort,neglect,months:[]}]
  var LS_SKIPPED = 'hk_skipped_v1'; // { "taskId:YYYY-M": true } skipped this month
  var LS_DEFERRED = 'hk_deferred_v1'; // { "taskId:YYYY-M": true } pushed to next month
  var LS_NOTES = 'hk_notes_v1';     // { "taskId:YYYY-M": "filter size 16x25x1" }
  var LS_VENDORS = 'hk_vendors_v1';  // [{id,name,trade,phone,notes}]

  function load(k, fb) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch (e) { return fb; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var profile = load(LS_PROFILE, null);
  var checks = load(LS_CHECKS, {});
  var weeksDone = load(LS_WEEKS, []);
  var customTasks = load(LS_CUSTOM, []);
  var skipped = load(LS_SKIPPED, {});
  var deferred = load(LS_DEFERRED, {});
  var notes = load(LS_NOTES, {});
  var vendors = load(LS_VENDORS, []);

  function el(id) { return document.getElementById(id); }

  function defaultProfile() {
    return { homeType: 'house', heating: 'forced-air', climate: 'cold',
      ac: true, yard: true, pool: false, fireplace: false, basement: false,
      garage: true, deck: false, sprinkler: false, softener: false,
      crawlspace: false, hardwood: true };
  }

  function fillForm() {
    var p = profile || defaultProfile();
    el('homeType').value = p.homeType;
    el('heating').value = p.heating;
    el('climate').value = p.climate;
    ['ac','yard','pool','fireplace','basement','garage','deck','sprinkler','softener','crawlspace','hardwood']
      .forEach(function (k) { el('f_' + k).checked = !!p[k]; });
  }

  function readForm() {
    var p = { homeType: el('homeType').value, heating: el('heating').value, climate: el('climate').value };
    ['ac','yard','pool','fireplace','basement','garage','deck','sprinkler','softener','crawlspace','hardwood']
      .forEach(function (k) { p[k] = el('f_' + k).checked; });
    return p;
  }

  function plan() {
    return HK.applyDeferred(HK.generatePlan(profile, customTasks), deferred, new Date().getFullYear());
  }

  function checkId(task, year) {
    return task.id + ':' + year + '-' + task.month;
  }

  function renderAll() {
    if (!profile) {
      el('planSection').style.display = 'none';
      el('weekSection').style.display = 'none';
      el('customSection').style.display = 'none';
      el('vendorSection').style.display = 'none';
      return;
    }
    el('planSection').style.display = '';
    el('weekSection').style.display = '';
    el('customSection').style.display = '';
    el('vendorSection').style.display = '';
    renderWeek();
    renderPlan();
    renderCustom();
    renderVendors();
    renderStreak();
  }

  function taskCard(t, year, monthLabel) {
    var cid = checkId(t, year);
    var done = !!checks[cid];
    var isSkipped = !done && !!skipped[cid];
    var div = document.createElement('div');
    div.className = 'task' + (done ? ' done' : '') + (isSkipped ? ' skipped' : '');
    var label = document.createElement('label');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = done;
    box.disabled = isSkipped;
    box.setAttribute('aria-label', 'Mark done: ' + t.title);
    box.addEventListener('change', function () {
      if (box.checked) { checks[cid] = true; delete skipped[cid]; save(LS_SKIPPED, skipped); }
      else delete checks[cid];
      save(LS_CHECKS, checks);
      renderAll();
    });
    var body = document.createElement('div');
    var h = document.createElement('div');
    h.className = 'task-title';
    h.textContent = t.title + (t.custom ? ' (custom)' : '') + (monthLabel ? '  · ' + monthLabel : '');
    var d = document.createElement('div');
    d.className = 'task-desc';
    d.textContent = t.desc;
    var meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = t.effort || '';
    body.appendChild(h); body.appendChild(d); body.appendChild(meta);
    if (t.neglect) {
      var n = document.createElement('div');
      n.className = 'neglect';
      n.textContent = t.neglect;
      body.appendChild(n);
    }
    if (HK.needsPro(t)) {
      var ph = document.createElement('div');
      ph.className = 'prohint';
      var pa = document.createElement('a');
      pa.href = '#vendorSection';
      pa.textContent = 'Needs a pro? See My pros';
      ph.appendChild(pa);
      body.appendChild(ph);
    }
    // Completion note: freeform text pinned to this task instance (e.g. filter size).
    var noteWrap = document.createElement('div');
    noteWrap.className = 'tasknote';
    (function paintNote() {
      noteWrap.innerHTML = '';
      var existing = HK.getNote(notes, t, year);
      if (existing) {
        var p = document.createElement('div');
        p.className = 'note-text';
        p.textContent = 'Note: ' + existing;
        noteWrap.appendChild(p);
      }
      var nb = document.createElement('button');
      nb.type = 'button';
      nb.className = 'skipbtn';
      nb.textContent = existing ? 'Edit note' : 'Add note';
      nb.addEventListener('click', function () {
        noteWrap.innerHTML = '';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.maxLength = 140;
        inp.value = existing;
        inp.placeholder = 'e.g. Filter size 16x25x1';
        inp.className = 'note-input';
        inp.setAttribute('aria-label', 'Task note');
        var sv = document.createElement('button');
        sv.type = 'button';
        sv.className = 'skipbtn';
        sv.textContent = 'Save';
        sv.addEventListener('click', function () {
          notes = HK.setNote(notes, t, year, inp.value);
          save(LS_NOTES, notes);
          renderAll();
        });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); sv.click(); }
        });
        noteWrap.appendChild(inp);
        noteWrap.appendChild(sv);
        inp.focus();
      });
      noteWrap.appendChild(nb);
    })();
    body.appendChild(noteWrap);
    if (isSkipped) {
      var sk = document.createElement('div');
      sk.className = 'skipnote';
      sk.textContent = 'Skipped this month';
      body.appendChild(sk);
    }
    var isDeferred = !done && HK.isDeferred(deferred, t, year);
    if (isDeferred) {
      var df = document.createElement('div');
      df.className = 'skipnote';
      df.textContent = 'Deferred from ' + (t.deferredFrom || 'last month') + ' — due this month';
      body.appendChild(df);
    }
    label.appendChild(box); label.appendChild(body);
    div.appendChild(label);
    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'skipbtn';
    skipBtn.textContent = isSkipped ? 'Unskip' : 'Skip';
    skipBtn.title = isSkipped ? 'Bring this task back' : 'Skip for this month';
    skipBtn.addEventListener('click', function () {
      if (isSkipped) delete skipped[cid];
      else { skipped[cid] = true; delete checks[cid]; }
      save(LS_SKIPPED, skipped); save(LS_CHECKS, checks);
      renderAll();
    });
    div.appendChild(skipBtn);
    var deferBtn = document.createElement('button');
    deferBtn.type = 'button';
    deferBtn.className = 'skipbtn';
    deferBtn.textContent = isDeferred ? 'Undefer' : 'Defer';
    deferBtn.title = isDeferred ? 'Move it back to its original month' : 'Push to next month';
    deferBtn.addEventListener('click', function () {
      if (isDeferred) deferred = HK.undeferTask(deferred, t, year);
      else { deferred = HK.deferTask(deferred, t, year); delete skipped[cid]; delete checks[cid]; }
      save(LS_DEFERRED, deferred); save(LS_SKIPPED, skipped); save(LS_CHECKS, checks);
      renderAll();
    });
    div.appendChild(deferBtn);
    return div;
  }

  // ---------- This week ----------
  function renderWeek() {
    var now = new Date();
    var year = now.getFullYear();
    var m = now.getMonth() + 1;
    var months = plan();
    var tasks = months[m - 1].tasks;
    var wrap = el('weekTasks');
    wrap.innerHTML = '';
    el('weekTitle').textContent = 'This month: ' + months[m - 1].name;
    if (!tasks.length) {
      wrap.innerHTML = '<p class="empty">Nothing scheduled this month. Enjoy the break — or add a custom task below.</p>';
    }
    tasks.forEach(function (t) { wrap.appendChild(taskCard(t, year)); });
    el('weekCount').textContent = tasks.length + ' task' + (tasks.length === 1 ? '' : 's');
    renderSavings(months, year);
    renderQuickWins(months, year, m);
    renderCatchUp(months, year, m);
    updateWeekProgress();
  }

  function fmtDollars(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  // Money dodged (done tasks) + money at risk (still-open tasks).
  function renderSavings(months, year) {
    var s = HK.avoidedCost(months, checks, skipped, year);
    var r = HK.riskExposure(months, checks, skipped, year);
    var wrap = el('savings');
    var html = '';
    if (s.tasks) html += '<strong>' + fmtDollars(s.low) + '–' + fmtDollars(s.high) + '</strong>' +
      ' in repairs dodged so far this year (' + s.tasks + ' task' + (s.tasks === 1 ? '' : 's') + ' done)';
    if (r.tasks) html += (html ? '<br>' : '') + '<span class="riskline">Still at risk: <strong>' +
      fmtDollars(r.low) + '–' + fmtDollars(r.high) + '</strong> if ' + r.tasks + ' open task' +
      (r.tasks === 1 ? '' : 's') + ' stay undone</span>';
    if (!html) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    wrap.innerHTML = html;
  }

  // Fast tasks due this month: knock them out in one coffee break.
  function renderQuickWins(months, year, m) {
    var wins = HK.quickWins(months, checks, skipped, year, m, 15);
    var wrap = el('quickWins');
    if (!wins.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    wrap.innerHTML = '<h3>Quick wins — 15 minutes or less (' + wins.length + ')</h3>';
    wins.forEach(function (t) { wrap.appendChild(taskCard(t, year)); });
  }

  // Incomplete tasks from earlier months, so they don't silently vanish.
  function renderCatchUp(months, year, currentMonth) {
    var wrap = el('catchUp');
    var items = HK.catchUp(months, checks, skipped, year, currentMonth);
    if (!items.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var h = document.createElement('h3');
    h.textContent = 'Catch up — missed from earlier months (' + items.length + ')';
    wrap.appendChild(h);
    items.forEach(function (x) { wrap.appendChild(taskCard(x.task, year, x.monthName)); });
  }

  function updateWeekProgress() {
    var now = new Date();
    var year = now.getFullYear();
    var m = now.getMonth() + 1;
    var tasks = plan()[m - 1].tasks;
    var doneCount = tasks.filter(function (t) { return checks[checkId(t, year)]; }).length;
    var skipCount = tasks.filter(function (t) {
      var cid = checkId(t, year);
      return !checks[cid] && skipped[cid];
    }).length;
    el('weekProgress').textContent = doneCount + ' of ' + tasks.length + ' done' +
      (skipCount ? ' · ' + skipCount + ' skipped' : '');
    var bar = el('weekBar');
    bar.style.width = (tasks.length ? Math.round(doneCount / tasks.length * 100) : 0) + '%';
    // Mark week complete when everything is checked.
    var wk = HK.weekKey(now);
    if (tasks.length && doneCount === tasks.length && weeksDone.indexOf(wk) === -1) {
      weeksDone.push(wk);
      save(LS_WEEKS, weeksDone);
      renderStreak();
    }
  }

  function renderStreak() {
    var s = HK.streakLength(weeksDone, HK.weekKey(new Date()));
    var badge = el('streak');
    badge.textContent = s > 0 ? s + '-week streak — your home thanks you' : 'No streak yet — finish this month\'s list to start one';
    badge.classList.toggle('hot', s > 0);
  }

  // ---------- 12-month plan ----------
  function renderPlan() {
    var now = new Date();
    var year = now.getFullYear();
    var months = plan();
    renderYearOverview(months, year);
    var tabs = el('monthTabs');
    var body = el('monthBody');
    tabs.innerHTML = '';
    var active = now.getMonth(); // 0-based
    var seasons = ['win', 'win', 'spr', 'spr', 'spr', 'sum', 'sum', 'sum', 'fal', 'fal', 'fal', 'win'];
    months.forEach(function (mo, idx) {
      var open = mo.tasks.filter(function (t) { return !checks[checkId(t, year)] && !skipped[checkId(t, year)]; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab season-' + seasons[idx] + (idx === active ? ' active' : '');
      b.innerHTML = mo.name.slice(0, 3) + ' <span class="tbadge">' + open + '</span>';
      b.title = mo.name + ': ' + open + ' of ' + mo.tasks.length + ' tasks open';
      b.addEventListener('click', function () {
        active = idx;
        el('planSearch').value = '';
        Array.prototype.forEach.call(tabs.children, function (c, i) {
          c.classList.toggle('active', i === active);
        });
        showMonth(idx);
      });
      tabs.appendChild(b);
    });
    function showMonth(idx) {
      body.innerHTML = '';
      var mo = months[idx];
      var h = document.createElement('h3');
      h.textContent = mo.name + ' ' + year + ' — ' + mo.tasks.length + ' tasks';
      body.appendChild(h);
      if (!mo.tasks.length) body.appendChild(emptyNote());
      mo.tasks.forEach(function (t) { body.appendChild(taskCard(t, year)); });
    }
    function emptyNote() {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Nothing scheduled. Add a custom task below if you like.';
      return p;
    }
    showMonth(active);
    var total = months.reduce(function (n, mo) { return n + mo.tasks.length; }, 0);
    el('planSummary').textContent = 'Your personalized year: ' + total + ' maintenance tasks across 12 months.';
  }

  // Month-by-month completion strip above the plan tabs.
  function renderYearOverview(months, year) {
    var prog = HK.yearProgress(months, checks, skipped, year);
    var seasons = ['win', 'win', 'spr', 'spr', 'spr', 'sum', 'sum', 'sum', 'fal', 'fal', 'fal', 'win'];
    var wrap = el('yearOverview');
    wrap.innerHTML = prog.map(function (p, idx) {
      var pct = p.total ? Math.round(p.done / p.total * 100) : 100;
      var label = p.done + '/' + p.total + (p.skipped ? ' · ' + p.skipped + ' skipped' : '');
      return '<div class="yom season-' + seasons[idx] + '" title="' + p.name + ': ' + label + '">' +
        '<span class="yom-name">' + p.name.slice(0, 3) + '</span>' +
        '<span class="yom-bar"><span style="width:' + pct + '%"></span></span>' +
        '<span class="yom-num">' + label + '</span></div>';
    }).join('');
  }

  // Search every month's tasks; results replace the month view until cleared.
  function renderPlanSearch(q) {
    var now = new Date();
    var year = now.getFullYear();
    var months = plan();
    var tabs = el('monthTabs');
    var body = el('monthBody');
    var hits = HK.searchTasks(months, q);
    tabs.innerHTML = '';
    body.innerHTML = '';
    var h = document.createElement('h3');
    h.textContent = hits.length + ' task' + (hits.length === 1 ? '' : 's') +
      ' matching "' + q + '" across the year';
    body.appendChild(h);
    hits.forEach(function (x) { body.appendChild(taskCard(x.task, year, x.monthName)); });
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ghost';
    clear.textContent = 'Clear search';
    clear.addEventListener('click', function () {
      el('planSearch').value = '';
      renderPlan();
    });
    body.appendChild(clear);
  }

  // ---------- Custom tasks ----------
  function renderCustom() {
    var list = el('customList');
    list.innerHTML = '';
    if (!customTasks.length) {
      list.innerHTML = '<p class="empty">No custom tasks yet. Add your own — e.g. "Clean fish tank filter".</p>';
    }
    customTasks.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'custom-row';
      var span = document.createElement('span');
      var months = c.months.map(function (m) { return HK.MONTH_NAMES[m - 1].slice(0, 3); }).join(', ');
      span.textContent = c.title + ' — ' + months;
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = 'Remove';
      del.addEventListener('click', function () {
        customTasks = customTasks.filter(function (x) { return x.id !== c.id; });
        save(LS_CUSTOM, customTasks);
        renderCustom(); renderPlan(); renderWeek();
      });
      div.appendChild(span); div.appendChild(del);
      list.appendChild(div);
    });
  }

  // ---------- Vendors (my pros) ----------
  function renderVendors() {
    var list = el('vendorList');
    list.innerHTML = '';
    if (!vendors.length) {
      list.innerHTML = '<p class="empty">No pros saved yet. Add your HVAC tech, plumber, electrician — whoever you actually call.</p>';
      return;
    }
    vendors.forEach(function (v) {
      var div = document.createElement('div');
      div.className = 'custom-row';
      var span = document.createElement('span');
      span.textContent = v.name + (v.trade ? ' — ' + v.trade : '') +
        (v.phone ? ' · ' + v.phone : '') + (v.notes ? ' (' + v.notes + ')' : '');
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = 'Remove';
      del.addEventListener('click', function () {
        vendors = HK.deleteVendor(vendors, v.id);
        save(LS_VENDORS, vendors);
        renderVendors();
      });
      div.appendChild(span);
      div.appendChild(del);
      list.appendChild(div);
    });
  }

  function monthOptions() {
    return HK.MONTH_NAMES.map(function (n, i) {
      return '<label class="mchk"><input type="checkbox" value="' + (i + 1) + '"> ' + n.slice(0, 3) + '</label>';
    }).join('');
  }

  function init() {
    el('customMonths').innerHTML = monthOptions();
    fillForm();
    el('profileForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      profile = readForm();
      save(LS_PROFILE, profile);
      var msg = el('profileMsg');
      msg.textContent = 'Home profile saved — your 12-month plan is ready below.';
      setTimeout(function () { msg.textContent = ''; }, 4000);
      renderAll();
      document.getElementById('weekSection').scrollIntoView();
    });
    el('resetProfile').addEventListener('click', function () {
      profile = null; checks = {}; weeksDone = []; skipped = {}; notes = {};
      save(LS_PROFILE, null); save(LS_CHECKS, checks); save(LS_WEEKS, weeksDone);
      save(LS_SKIPPED, skipped); save(LS_NOTES, notes);
      fillForm(); renderAll();
    });
    el('addCustom').addEventListener('click', function () {
      var title = el('customTitle').value.trim();
      if (!title) { el('customTitle').focus(); return; }
      var months = Array.prototype.map.call(
        el('customMonths').querySelectorAll('input:checked'), function (c) { return parseInt(c.value, 10); });
      if (!months.length) months = [new Date().getMonth() + 1];
      customTasks.push({ id: 't' + Date.now(), title: title,
        desc: el('customDesc').value.trim(), effort: el('customEffort').value.trim(),
        neglect: '', months: months });
      save(LS_CUSTOM, customTasks);
      el('customTitle').value = ''; el('customDesc').value = ''; el('customEffort').value = '';
      renderCustom(); renderPlan(); renderWeek();
    });
    el('planSearch').addEventListener('input', function (e) {
      var q = e.target.value.trim();
      if (q) renderPlanSearch(q);
      else renderPlan();
    });
    el('printWeek').addEventListener('click', function () { window.print(); });
    el('addVendor').addEventListener('click', function () {
      var res = HK.addVendor(vendors, {
        name: el('vName').value, trade: el('vTrade').value,
        phone: el('vPhone').value, notes: el('vNotes').value
      });
      if (!res.ok) { el('vName').focus(); return; }
      vendors = res.vendors;
      save(LS_VENDORS, vendors);
      el('vName').value = ''; el('vTrade').value = ''; el('vPhone').value = ''; el('vNotes').value = '';
      renderVendors();
    });
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
