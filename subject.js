/* 과목 — 과목 하나를 골라 그 과목의 할 일·공부기록·통계만 본다 */
(function () {
  const App = window.App, UI = App.UI;

  App.register({
    id: 'subject', label: '과목',
    icon: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',

    render() {
      const st = App.Store.get(), today = App.today();
      const subs = st.subjects.filter(s => s.active !== false);
      if (!subs.length) return `<div class="card"><p class="empty">설정에서 과목을 추가하세요.</p></div>`;

      let sid = App.ctx.subjectId;
      if (!subs.some(s => s.id === sid)) sid = App.ctx.subjectId = subs[0].id;
      const sub = subs.find(s => s.id === sid);

      /* 통계 */
      const logs = st.logs.filter(l => l.subjectId === sid);
      const totalAll = logs.reduce((a, l) => a + (+l.minutes || 0), 0);
      const mon = App.mondayOf(today);
      const week = logs.filter(l => l.date >= mon).reduce((a, l) => a + (+l.minutes || 0), 0);
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = App.addDays(today, -i);
        days.push({
          label: App.DOW[App.parse(d).getDay()],
          v: logs.filter(l => l.date === d).reduce((a, l) => a + (+l.minutes || 0), 0),
          color: sub.color, dim: d !== today
        });
      }

      /* 할 일 — 미완료 먼저(날짜 순), 완료는 최근 5개 */
      const mine = st.todos.filter(t => t.subjectId === sid);
      const open = mine.filter(t => !t.done).sort((a, b) => a.date.localeCompare(b.date));
      const closed = mine.filter(t => t.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      const late = d => d < today;

      /* 최근 성적 */
      const exams = [...st.exams].sort((a, b) => a.date.localeCompare(b.date));
      const scores = exams.map(ex => {
        const r = (ex.results || []).find(r => r.subjectId === sid);
        return r && r.grade ? { name: ex.name, date: ex.date, r } : null;
      }).filter(Boolean).slice(-3).reverse();

      const recent = logs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

      return `
      <div class="stack">
        <div class="chips">${subs.map(s => `
          <button class="chip ${s.id === sid ? 'on' : ''}" data-act="pick" data-id="${s.id}"
            style="${s.id === sid ? `border-color:${s.color};color:${s.color};background:${s.color}14` : ''}">
            <i class="dot" style="background:${s.color}"></i>${UI.esc(s.name)}</button>`).join('')}</div>

        <section class="card">
          <p class="card-t">${UI.esc(sub.name)} · 공부량</p>
          <div class="spread" style="margin-bottom:12px">
            <div><div class="timer-num num" style="color:${sub.color}">${UI.hmShort(week)}</div>
              <div class="small muted">이번 주</div></div>
            <div style="text-align:right"><div class="num" style="font-size:20px;font-weight:200">${UI.hm(totalAll)}</div>
              <div class="small muted">누적 · ${logs.length}회</div></div>
          </div>
          ${UI.barChart(days)}
        </section>

        <section class="card">
          <div class="spread" style="margin-bottom:8px">
            <p class="card-t" style="margin:0">할 일 · ${open.length}개 남음</p>
            <div class="row">
              <button class="btn sm" data-act="log">공부 기록</button>
              <button class="btn sm pri" data-act="add">추가</button>
            </div>
          </div>
          ${open.length ? open.map(t => `
            <div class="item">
              <input type="checkbox" data-act="toggle" data-id="${t.id}">
              <span class="t" data-act="toggle" data-id="${t.id}">${UI.esc(t.text)}
                <span class="small ${late(t.date) ? '' : 'muted'}" style="${late(t.date) ? 'color:var(--danger)' : ''}">
                  · ${t.date === today ? '오늘' : t.date.slice(5).replace('-', '/')}</span></span>
              <button class="x" data-act="del" data-id="${t.id}" aria-label="삭제">×</button>
            </div>`).join('') : `<p class="empty">${UI.esc(sub.name)}에서 할 일이 없습니다.</p>`}
          ${closed.length ? `<div class="hr"></div><p class="sec-t">최근 완료</p>${closed.map(t => `
            <div class="item done">
              <input type="checkbox" checked data-act="toggle" data-id="${t.id}">
              <span class="t" data-act="toggle" data-id="${t.id}">${UI.esc(t.text)}<span class="small muted"> · ${t.date.slice(5).replace('-', '/')}</span></span>
              <button class="x" data-act="del" data-id="${t.id}" aria-label="삭제">×</button>
            </div>`).join('')}` : ''}
        </section>

        ${scores.length || sub.target ? `<section class="card">
          <div class="spread" style="margin-bottom:6px">
            <p class="card-t" style="margin:0">최근 성적</p>
            ${sub.target ? (() => {
              const now = scores.length ? scores[0].r.grade : null;
              const ok = now != null && now <= sub.target;
              return `<span class="small">목표 ${sub.target}등급
                <span style="color:${now == null ? 'var(--muted)' : ok ? 'var(--accent)' : 'var(--danger)'}">
                  · 현재 ${now == null ? '–' : now + '등급'}</span></span>`;
            })() : ''}
          </div>
          ${scores.map(s => `
            <div class="item">
              <span class="t">${UI.esc(s.name)}<span class="small muted"> · ${s.date.slice(5).replace('-', '/')}</span>
                ${s.r.memo ? `<br><span class="small muted">${UI.esc(s.r.memo)}</span>` : ''}</span>
              <span class="num small muted" style="margin-top:2px">${s.r.pct != null ? '백 ' + s.r.pct : ''}</span>
              <span class="num" style="font-size:15px;font-weight:200">${s.r.grade}등급</span>
            </div>`).join('')}
        </section>` : ''}

        <section class="card">
          <p class="card-t">공부 기록</p>
          ${recent.length ? recent.map(l => `
            <div class="item">
              <span class="t small">${l.date.slice(5).replace('-', '/')} (${App.DOW[App.parse(l.date).getDay()]})
                ${l.memo ? `<span class="muted"> · ${UI.esc(l.memo)}</span>` : ''}</span>
              <span class="num small">${UI.hm(l.minutes)}</span>
              <button class="x" data-act="log-del" data-id="${l.id}" aria-label="삭제">×</button>
            </div>`).join('') : `<p class="empty">기록이 없습니다.</p>`}
        </section>
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act, id = b.dataset.id, sid = App.ctx.subjectId;

        if (a === 'pick') { App.ctx.subjectId = id; App.render(); }
        if (a === 'toggle') App.Store.set(s => { const t = s.todos.find(x => x.id === id); t.done = !t.done; });
        if (a === 'del') App.Store.set(s => { s.todos = s.todos.filter(x => x.id !== id); });
        if (a === 'log-del') App.Store.set(s => { s.logs = s.logs.filter(x => x.id !== id); });

        if (a === 'add') UI.sheet({
          title: `${App.subName(sid)} 할 일 추가`,
          body: `
            <div class="field"><label>날짜</label><input type="date" id="q-date" value="${App.today()}"></div>
            <div class="field"><label>내용</label><input type="text" id="q-text" placeholder="예: 사문 도표 20문항"></div>
            <p class="small muted" style="margin:0">줄바꿈으로 여러 개를 한 번에 추가할 수 있습니다.</p>
            <textarea id="q-multi" placeholder="여러 개 입력(선택)"></textarea>`,
          onOk: el => {
            const date = el.querySelector('#q-date').value || App.today();
            const one = el.querySelector('#q-text').value.trim();
            const many = el.querySelector('#q-multi').value.split('\n').map(x => x.trim()).filter(Boolean);
            const all = one ? [one, ...many] : many;
            if (!all.length) return false;
            App.Store.set(s => all.forEach(text =>
              s.todos.push({ id: App.uid(), date, subjectId: sid, text, done: false })));
          },
          onOpen: el => setTimeout(() => el.querySelector('#q-text').focus(), 60)
        });

        if (a === 'log') UI.sheet({
          title: `${App.subName(sid)} 공부 기록`,
          body: `
            <div class="grid2">
              <div class="field"><label>시간(분)</label><input type="number" inputmode="numeric" id="q-min" placeholder="60"></div>
              <div class="field"><label>날짜</label><input type="date" id="q-d" value="${App.today()}"></div>
            </div>
            <div class="field"><label>메모</label><input type="text" id="q-memo" placeholder="예: 기출 3회분 오답정리"></div>`,
          onOk: el => {
            const min = +el.querySelector('#q-min').value;
            if (!min || min <= 0) return false;
            App.Store.set(s => s.logs.push({
              id: App.uid(), date: el.querySelector('#q-d').value || App.today(),
              subjectId: sid, minutes: min, memo: el.querySelector('#q-memo').value.trim()
            }));
          },
          onOpen: el => setTimeout(() => el.querySelector('#q-min').focus(), 60)
        });
      });
    }
  });
})();
