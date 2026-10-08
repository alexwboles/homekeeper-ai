/* homekeeper-ai app UI — localStorage only, no network. */
(function () {
  'use strict';

  var LS_PROFILE = 'hk_profile_v1';
  var LS_CHECKS = 'hk_checks_v1';   // { "taskId:YYYY-M": true }
  var LS_WEEKS = 'hk_weeks_v1';     // ["2026-W39", ...] completed weeks
  var LS_CUSTOM = 'hk_custom_v1';   // [{id,title,desc,effort,neglect,months:[]}]
  var LS_SKIPPED = 'hk_skipped_v1'; // { "taskId:YYYY-M": true } skipped this month

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
    return HK.generatePlan(profile, customTasks);
  }

  function checkId(task, year) {
    return task.id + ':' + year + '-' + task.month;
  }

  function renderAll() {
    if (!profile) {
      el('planSection').style.display = 'none';
      el('weekSection').style.display = 'none';
      el('customSection').style.display = 'none';
      return;
    }
    el('planSection').style.display = '';
    el('weekSection').style.display = '';
    el('customSection').style.display = '';
    renderWeek();
    renderPlan();
    renderCustom();
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
    if (isSkipped) {
      var sk = document.createElement('div');
      sk.className = 'skipnote';
      sk.textContent = 'Skipped this month';
      body.appendChild(sk);
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
    renderCatchUp(months, year, m);
    updateWeekProgress();
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
    months.forEach(function (mo, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (idx === active ? ' active' : '');
      b.textContent = mo.name.slice(0, 3) + ' (' + mo.tasks.length + ')';
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
    var wrap = el('yearOverview');
    wrap.innerHTML = prog.map(function (p) {
      var pct = p.total ? Math.round(p.done / p.total * 100) : 100;
      var label = p.done + '/' + p.total + (p.skipped ? ' · ' + p.skipped + ' skipped' : '');
      return '<div class="yom" title="' + p.name + ': ' + label + '">' +
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
      profile = null; checks = {}; weeksDone = []; skipped = {};
      save(LS_PROFILE, null); save(LS_CHECKS, checks); save(LS_WEEKS, weeksDone);
      save(LS_SKIPPED, skipped);
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
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
