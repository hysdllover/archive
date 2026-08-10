/* 성적 — 모의고사/수능 기록과 등급 추이 */
(function () {
  const App = window.App, UI = App.UI;
  const TYPES = ['학평', '모평', '수능', '사설', '내신'];

  App.register({
    id: 'exam', label: '성적',
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',

    render() {
      const st = App.Store.get();
      const exams = [...st.exams].sort((a, b) => a.date.localeCompare(b.date));
      const sel = App.ctx.examId && exams.find(e => e.id === App.ctx.examId) || exams[exams.length - 1];

      /* 등급 추이 */
      const subs = st.subjects.filter(s => s.active !== false);
      const series = subs.map(s => ({
        color: s.color,
        name: s.name,
        target: s.target || null,
        points: exams.map(ex => {
          const r = (ex.results || []).find(r => r.subjectId === s.id);
          return r && r.grade ? +r.grade : null;
        })
      })).filter(se => se.points.some(p => p != null));

      const chart = exams.length
        ? `${UI.gradeChart(series)}
           <div class="chips" style="margin-top:6px">${series.map(se =>
             `<span class="chip"><i class="dot" style="background:${se.color}"></i>${UI.esc(se.name)}</span>`).join('')}</div>
           <div class="row small muted" style="margin-top:6px;justify-content:space-between">
             <span>${exams[0].date.slice(2).replace(/-/g, '.')}</span>
             <span>${exams[exams.length - 1].date.slice(2).replace(/-/g, '.')}</span></div>`
        : `<p class="empty">시험을 추가하면 등급 추이가 그려집니다.</p>`;

      const detail = sel ? `
        <section class="card">
          <div class="spread" style="margin-bottom:4px">
            <div>
              <p class="card-t" style="margin:0">${UI.esc(sel.type)} · ${UI.esc(sel.name)}</p>
              <span class="small muted num">${sel.date}</span>
            </div>
            <button class="btn sm danger" data-act="ex-del" data-id="${sel.id}">삭제</button>
          </div>
          <div class="srow head">
            <span>과목</span><span>백분위</span><span>등급</span><span></span>
          </div>
          ${subs.map(s => {
            const r = (sel.results || []).find(r => r.subjectId === s.id) || {};
            const detail = [r.raw != null ? '원 ' + r.raw : '', r.std != null ? '표 ' + r.std : '']
                            .filter(Boolean).join(' · ');
            return `<div class="srow">
              <span class="sname">
                <span class="row" style="gap:6px"><i class="dot" style="background:${s.color}"></i>${UI.esc(s.name)}</span>
                ${detail ? `<span class="small muted num">${detail}</span>` : ''}
                ${r.memo ? `<span class="small muted">${UI.esc(r.memo)}</span>` : ''}
              </span>
              <input type="number" inputmode="numeric" class="pinput num" data-act="pct" data-sid="${s.id}"
                     value="${r.pct != null ? r.pct : ''}" placeholder="–" aria-label="백분위">
              <select class="gsel ${r.grade ? '' : 'empty'}" data-act="grade" data-sid="${s.id}" aria-label="등급">
                ${['', 1, 2, 3, 4, 5, 6, 7, 8, 9].map(g =>
                  `<option value="${g}" ${String(r.grade || '') === String(g) ? 'selected' : ''}>${g === '' ? '–' : g}</option>`).join('')}
              </select>
              <button class="btn sm icon" data-act="res" data-sid="${s.id}" aria-label="상세">⋯</button>
            </div>`;
          }).join('')}
          <p class="small muted" style="margin:10px 0 0">원점수·표준점수와 오답은 ⋯ 에서 적습니다.</p>
        </section>` : '';

      return `
      <div class="stack">
        <section class="card">
          <div class="spread" style="margin-bottom:8px">
            <p class="card-t" style="margin:0">등급 추이</p>
            <button class="btn sm pri" data-act="ex-add">시험 추가</button>
          </div>
          ${chart}
        </section>

        ${exams.length ? `<section class="card">
          <p class="card-t">시험 목록</p>
          <div class="chips">${exams.slice().reverse().map(e =>
            `<button class="chip ${sel && e.id === sel.id ? 'on' : ''}" data-act="pick" data-id="${e.id}">${e.date.slice(5).replace('-', '.')} ${UI.esc(e.name)}</button>`).join('')}</div>
        </section>` : ''}

        ${detail}
      </div>`;
    },

    mount(root) {
      root.addEventListener('change', e => {
        const t = e.target, a = t.dataset.act;
        if (a !== 'grade' && a !== 'pct') return;
        const sid = t.dataset.sid;
        const val = t.value === '' ? null : +t.value;
        const key = a === 'grade' ? 'grade' : 'pct';
        const st = App.Store.get();
        const exId = App.ctx.examId || (st.exams[st.exams.length - 1] || {}).id;
        App.Store.set(s => {
          const ex = s.exams.find(x => x.id === exId); if (!ex) return;
          ex.results = ex.results || [];
          const i = ex.results.findIndex(x => x.subjectId === sid);
          if (i >= 0) ex.results[i][key] = val;
          else {
            const row = { subjectId: sid, raw: null, std: null, pct: null, grade: null, memo: '' };
            row[key] = val;
            ex.results.push(row);
          }
        });
      });

      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'ex-add') addExam();
        if (a === 'pick') { App.ctx.examId = b.dataset.id; App.render(); }
        if (a === 'ex-del') UI.confirm('이 시험 기록을 삭제할까요?', () =>
          App.Store.set(s => { s.exams = s.exams.filter(x => x.id !== b.dataset.id); App.ctx.examId = null; }));
        if (a === 'res') editResult(b.dataset.sid);
      });
    }
  });

  function addExam() {
    UI.sheet({
      title: '시험 추가',
      body: `
        <div class="grid2">
          <div class="field"><label>날짜</label><input type="date" id="x-date" value="${App.today()}"></div>
          <div class="field"><label>유형</label><select id="x-type">${TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>이름</label><input type="text" id="x-name" placeholder="예: 6월 모의평가"></div>`,
      onOk: el => {
        const name = el.querySelector('#x-name').value.trim();
        if (!name) return false;
        const id = App.uid();
        App.Store.set(s => s.exams.push({
          id, date: el.querySelector('#x-date').value,
          type: el.querySelector('#x-type').value, name, results: []
        }));
        App.ctx.examId = id;
        App.render();
      },
      onOpen: el => setTimeout(() => el.querySelector('#x-name').focus(), 60)
    });
  }

  function editResult(sid) {
    const st = App.Store.get();
    const ex = st.exams.find(e => e.id === (App.ctx.examId || (st.exams[st.exams.length - 1] || {}).id));
    if (!ex) return;
    const r = (ex.results || []).find(x => x.subjectId === sid) || {};
    UI.sheet({
      title: `${App.subName(sid)} · ${ex.name}`,
      body: `
        <div class="grid2">
          <div class="field"><label>원점수</label><input type="number" inputmode="numeric" id="r-raw" value="${r.raw ?? ''}"></div>
          <div class="field"><label>표준점수</label><input type="number" inputmode="numeric" id="r-std" value="${r.std ?? ''}"></div>
          <div class="field"><label>백분위</label><input type="number" inputmode="numeric" id="r-pct" value="${r.pct ?? ''}"></div>
          <div class="field"><label>등급</label><input type="number" inputmode="numeric" min="1" max="9" id="r-grade" value="${r.grade ?? ''}"></div>
        </div>
        <div class="field"><label>틀린 문항 · 오답 원인</label>
          <textarea id="r-memo" placeholder="예: 14, 17번 / 유전 가계도 해석 미숙">${UI.esc(r.memo || '')}</textarea></div>`,
      onOk: el => {
        const v = q => { const x = el.querySelector(q).value; return x === '' ? null : +x; };
        const next = {
          subjectId: sid, raw: v('#r-raw'), std: v('#r-std'), pct: v('#r-pct'),
          grade: v('#r-grade'), memo: el.querySelector('#r-memo').value.trim()
        };
        App.Store.set(s => {
          const e = s.exams.find(x => x.id === ex.id);
          e.results = e.results || [];
          const i = e.results.findIndex(x => x.subjectId === sid);
          if (i >= 0) e.results[i] = next; else e.results.push(next);
        });
      }
    });
  }
})();
