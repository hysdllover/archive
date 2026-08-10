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

  function finish(auto) {
    const m = App.Store.get().mock; if (!m) return;
    const left = Math.max(0, remain(m));
    const usedMin = Math.max(1, Math.round((m.totalMin * 60000 - left) / 60000));
    App.Store.set(s => {
      if (m.subjectId) s.logs.push({
        id: App.uid(), date: App.today(), subjectId: m.subjectId,
        minutes: usedMin, memo: `실전 ${m.label}`
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
        return `
        <div class="stack">
          <section class="card" style="text-align:center;padding:28px 16px">
            <p class="card-t" style="margin-bottom:14px">${UI.esc(m.label)} · ${m.totalMin}분</p>
            <div class="count num ${over ? 'over' : ''} ${m.pausedAt ? 'paused' : ''}" id="mk-clock">${fmt(left)}</div>
            <div class="small muted" style="margin-top:6px">
              ${over ? '시간 종료' : m.pausedAt ? '일시정지' : m.subjectId ? App.subName(m.subjectId) + ' 기록으로 저장됩니다' : '과목 미지정'}</div>
            <div class="bar-line" style="margin:18px 0 4px"><i id="mk-bar" style="width:${pct}%;background:${over ? 'var(--danger)' : 'var(--accent)'}"></i></div>
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
      if (m && !m.pausedAt) {
        tick = setInterval(() => {
          const left = remain(App.Store.get().mock);
          const c = document.getElementById('mk-clock'), b = document.getElementById('mk-bar');
          if (!c) return;
          c.textContent = fmt(left);
          if (b) b.style.width = Math.max(0, left / (App.Store.get().mock.totalMin * 60000) * 100) + '%';
          if (left <= 0) { clearInterval(tick); c.classList.add('over'); finish(true); }
        }, 250);
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
        if (a === 'drop') UI.confirm('기록하지 않고 종료할까요?', () => App.Store.set(s => { s.mock = null; }));
      });
    },

    unmount() { clearInterval(tick); tick = null; }
  });

  function start(subjectId, label, totalMin) {
    App.Store.set(s => {
      s.mock = { subjectId, label, totalMin, startedAt: Date.now(), pausedMs: 0, pausedAt: null };
    });
  }

  function recent() {
    const logs = App.Store.get().logs
      .filter(l => (l.memo || '').startsWith('실전'))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    if (!logs.length) return '';
    return `<section class="card">
      <p class="card-t">최근 실전 기록</p>
      ${logs.map(l => `<div class="item">
        <span class="t small">${l.date.slice(5).replace('-', '/')} · ${UI.esc(l.memo)}</span>
        <span class="num small muted">${UI.hm(l.minutes)}</span>
      </div>`).join('')}
    </section>`;
  }
})();
