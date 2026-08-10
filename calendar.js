/* 캘린더 — 월간 보기 + 일정 + 일별 공부시간 */
(function () {
  const App = window.App, UI = App.UI;

  App.register({
    id: 'calendar', label: '캘린더',
    icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',

    render() {
      const st = App.Store.get();
      const cur = App.ctx.month || (App.ctx.month = App.today().slice(0, 7));
      const sel = App.ctx.date || App.today();
      const [y, m] = cur.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const start = (first.getDay() + 6) % 7;              // 월요일 시작
      const dim = new Date(y, m, 0).getDate();
      const today = App.today();

      let cells = '';
      for (let i = 0; i < start; i++) cells += `<div class="cell out"></div>`;
      for (let d = 1; d <= dim; d++) {
        const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const wd = new Date(y, m - 1, d).getDay();
        const mins = App.minutesOn(date);
        const evs = st.events.filter(e => e.date === date);
        const dd = st.ddays.filter(e => e.date === date);
        const subs = [...new Set(st.logs.filter(l => l.date === date).map(l => l.subjectId))].slice(0, 6);
        cells += `
          <button class="cell ${wd === 0 ? 'sun' : ''} ${date === today ? 'today' : ''} ${date === sel ? 'sel' : ''}"
                  data-act="day" data-d="${date}">
            <span class="crow">
              <span class="dnum num">${d}</span>
              ${(evs.length || dd.length) ? `<span class="flag${dd.length ? ' key' : ''}"></span>` : ''}
            </span>
            ${subs.length ? `<span class="mk">${subs.map(s =>
              `<b class="sc" style="color:${App.subColor(s)}">${UI.esc(App.subName(s).charAt(0))}</b>`).join('')}</span>` : ''}
            ${mins ? `<span class="mins">${UI.hmShort(mins)}</span>` : ''}
          </button>`;
      }

      const monthMin = st.logs.filter(l => l.date.startsWith(cur)).reduce((a, l) => a + (+l.minutes || 0), 0);
      const studied = new Set(st.logs.filter(l => l.date.startsWith(cur) && l.minutes > 0).map(l => l.date)).size;

      const dayEv = st.events.filter(e => e.date === sel);
      const dayTodo = st.todos.filter(t => t.date === sel);
      const dayLog = st.logs.filter(l => l.date === sel);

      return `
      <div class="stack">
        <section class="card">
          <div class="spread" style="margin-bottom:10px">
            <button class="btn icon" data-act="pm">‹</button>
            <div style="text-align:center">
              <div style="font-size:15px" class="num">${y}. ${String(m).padStart(2, '0')}</div>
              <div class="small muted">${UI.hm(monthMin)} · ${studied}일 기록</div>
            </div>
            <button class="btn icon" data-act="nm">›</button>
          </div>
          <div class="cal">
            ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<div class="dow">${d}</div>`).join('')}
            ${cells}
          </div>
        </section>

        <section class="card">
          <div class="spread" style="margin-bottom:6px">
            <p class="card-t" style="margin:0">${UI.dateLabel(sel)}</p>
            <div class="row">
              <button class="btn sm" data-act="ev-add">일정</button>
              <button class="btn sm pri" data-act="goto">플래너 열기</button>
            </div>
          </div>
          ${dayEv.length ? dayEv.map(e => `
            <div class="item">
              <span class="dot" style="background:var(--muted);margin-top:6px"></span>
              <span class="t">${UI.esc(e.title)}${e.memo ? `<span class="small muted"> · ${UI.esc(e.memo)}</span>` : ''}</span>
              <button class="x" data-act="ev-del" data-id="${e.id}">×</button>
            </div>`).join('') : `<p class="small muted" style="margin:2px 0">등록된 일정 없음</p>`}
          <div class="hr"></div>
          <div class="spread small">
            <span class="muted">공부</span><span class="num">${UI.hm(dayLog.reduce((a, l) => a + (+l.minutes || 0), 0))}</span>
          </div>
          <div class="spread small" style="margin-top:4px">
            <span class="muted">할 일</span><span class="num">${dayTodo.filter(t => t.done).length} / ${dayTodo.length}</span>
          </div>
        </section>
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'day') { App.ctx.date = b.dataset.d; App.render(); }
        if (a === 'pm' || a === 'nm') {
          const [y, m] = App.ctx.month.split('-').map(Number);
          const d = new Date(y, m - 1 + (a === 'nm' ? 1 : -1), 1);
          App.ctx.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          App.render();
        }
        if (a === 'goto') App.go('planner');
        if (a === 'ev-add') addEvent();
        if (a === 'ev-del') App.Store.set(s => { s.events = s.events.filter(x => x.id !== b.dataset.id); });
      });
    }
  });

  function addEvent() {
    UI.sheet({
      title: '일정 추가',
      body: `
        <div class="field"><label>날짜</label><input type="date" id="e-date" value="${App.ctx.date || App.today()}"></div>
        <div class="field"><label>제목</label><input type="text" id="e-title" placeholder="예: 9월 모의평가"></div>
        <div class="field"><label>메모</label><input type="text" id="e-memo" placeholder="선택"></div>`,
      onOk: el => {
        const title = el.querySelector('#e-title').value.trim();
        if (!title) return false;
        App.Store.set(s => s.events.push({
          id: App.uid(), date: el.querySelector('#e-date').value,
          title, memo: el.querySelector('#e-memo').value.trim()
        }));
      },
      onOpen: el => setTimeout(() => el.querySelector('#e-title').focus(), 60)
    });
  }
})();
