/* 홈 — 디데이 / 오늘 요약 / 주간 공부시간 / 목표 */
(function () {
  const App = window.App, UI = App.UI;

  App.register({
    id: 'home', label: '홈',
    icon: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',

    render() {
      const st = App.Store.get(), today = App.today();
      const all = [...st.ddays].sort((a, b) => a.date.localeCompare(b.date));
      const dd = all.filter(d => d.date >= today);      // 아직 남은 시험
      const past = all.filter(d => d.date < today);     // 지나간 시험
      const main = dd.find(d => d.pinned) || dd[0] || all[all.length - 1];

      /* D-day */
      let ddHtml = `<div class="empty">설정에서 디데이를 추가하세요.</div>`;
      if (main) {
        const n = App.diffDays(today, main.date);
        const txt = n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`;
        ddHtml = `
          <div class="d-num num">${txt.replace(/^D([-+])/, 'D$1')}</div>
          <div class="d-label">${UI.esc(main.label)}</div>
          <div class="d-date num">${main.date.replace(/-/g, '. ')}</div>
          ${dd.filter(d => d !== main).length ? `<div class="dday-sub">${dd.filter(d => d !== main).slice(0, 4).map(d => {
            const k = App.diffDays(today, d.date);
            return `<div><span>${UI.esc(d.label)}</span><span class="num muted">${k > 0 ? 'D-' + k : k === 0 ? 'D-DAY' : 'D+' + -k}</span></div>`;
          }).join('')}</div>` : ''}`;
      }

      /* 오늘 */
      const todayMin = App.minutesOn(today) + App.timerMinutes();
      const todos = st.todos.filter(t => t.date === today);
      const doneN = todos.filter(t => t.done).length;

      /* 최근 7일 */
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = App.addDays(today, -i);
        days.push({
          label: App.DOW[App.parse(d).getDay()],
          v: App.minutesOn(d) + (d === today ? App.timerMinutes() : 0),
          dim: d !== today
        });
      }
      const weekTotal = days.reduce((a, d) => a + d.v, 0);
      const avg7 = Math.round((weekTotal - todayMin) / 6);   // 오늘 제외한 6일 평균
      const gap = todayMin - avg7;
      const peak = Math.max(1, ...days.map(d => d.v));

      /* 손 놓은 과목 — 마지막 기록에서 3일 이상 지난 과목 */
      const stale = st.subjects.filter(s => s.active !== false).map(s => {
        const mine = st.logs.filter(l => l.subjectId === s.id && l.minutes > 0);
        const last = mine.length ? mine.map(l => l.date).sort().pop() : null;
        return { s, last, gap: last ? App.diffDays(last, today) : null };
      }).filter(x => x.gap === null || x.gap >= 3)
        .sort((a, b) => (b.gap === null ? 999 : b.gap) - (a.gap === null ? 999 : a.gap));

      /* 과목별 이번 주 */
      const mon = App.mondayOf(today), sun = App.addDays(mon, 6);
      const bySub = {};
      st.logs.filter(l => l.date >= mon && l.date <= sun)
        .forEach(l => { bySub[l.subjectId] = (bySub[l.subjectId] || 0) + (+l.minutes || 0); });
      const subRows = Object.entries(bySub).sort((a, b) => b[1] - a[1]);
      const subMax = Math.max(1, ...subRows.map(r => r[1]));

      return `
      <div class="stack">
        <section class="card dday">${ddHtml}</section>

        <section class="card">
          <p class="card-t">오늘</p>
          <div class="spread">
            <div><div class="timer-num num">${UI.hmShort(todayMin)}</div>
              <div class="small muted">
                ${avg7 > 0 ? `평균 ${UI.hmShort(avg7)}<span style="color:${gap >= 0 ? 'var(--accent)' : 'var(--danger)'}"> · ${gap >= 0 ? '+' : '−'}${UI.hm(Math.abs(gap))}</span>`
                           : '첫 기록을 남겨 보세요'}</div></div>
            <div style="text-align:right">
              <div class="num" style="font-size:20px;font-weight:200">${doneN}<span class="muted" style="font-size:13px">/${todos.length}</span></div>
              <div class="small muted">오늘 할 일</div></div>
          </div>
          <div class="bar-line" style="margin-top:12px"><i style="width:${Math.round(todayMin / peak * 100)}%;background:var(--accent)"></i></div>
        </section>

        <section class="card">
          <div class="spread" style="margin-bottom:10px">
            <p class="card-t" style="margin:0">최근 7일 · 총 ${UI.hm(weekTotal)}</p>
            <button class="btn sm" data-act="go-stats">통계 ›</button>
          </div>
          ${UI.barChart(days, { avg: avg7 })}
          ${subRows.length ? `<div class="hr"></div>${subRows.map(([id, m]) => `
            <div style="margin-bottom:8px">
              <div class="spread small" style="margin-bottom:3px">
                <span>${UI.esc(App.subName(id))}</span><span class="num muted">${UI.hm(m)}</span>
              </div>
              <div class="bar-line"><i style="width:${(m / subMax * 100).toFixed(0)}%;background:${App.subColor(id)}"></i></div>
            </div>`).join('')}` : ''}
        </section>

        ${stale.length ? `
        <section class="card">
          <p class="card-t">손 놓은 과목</p>
          ${stale.map(x => `
            <button class="item" data-act="go-sub" data-id="${x.s.id}"
                    style="width:100%;text-align:left;background:none">
              <span class="dot" style="background:${x.s.color};margin-top:6px"></span>
              <span class="t">${UI.esc(x.s.name)}</span>
              <span class="num small" style="color:${x.gap === null || x.gap >= 7 ? 'var(--danger)' : 'var(--ink-2)'}">
                ${x.gap === null ? '기록 없음' : x.gap + '일째'}</span>
            </button>`).join('')}
          <p class="small muted" style="margin:8px 0 0">3일 넘게 기록이 없는 과목입니다. 눌러서 바로 이동합니다.</p>
        </section>` : ''}

        <section class="card">
          <div class="spread" style="margin-bottom:6px">
            <p class="card-t" style="margin:0">목표</p>
            <button class="btn sm" data-act="goal-add">추가</button>
          </div>
          ${dd.length ? dd.map(d => {
            const gs = st.goals.filter(g => g.ddayId === d.id);
            const k = App.diffDays(today, d.date);
            const doneN = gs.filter(g => g.done).length;
            return `
              <div class="spread" style="margin-top:12px">
                <p class="sec-t" style="margin:0">${UI.esc(d.label)}까지</p>
                <span class="small muted num">${k > 0 ? 'D-' + k : k === 0 ? 'D-DAY' : '지남'}${gs.length ? ` · ${doneN}/${gs.length}` : ''}</span>
              </div>
              ${gs.length ? gs.map(g => `
                <div class="item ${g.done ? 'done' : ''}">
                  <input type="checkbox" ${g.done ? 'checked' : ''} data-act="goal-toggle" data-id="${g.id}">
                  <span class="t" data-act="goal-toggle" data-id="${g.id}">${UI.esc(g.text)}</span>
                  <button class="x" data-act="goal-del" data-id="${g.id}" aria-label="삭제">×</button>
                </div>`).join('') : `<p class="small muted" style="margin:2px 0">아직 없음</p>`}`;
          }).join('') : `<p class="empty">설정에서 디데이를 먼저 추가하면 그 시험까지의 목표를 세울 수 있습니다.</p>`}
          ${past.length ? `
            <div class="hr"></div>
            <button class="btn sm block" data-act="past-toggle">
              지난 시험 ${past.length}개 ${App.ctx.showPast ? '접기' : '보기'}</button>
            ${App.ctx.showPast ? past.slice().reverse().map(d => {
              const gs = st.goals.filter(g => g.ddayId === d.id);
              const doneN = gs.filter(g => g.done).length;
              const rate = gs.length ? Math.round(doneN / gs.length * 100) : 0;
              return `
                <div class="spread" style="margin-top:12px">
                  <p class="sec-t" style="margin:0">${UI.esc(d.label)}</p>
                  <span class="small muted num">${d.date.slice(2).replace(/-/g, '.')}${gs.length ? ` · ${doneN}/${gs.length}` : ''}</span>
                </div>
                ${gs.length ? `<div class="bar-line" style="margin:2px 0 6px"><i style="width:${rate}%;background:var(--muted)"></i></div>
                  ${gs.map(g => `<div class="item ${g.done ? 'done' : ''}">
                    <span class="t small">${g.done ? '✓' : '·'} ${UI.esc(g.text)}</span>
                    <button class="x" data-act="goal-del" data-id="${g.id}" aria-label="삭제">×</button>
                  </div>`).join('')}` : `<p class="small muted" style="margin:2px 0">세운 목표 없음</p>`}`;
            }).join('') : ''}` : ''}
          ${(() => {
            const ids = st.ddays.map(d => d.id);
            const orphan = st.goals.filter(g => !ids.includes(g.ddayId));
            return orphan.length ? `<p class="sec-t" style="margin-top:12px">기타</p>` + orphan.map(g => `
              <div class="item ${g.done ? 'done' : ''}">
                <input type="checkbox" ${g.done ? 'checked' : ''} data-act="goal-toggle" data-id="${g.id}">
                <span class="t" data-act="goal-toggle" data-id="${g.id}">${UI.esc(g.text)}</span>
                <button class="x" data-act="goal-del" data-id="${g.id}"aria-label="삭제">×</button>
              </div>`).join('') : '';
          })()}
        </section>
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const id = b.dataset.id;
        if (b.dataset.act === 'goal-add') addGoal();
        if (b.dataset.act === 'past-toggle') { App.ctx.showPast = !App.ctx.showPast; App.render(); }
        if (b.dataset.act === 'go-stats') App.go('stats');
        if (b.dataset.act === 'go-sub') { App.ctx.subjectId = id; App.go('subject'); }
        if (b.dataset.act === 'goal-toggle')
          App.Store.set(s => { const g = s.goals.find(x => x.id === id); g.done = !g.done; });
        if (b.dataset.act === 'goal-del')
          App.Store.set(s => { s.goals = s.goals.filter(x => x.id !== id); });
      });
    }
  });

  function addGoal() {
    const st = App.Store.get(), today = App.today();
    const dd = st.ddays.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    if (!dd.length) { UI.toast('설정에서 다가올 시험의 디데이를 추가하세요'); return; }
    UI.sheet({
      title: '목표 추가',
      body: `
        <div class="field"><label>어느 시험까지</label>
          <select id="g-dd">${dd.map(d => {
            const k = App.diffDays(today, d.date);
            return `<option value="${d.id}">${UI.esc(d.label)} · ${k > 0 ? 'D-' + k : 'D-DAY'}</option>`;
          }).join('')}</select></div>
        <div class="field"><label>내용</label>
          <input type="text" id="g-text" placeholder="예: 사회·문화 도표 문제 무실수"></div>
        <p class="small muted" style="margin:0">줄바꿈으로 여러 개를 한 번에 추가할 수 있습니다.</p>
        <textarea id="g-multi" placeholder="여러 개 입력(선택)"></textarea>`,
      onOk: el => {
        const ddayId = el.querySelector('#g-dd').value;
        const one = el.querySelector('#g-text').value.trim();
        const many = el.querySelector('#g-multi').value.split('\n').map(x => x.trim()).filter(Boolean);
        const all = one ? [one, ...many] : many;
        if (!all.length) return false;
        App.Store.set(s => all.forEach(text =>
          s.goals.push({ id: App.uid(), ddayId, text, done: false })));
      },
      onOpen: el => setTimeout(() => el.querySelector('#g-text').focus(), 60)
    });
  }
})();
