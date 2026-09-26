/* 플래너 — 날짜별 과목 투두 + 공부기록(타이머/직접입력) */
(function () {
  const App = window.App, UI = App.UI;
  let tick = null;

  App.register({
    id: 'planner', label: '플래너',
    icon: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2.5v3M16 2.5v3M4 9.5h16M8.5 14h7M8.5 17.5h4"/>',

    render() {
      const st = App.Store.get();
      const date = App.ctx.date || (App.ctx.date = App.today());
      const isToday = date === App.today();

      const todos = st.todos.filter(t => t.date === date);
      const logs = st.logs.filter(l => l.date === date);
      const total = logs.reduce((a, l) => a + (+l.minutes || 0), 0);

      /* 과목별 그룹 */
      const subs = st.subjects.filter(s => s.active !== false);
      const groups = subs.map(s => ({ s, list: todos.filter(t => t.subjectId === s.id) }))
        .filter(g => g.list.length);
      const etc = todos.filter(t => !t.subjectId || !subs.some(s => s.id === t.subjectId));

      const timer = st.timer;
      const running = !!timer;
      const elapsed = running ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0;

      const todoBlock = (list) => list.map(t => `
        <div class="item ${t.done ? 'done' : ''}">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-act="t-toggle" data-id="${t.id}">
          <span class="t" data-act="t-edit" data-id="${t.id}">${UI.esc(t.text)}</span>
          <button class="x" data-act="t-del" data-id="${t.id}" aria-label="삭제">×</button>
        </div>`).join('');

      return `
      <div class="stack">
        <section class="card">
          <div class="spread">
            <button class="btn icon" data-act="prev" aria-label="이전 날">‹</button>
            <div style="text-align:center">
              <div style="font-size:15px">${UI.dateLabel(date)}</div>
              <div class="small muted num">${date}</div>
            </div>
            <button class="btn icon" data-act="next" aria-label="다음 날">›</button>
          </div>
          ${isToday ? '' : `<button class="btn sm block" data-act="today" style="margin-top:10px">오늘로 이동</button>`}
        </section>

        <section class="card">
          <p class="card-t">공부 기록 · ${UI.hm(total)}</p>
          <div class="spread">
            <div>
              <div class="timer-num num ${running ? 'run' : ''}" id="tclock">${fmt(elapsed)}</div>
              <div class="small muted">${running ? UI.esc(App.subName(timer.subjectId)) + (timer.memo ? ' · ' + UI.esc(timer.memo) : '') + ' 측정 중' : '과목을 골라 시작'}</div>
            </div>
            <div class="row">
              ${running
                ? `<button class="btn pri" data-act="stop">기록하고 정지</button>
                   <button class="btn sm" data-act="cancel">취소</button>`
                : `<select id="t-sub" style="width:118px">${UI.subjectOptions()}</select>
                   <button class="btn pri" data-act="start">시작</button>`}
            </div>
          </div>
          ${running ? '' : `<input type="text" id="t-memo" placeholder="제목(선택) · 예: 수특 3단원" style="margin-top:10px">`}
          <div class="hr"></div>
          <div class="spread" style="margin-bottom:4px">
            <span class="small muted">기록 ${logs.length}건</span>
            <div class="row">
              <button class="btn sm" data-act="go-mock">실전 타이머</button>
              <button class="btn sm" data-act="log-add">직접 입력</button>
            </div>
          </div>
          ${logs.length ? logs.map(l => `
            <div class="item">
              <span class="dot" style="background:${App.subColor(l.subjectId)};margin-top:6px"></span>
              <span class="t">${UI.esc(App.subName(l.subjectId))}
                ${l.memo ? `<span class="small muted"> · ${UI.esc(l.memo)}</span>` : ''}</span>
              <span class="num small muted" style="margin-top:2px">${UI.hm(l.minutes)}</span>
              <button class="x" data-act="log-del" data-id="${l.id}" aria-label="삭제">×</button>
            </div>`).join('') : `<p class="empty">기록이 없습니다.</p>`}
        </section>

        <section class="card">
          <div class="spread" style="margin-bottom:8px">
            <p class="card-t" style="margin:0">할 일</p>
            <div class="row">
              <button class="btn sm" data-act="carry">전날 미완료 가져오기</button>
              <button class="btn sm pri" data-act="t-add">추가</button>
            </div>
          </div>
          ${groups.length || etc.length ? `
            ${groups.map(g => `
              <p class="sec-t row" style="margin-top:12px">
                <span class="dot" style="background:${g.s.color}"></span>${UI.esc(g.s.name)}
                <span class="muted small">${g.list.filter(x => x.done).length}/${g.list.length}</span>
              </p>${todoBlock(g.list)}`).join('')}
            ${etc.length ? `<p class="sec-t" style="margin-top:12px">기타</p>${todoBlock(etc)}` : ''}
          ` : `<p class="empty">할 일을 추가해 하루를 설계해 보세요.</p>`}
        </section>
      </div>`;
    },

    mount(root) {
      const clock = root.querySelector('#tclock');
      const st = App.Store.get();
      if (st.timer && clock) {
        tick = setInterval(() => {
          clock.textContent = fmt(Math.floor((Date.now() - st.timer.startedAt) / 1000));
        }, 1000);
      }

      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act, id = b.dataset.id;

        if (a === 'prev') { App.ctx.date = App.addDays(App.ctx.date, -1); App.render(); }
        if (a === 'next') { App.ctx.date = App.addDays(App.ctx.date, 1); App.render(); }
        if (a === 'today') { App.ctx.date = App.today(); App.render(); }

        if (a === 'start') {
          const sub = root.querySelector('#t-sub').value;
          const memo = root.querySelector('#t-memo').value.trim();
          App.Store.set(s => { s.timer = { subjectId: sub, startedAt: Date.now(), memo }; });
        }
        if (a === 'cancel') App.Store.set(s => { s.timer = null; });
        if (a === 'stop') stopTimer();
        if (a === 't-edit') editTodo(id);

        if (a === 'go-mock') App.go('mock');
        if (a === 'log-add') addLog();
        if (a === 'log-del') App.Store.set(s => { s.logs = s.logs.filter(x => x.id !== id); });

        if (a === 't-add') addTodo();
        if (a === 't-toggle') App.Store.set(s => { const t = s.todos.find(x => x.id === id); t.done = !t.done; });
        if (a === 't-del') App.Store.set(s => { s.todos = s.todos.filter(x => x.id !== id); });
        if (a === 'carry') {
          const prev = App.addDays(App.ctx.date, -1);
          App.Store.set(s => {
            const move = s.todos.filter(t => t.date === prev && !t.done);
            move.forEach(t => s.todos.push({ ...t, id: App.uid(), date: App.ctx.date }));
            s.todos = s.todos.filter(t => !(t.date === prev && !t.done));
            UI.toast(move.length ? `${move.length}개 가져옴` : '가져올 항목이 없습니다');
          });
        }
      });
    },

    unmount() { clearInterval(tick); tick = null; }
  });

  function fmt(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* 정지 — 기록 전에 제목·시간 확인 */
  function stopTimer() {
    const t = App.Store.get().timer; if (!t) return;
    const mins = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    UI.sheet({
      title: '공부 기록 저장',
      body: `
        <div class="grid2">
          <div class="field"><label>과목</label><select id="st-sub">${UI.subjectOptions(t.subjectId)}</select></div>
          <div class="field"><label>시간(분)</label><input type="number" id="st-min" inputmode="numeric" value="${mins}"></div>
        </div>
        <div class="field"><label>제목</label><input type="text" id="st-memo" value="${UI.esc(t.memo || '')}" placeholder="예: 유전 오답 정리"></div>`,
      onOk: el => {
        const min = +el.querySelector('#st-min').value;
        if (!min || min <= 0) return false;
        App.Store.set(s => {
          s.logs.push({
            id: App.uid(), date: App.today(), subjectId: el.querySelector('#st-sub').value,
            minutes: min, memo: el.querySelector('#st-memo').value.trim()
          });
          s.timer = null;
        });
        UI.toast(`${UI.hm(min)} 기록됨`);
      }
    });
  }

  function editTodo(id) {
    const t = App.Store.get().todos.find(x => x.id === id); if (!t) return;
    const bg = UI.sheet({
      title: '할 일 수정',
      body: `
        <div class="field"><label>과목</label><select id="te-sub">${UI.subjectOptions(t.subjectId, true)}</select></div>
        <div class="field"><label>내용</label><textarea id="te-text">${UI.esc(t.text)}</textarea></div>
        <div class="field"><label>날짜</label><input type="date" id="te-date" value="${t.date}"></div>
        <button class="btn danger block" id="te-del">삭제</button>`,
      onOk: el => {
        const text = el.querySelector('#te-text').value.trim();
        if (!text) return false;
        App.Store.set(s => {
          const x = s.todos.find(y => y.id === id); if (!x) return;
          x.text = text;
          x.subjectId = el.querySelector('#te-sub').value;
          x.date = el.querySelector('#te-date').value || x.date;
        });
      }
    });
    bg.querySelector('#te-del').onclick = () => {
      UI.closeSheet();
      App.Store.set(s => { s.todos = s.todos.filter(x => x.id !== id); });
    };
  }

  function addTodo() {
    UI.sheet({
      title: '할 일 추가',
      body: `
        <div class="field"><label>과목</label><select id="td-sub">${UI.subjectOptions(null, true)}</select></div>
        <div class="field"><label>내용</label><input type="text" id="td-text" placeholder="예: 수특 생명 3단원 1~15번"></div>
        <p class="small muted" style="margin:0">줄바꿈으로 여러 개를 한 번에 추가할 수 있습니다.</p>
        <textarea id="td-multi" placeholder="여러 개 입력(선택)"></textarea>`,
      onOk: el => {
        const sub = el.querySelector('#td-sub').value;
        const one = el.querySelector('#td-text').value.trim();
        const many = el.querySelector('#td-multi').value.split('\n').map(x => x.trim()).filter(Boolean);
        const all = one ? [one, ...many] : many;
        if (!all.length) return false;
        App.Store.set(s => all.forEach(text =>
          s.todos.push({ id: App.uid(), date: App.ctx.date, subjectId: sub, text, done: false })));
      },
      onOpen: el => setTimeout(() => el.querySelector('#td-text').focus(), 60)
    });
  }

  function addLog() {
    UI.sheet({
      title: '공부 기록 입력',
      body: `
        <div class="field"><label>과목</label><select id="lg-sub">${UI.subjectOptions()}</select></div>
        <div class="grid2">
          <div class="field"><label>시간(분)</label><input type="number" id="lg-min" inputmode="numeric" placeholder="60"></div>
          <div class="field"><label>날짜</label><input type="date" id="lg-date" value="${App.ctx.date}"></div>
        </div>
        <div class="field"><label>메모</label><input type="text" id="lg-memo" placeholder="예: 유전 오답 정리"></div>`,
      onOk: el => {
        const min = +el.querySelector('#lg-min').value;
        if (!min || min <= 0) return false;
        App.Store.set(s => s.logs.push({
          id: App.uid(),
          date: el.querySelector('#lg-date').value || App.ctx.date,
          subjectId: el.querySelector('#lg-sub').value,
          minutes: min,
          memo: el.querySelector('#lg-memo').value.trim()
        }));
      },
      onOpen: el => setTimeout(() => el.querySelector('#lg-min').focus(), 60)
    });
  }
})();
