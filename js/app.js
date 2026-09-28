/* homekeeper-ai app UI — localStorage only, no network. */
(function () {
  'use strict';

  var LS_PROFILE = 'hk_profile_v1';
  var LS_CHECKS = 'hk_checks_v1';   // { "taskId:YYYY-M": true }
  var LS_WEEKS = 'hk_weeks_v1';     // ["2026-W39", ...] completed weeks
  var LS_CUSTOM = 'hk_custom_v1';   // [{id,title,desc,effort,neglect,months:[]}]

  function load(k, fb) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch (e) { return fb; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var profile = load(LS_PROFILE, null);
  var checks = load(LS_CHECKS, {});
  var weeksDone = load(LS_WEEKS, []);
  var customTasks = load(LS_CUSTOM, []);

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

  function taskCard(t, year) {
    var cid = checkId(t, year);
    var done = !!checks[cid];
    var div = document.createElement('div');
    div.className = 'task' + (done ? ' done' : '');
    var label = document.createElement('label');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = done;
    box.setAttribute('aria-label', 'Mark done: ' + t.title);
    box.addEventListener('change', function () {
      if (box.checked) checks[cid] = true; else delete checks[cid];
      save(LS_CHECKS, checks);
      div.classList.toggle('done', box.checked);
      updateWeekProgress();
    });
    var body = document.createElement('div');
    var h = document.createElement('div');
    h.className = 'task-title';
    h.textContent = t.title + (t.custom ? ' (custom)' : '');
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
    label.appendChild(box); label.appendChild(body);
    div.appendChild(label);
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
    updateWeekProgress();
  }

  function updateWeekProgress() {
    var now = new Date();
    var year = now.getFullYear();
    var m = now.getMonth() + 1;
    var tasks = plan()[m - 1].tasks;
    var doneCount = tasks.filter(function (t) { return checks[checkId(t, year)]; }).length;
    el('weekProgress').textContent = doneCount + ' of ' + tasks.length + ' done';
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
      profile = null; checks = {}; weeksDone = [];
      save(LS_PROFILE, null); save(LS_CHECKS, checks); save(LS_WEEKS, weeksDone);
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
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
