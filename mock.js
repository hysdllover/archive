/* 실전 타이머 — 영역별 카운트다운. 끝나면 공부 기록으로 자동 저장 */
(function () {
  const App = window.App, UI = App.UI;
  let tick = null;

  /* 수능 영역별 시험 시간 */
  const PRESETS = [
    { label: '국어', min: 80, match: /국어/ },
    { label: '수학', min: 100, match: /수학/ },
    { label: '영어', min: 70, match: /영어/ },
    { label: '한국사', min: 30, match: /한국사/ },
    { label: '탐구 1', min: 30, match: null },
    { label: '탐구 2', min: 30, match: null }
  ];

  /* 남은 밀리초 */
  function remain(m) {
    if (!m) return 0;
    const paused = (m.pausedMs || 0) + (m.pausedAt ? Date.now() - m.pausedAt : 0);
    return m.totalMin * 60000 - (Date.now() - m.startedAt - paused);
  }
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* 일시정지를 뺀 실제 경과 ms */
  function used(m) { return m.totalMin * 60000 - remain(m); }
  const mmss = sec => Math.floor(sec / 60) + ':' + String(Math.round(sec) % 60).padStart(2, '0');

  /* 누적 랩(ms) → 문항별 소요(초) */
  function lapSecs(laps) {
    return (laps || []).map((t, i) => Math.round((t - (i ? laps[i - 1] : 0)) / 1000));
  }

  /* 문항별 목록 — 평균의 1.5배를 넘긴 문항은 강조 */
  function lapList(secs) {
    if (!secs.length) return '';
    const avg = secs.reduce((a, x) => a + x, 0) / secs.length;
    const max = Math.max(...secs);
    return `<div class="laps">${secs.map((v, i) => `
      <div class="lap ${v > avg * 1.5 ? 'slow' : ''}">
        <span class="muted">${i + 1}번</span>
        <span class="lap-bar"><i style="width:${(v / max * 100).toFixed(0)}%"></i></span>
        <span class="num">${mmss(v)}</span>
      </div>`).join('')}</div>
      <p class="small muted" style="margin:8px 0 0">평균 ${mmss(avg)} · 강조는 평균의 1.5배 초과</p>`;
  }

  function lapSummary(secs) {
    if (!secs.length) return '';
    const avg = secs.reduce((a, x) => a + x, 0) / secs.length;
    const k = secs.indexOf(Math.max(...secs)) + 1;
    return `${secs.length}문항 · 평균 ${mmss(avg)} · 최장 ${k}번`;
  }

  /* ---------- 아날로그 시계 ----------
     실제 시각의 시·분·초침 + 남은 시간(최대 60분)을 분침 궤도 위 호로,
     종료 예정 시각을 바깥 눈금으로 표시한다. */
  const C = 100, R = 88;
  const pt = (deg, r) => {
    const a = deg * Math.PI / 180;
    return [(C + r * Math.sin(a)).toFixed(2), (C - r * Math.cos(a)).toFixed(2)];
  };
  function arc(a0, sweep, r) {
    if (sweep <= 0) return '';
    if (sweep >= 359.9) return `M${C} ${C - r}A${r} ${r} 0 1 1 ${C - 0.01} ${C - r}`;
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a0 + sweep, r);
    return `M${x0} ${y0}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  }
  function clockSVG() {
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, [x0, y0] = pt(i * 6, big ? R - 9 : R - 5), [x1, y1] = pt(i * 6, R - 1);
      ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${big ? 'tk big' : 'tk'}"/>`;
    }
    const nums = [12, 3, 6, 9].map((n, i) => {
      const [x, y] = pt(i * 90, R - 20);
      return `<text x="${x}" y="${y}" dy="3.5" text-anchor="middle">${n}</text>`;
    }).join('');
    return `<svg class="aclock" viewBox="0 0 200 200" aria-label="현재 시각">
      <circle cx="${C}" cy="${C}" r="${R}" class="face"/>
      <path id="ck-arc" class="remain" d=""/>
      ${ticks}${nums}
      <path id="ck-end" class="endmk" d="M${C} ${C - R - 1}l-4 -7h8z"/>
      <line id="ck-h" x1="${C}" y1="${C + 8}" x2="${C}" y2="${C - 46}" class="hand h"/>
      <line id="ck-m" x1="${C}" y1="${C + 10}" x2="${C}" y2="${C - 70}" class="hand m"/>
      <line id="ck-s" x1="${C}" y1="${C + 14}" x2="${C}" y2="${C - 78}" class="hand s"/>
      <circle cx="${C}" cy="${C}" r="2.6" class="pin"/>
    </svg>`;
  }
  function paintClock(m) {
    const now = new Date(), end = new Date(Date.now() + Math.max(0, remain(m)));
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const mA = now.getMinutes() * 6 + sec * 0.1;
    const set = (id, deg) => { const e = document.getElementById(id); if (e) e.setAttribute('transform', `rotate(${deg.toFixed(2)} ${C} ${C})`); };
    set('ck-h', (now.getHours() % 12) * 30 + now.getMinutes() * 0.5 + sec / 120);
    set('ck-m', mA);
    set('ck-s', Math.floor(sec) * 6);
    set('ck-end', end.getMinutes() * 6 + end.getSeconds() * 0.1);
    const a = document.getElementById('ck-arc');
    if (a) a.setAttribute('d', m.pausedAt ? '' : arc(mA, Math.min(60, Math.max(0, remain(m)) / 60000) * 6, R - 3));
    const t = document.getElementById('mk-end');
    if (t) t.textContent = String(end.getHours()).padStart(2, '0') + ':' + String(end.getMinutes()).padStart(2, '0');
  }

  function finish(auto) {
    const m = App.Store.get().mock; if (!m) return;
    const left = Math.max(0, remain(m));
    const usedMin = Math.max(1, Math.round((m.totalMin * 60000 - left) / 60000));
    App.Store.set(s => {
      if (m.subjectId) s.logs.push({
        id: App.uid(), date: App.today(), subjectId: m.subjectId,
        minutes: usedMin, memo: `실전 ${m.label}`, laps: lapSecs(m.laps)
      });
      s.mock = null;
    });
    UI.toast(auto ? `${m.label} 종료 · ${UI.hm(usedMin)} 기록` : `${UI.hm(usedMin)} 기록됨`);
  }

  App.register({
    id: 'mock', label: '실전 타이머', hidden: true,
    icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',

    render() {
      const st = App.Store.get();
      const m = st.mock;
      const subs = st.subjects.filter(s => s.active !== false);

      if (m) {
        const left = remain(m);
        const pct = Math.max(0, Math.min(100, left / (m.totalMin * 60000) * 100));
        const over = left <= 0;
        const laps = m.laps || [];
        const secs = lapSecs(laps);
        return `
        <div class="stack">
          <section class="card" style="text-align:center;padding:20px 16px">
            <p class="card-t" style="margin-bottom:10px">${UI.esc(m.label)} · ${m.totalMin}분</p>
            ${clockSVG()}
            <div class="small muted" style="margin:4px 0 10px">종료 예정 <span class="num" id="mk-end">--:--</span></div>
            <div class="count num ${over ? 'over' : ''} ${m.pausedAt ? 'paused' : ''}" id="mk-clock">${fmt(left)}</div>
            <div class="small muted" style="margin-top:6px">
              ${over ? '시간 종료' : m.pausedAt ? '일시정지' : m.subjectId ? App.subName(m.subjectId) + ' 기록으로 저장됩니다' : '과목 미지정'}</div>
            <div class="bar-line" style="margin:16px 0 4px"><i id="mk-bar" style="width:${pct}%;background:${over ? 'var(--danger)' : 'var(--accent)'}"></i></div>
          </section>

          <section class="card">
            <div class="spread" style="margin-bottom:10px">
              <p class="card-t" style="margin:0">문항별 기록</p>
              <span class="small muted">현재 문항 <span class="num" id="mk-lap">0:00</span></span>
            </div>
            <button class="btn pri block lapbtn" data-act="lap" ${m.pausedAt ? 'disabled' : ''}>${laps.length + 1}번 완료</button>
            ${laps.length ? `<button class="btn sm block" data-act="unlap" style="margin-top:8px">마지막 기록 취소</button>` : ''}
            ${secs.length ? `<div class="hr"></div>${lapList(secs)}` : `<p class="small muted" style="margin:10px 0 0">한 문제를 끝낼 때마다 눌러 문항별 소요 시간을 남깁니다.</p>`}
          </section>

          <div class="grid2">
            <button class="btn" data-act="pause">${m.pausedAt ? '이어서' : '일시정지'}</button>
            <button class="btn pri" data-act="stop">종료하고 기록</button>
          </div>
          <button class="btn danger block" data-act="drop">기록 없이 취소</button>
        </div>`;
      }

      return `
      <div class="stack">
        <section class="card">
          <p class="card-t">영역 선택</p>
          <div class="chips wrapchips">${PRESETS.map((p, i) =>
            `<button class="chip" data-act="preset" data-i="${i}">${p.label} ${p.min}분</button>`).join('')}</div>
          <p class="small muted" style="margin:10px 0 0">
            수능 시간표 기준입니다. 시작하면 카운트다운이 돌고, 끝낼 때 실제 소요 시간이 공부 기록으로 남습니다.
          </p>
        </section>

        <section class="card">
          <p class="card-t">직접 설정</p>
          <div class="grid2">
            <div class="field"><label>과목</label><select id="mk-sub">${UI.subjectOptions(null, true)}</select></div>
            <div class="field"><label>시간(분)</label><input type="number" inputmode="numeric" id="mk-min" value="30"></div>
          </div>
          <button class="btn pri block" data-act="custom" style="margin-top:12px">시작</button>
        </section>

        ${recent()}
      </div>`;
    },

    mount(root) {
      const m = App.Store.get().mock;
      if (m) {
        const step = () => {
          const cur = App.Store.get().mock; if (!cur) return;
          paintClock(cur);
          const lap = document.getElementById('mk-lap'), laps = cur.laps || [];
          if (lap) lap.textContent = mmss(Math.max(0, used(cur) - (laps[laps.length - 1] || 0)) / 1000);
          if (cur.pausedAt) return;
          const left = remain(cur);
          const c = document.getElementById('mk-clock'), b = document.getElementById('mk-bar');
          if (!c) return;
          c.textContent = fmt(left);
          if (b) b.style.width = Math.max(0, left / (cur.totalMin * 60000) * 100) + '%';
          if (left <= 0) { clearInterval(tick); c.classList.add('over'); finish(true); }
        };
        step();
        tick = setInterval(step, 250);
      }

      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const a = b.dataset.act;

        if (a === 'preset') {
          const p = PRESETS[+b.dataset.i];
          const st = App.Store.get();
          const guess = st.subjects.find(s => p.match && p.match.test(s.name));
          start(guess ? guess.id : '', p.label, p.min);
        }
        if (a === 'custom') {
          const sid = root.querySelector('#mk-sub').value;
          const min = +root.querySelector('#mk-min').value;
          if (!min || min <= 0) return UI.toast('시간을 입력하세요');
          start(sid, sid ? App.subName(sid) : '자율', min);
        }
        if (a === 'pause') App.Store.set(s => {
          if (s.mock.pausedAt) { s.mock.pausedMs = (s.mock.pausedMs || 0) + (Date.now() - s.mock.pausedAt); s.mock.pausedAt = null; }
          else s.mock.pausedAt = Date.now();
        });
        if (a === 'stop') finish(false);
        if (a === 'lap') App.Store.set(s => { s.mock.laps = (s.mock.laps || []).concat(used(s.mock)); });
        if (a === 'unlap') App.Store.set(s => { (s.mock.laps || []).pop(); });
        if (a === 'rec') {
          const l = App.Store.get().logs.find(x => x.id === b.dataset.id);
          if (l && l.laps && l.laps.length) UI.sheet({ title: `${l.date.slice(5).replace('-', '/')} · ${l.memo}`, body: lapList(l.laps), ok: null });
        }
        if (a === 'drop') UI.confirm('기록하지 않고 종료할까요?', () => App.Store.set(s => { s.mock = null; }));
      });
    },

    unmount() { clearInterval(tick); tick = null; }
  });

  function start(subjectId, label, totalMin) {
    App.Store.set(s => {
      s.mock = { subjectId, label, totalMin, startedAt: Date.now(), pausedMs: 0, pausedAt: null, laps: [] };
    });
  }

  function recent() {
    const logs = App.Store.get().logs
      .filter(l => (l.memo || '').startsWith('실전'))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    if (!logs.length) return '';
    return `<section class="card">
      <p class="card-t">최근 실전 기록</p>
      ${logs.map(l => `<button class="item" data-act="rec" data-id="${l.id}" style="width:100%;text-align:left;background:none">
        <span class="t small">${l.date.slice(5).replace('-', '/')} · ${UI.esc(l.memo)}
          ${l.laps && l.laps.length ? `<span class="muted"><br>${lapSummary(l.laps)}</span>` : ''}</span>
        <span class="num small muted">${UI.hm(l.minutes)}</span>
      </button>`).join('')}
    </section>`;
  }
})();
