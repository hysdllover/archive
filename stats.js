/* 통계 — 주간 / 월별 공부시간 */
(function () {
  const App = window.App, UI = App.UI;

  App.register({
    id: 'stats', label: '통계', hidden: true,
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',

    render() {
      const today = App.today();
      const mode = App.ctx.statMode || 'week';
      if (!App.ctx.statW) App.ctx.statW = App.mondayOf(today);
      if (!App.ctx.statM) App.ctx.statM = today.slice(0, 7);

      return `
      <div class="stack">
        <section class="card">
          <div class="chips" style="justify-content:center;margin-bottom:12px">
            <button class="chip ${mode === 'week' ? 'on' : ''}" data-act="mode" data-v="week">주간</button>
            <button class="chip ${mode === 'month' ? 'on' : ''}" data-act="mode" data-v="month">월별</button>
          </div>
          <div class="spread">
            <button class="btn icon" data-act="prev" aria-label="이전">‹</button>
            <div style="text-align:center;font-size:15px">${mode === 'week' ? weekLabel(App.ctx.statW) : monthLabel(App.ctx.statM)}</div>
            <button class="btn icon" data-act="next" aria-label="다음">›</button>
          </div>
        </section>
        ${mode === 'week' ? week(App.ctx.statW, today) : month(App.ctx.statM, today)}
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act, mode = App.ctx.statMode || 'week';
        if (a === 'mode') App.ctx.statMode = b.dataset.v;
        if (a === 'prev' || a === 'next') {
          const k = a === 'prev' ? -1 : 1;
          if (mode === 'week') App.ctx.statW = App.addDays(App.ctx.statW, 7 * k);
          else App.ctx.statM = shiftMonth(App.ctx.statM, k);
        }
        App.render();
      });
    }
  });

  /* ---------- 기간 ---------- */
  function weekLabel(mon) {
    const sun = App.addDays(mon, 6), f = s => s.slice(5).replace('-', '.');
    return `${f(mon)} – ${f(sun)}`;
  }
  function monthLabel(ym) { const [y, m] = ym.split('-'); return `${y}년 ${+m}월`; }
  function shiftMonth(ym, k) {
    const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthEnd(ym) {
    const [y, m] = ym.split('-').map(Number);
    return ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  }

  /* 오늘 이후는 평균에서 뺀다 */
  function elapsedDays(from, to, today) {
    if (from > today) return 0;
    return App.diffDays(from, to < today ? to : today) + 1;
  }
  function minsOn(d, today) { return App.minutesOn(d) + (d === today ? App.timerMinutes() : 0); }

  /* ---------- 공통 조각 ---------- */
  function summary(total, days, prev, prevLabel, extra) {
    const avg = days ? Math.round(total / days) : 0;
    const gap = total - prev;
    return `
      <section class="card">
        <div class="grid2">
          <div><div class="small muted">합계</div><div class="timer-num num">${UI.hmShort(total)}</div></div>
          <div><div class="small muted">일평균</div><div class="timer-num num">${UI.hmShort(avg)}</div></div>
        </div>
        <div class="small muted" style="margin-top:10px">
          ${prevLabel} ${UI.hm(prev)}
          ${prev || total ? `<span style="color:${gap >= 0 ? 'var(--accent)' : 'var(--danger)'}"> · ${gap >= 0 ? '+' : '−'}${UI.hm(Math.abs(gap))}</span>` : ''}
          ${extra || ''}
        </div>
      </section>`;
  }

  function bySubject(from, to) {
    const st = App.Store.get(), m = {};
    st.logs.filter(l => l.date >= from && l.date <= to)
      .forEach(l => { m[l.subjectId] = (m[l.subjectId] || 0) + (+l.minutes || 0); });
    const rows = Object.entries(m).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
    const sum = rows.reduce((a, r) => a + r[1], 0) || 1;
    return `
      <section class="card">
        <p class="card-t">과목별</p>
        ${rows.length ? rows.map(([id, v]) => `
          <div style="margin-bottom:8px">
            <div class="spread small" style="margin-bottom:3px">
              <span class="row"><span class="dot" style="background:${App.subColor(id)}"></span>${UI.esc(App.subName(id))}</span>
              <span class="num muted">${UI.hm(v)} · ${Math.round(v / sum * 100)}%</span>
            </div>
            <div class="bar-line"><i style="width:${(v / rows[0][1] * 100).toFixed(0)}%;background:${App.subColor(id)}"></i></div>
          </div>`).join('') : `<p class="empty">기록이 없습니다.</p>`}
      </section>`;
  }

  /* ---------- 주간 ---------- */
  function week(mon, today) {
    const sun = App.addDays(mon, 6);
    const items = [];
    for (let i = 0; i < 7; i++) {
      const d = App.addDays(mon, i);
      items.push({ label: App.DOW[App.parse(d).getDay()], v: minsOn(d, today), dim: d !== today });
    }
    const total = items.reduce((a, x) => a + x.v, 0);
    const days = elapsedDays(mon, sun, today);
    const prev = App.minutesRange(App.addDays(mon, -7), App.addDays(mon, -1));
    const best = items.reduce((a, x) => (x.v > a.v ? x : a), items[0]);
    return `
      ${summary(total, days, prev, '지난주', best.v ? ` · 최다 ${best.label}요일` : '')}
      <section class="card">
        <p class="card-t">요일별</p>
        ${UI.barChart(items, { avg: days ? total / days : 0 })}
      </section>
      ${bySubject(mon, sun)}`;
  }

  /* ---------- 월별 ---------- */
  function month(ym, today) {
    const from = ym + '-01', to = monthEnd(ym), n = +to.slice(8);
    const items = [];
    for (let i = 1; i <= n; i++) {
      const d = ym + '-' + String(i).padStart(2, '0');
      items.push({ label: (i === 1 || i % 5 === 0 || i === n) && !(i === 30 && n === 31) ? String(i) : '', v: minsOn(d, today), dim: d !== today });
    }
    const total = items.reduce((a, x) => a + x.v, 0);
    const days = elapsedDays(from, to, today);
    const studied = items.filter(x => x.v > 0).length;
    const pm = shiftMonth(ym, -1);
    const prev = App.minutesRange(pm + '-01', monthEnd(pm));

    /* 주차별 (월요일 시작, 이 달에 속한 날만) */
    const weeks = [];
    for (let w = App.mondayOf(from); w <= to; w = App.addDays(w, 7)) {
      const a = w < from ? from : w, e = App.addDays(w, 6), b = e > to ? to : e;
      weeks.push({ a, b, v: App.minutesRange(a, b) + (today >= a && today <= b ? App.timerMinutes() : 0) });
    }
    const wMax = Math.max(1, ...weeks.map(x => x.v));

    return `
      ${summary(total, days, prev, '지난달', ` · 공부한 날 ${studied}일`)}
      <section class="card">
        <p class="card-t">일별</p>
        ${UI.barChart(items, { avg: days ? total / days : 0 })}
      </section>
      <section class="card">
        <p class="card-t">주차별</p>
        ${weeks.map((x, i) => `
          <div style="margin-bottom:8px">
            <div class="spread small" style="margin-bottom:3px">
              <span>${i + 1}주차 <span class="muted num">${+x.a.slice(8)}–${+x.b.slice(8)}일</span></span>
              <span class="num muted">${UI.hm(x.v)}</span>
            </div>
            <div class="bar-line"><i style="width:${(x.v / wMax * 100).toFixed(0)}%;background:var(--accent)"></i></div>
          </div>`).join('')}
      </section>
      ${bySubject(from, to)}`;
  }
})();
