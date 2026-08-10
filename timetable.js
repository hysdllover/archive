/* 주간 타임테이블 — 교시(시간대)를 직접 만들고 편집 */
(function () {
  const App = window.App, UI = App.UI;
  const DOWS = [1, 2, 3, 4, 5, 6, 0]; // 월~일

  App.register({
    id: 'timetable', label: '시간표',
    icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/>',

    render() {
      const st = App.Store.get();
      const ps = App.periods();
      const edit = !!App.ctx.ttEdit;

      const rows = ps.map(p => `
        <tr>
          <td class="tt-head">
            <div class="tt-plabel">${UI.esc(p.label)}</div>
            <div class="tt-ptime num">${UI.esc(p.start)}</div>
          </td>
          ${DOWS.map(d => {
            const c = st.timetable[`${d}-${p.id}`];
            const col = c && c.subjectId ? App.subColor(c.subjectId) : null;
            return `<td style="${col ? `background:${col}1F` : ''}">
              <button class="tt-cell" data-act="cell" data-k="${d}-${p.id}" style="${col ? `color:${col}` : ''}">
                ${c ? UI.esc(c.text || App.subName(c.subjectId)) : ''}
              </button></td>`;
          }).join('')}
        </tr>`).join('');

      const editor = ps.map(p => `
        <div class="prow">
          <input type="text" value="${UI.esc(p.label)}" data-act="p-label" data-id="${p.id}" aria-label="교시 이름">
          <input type="time" value="${UI.esc(p.start)}" data-act="p-start" data-id="${p.id}" aria-label="시작">
          <input type="time" value="${UI.esc(p.end || '')}" data-act="p-end" data-id="${p.id}" aria-label="종료">
          <button class="x" data-act="p-del" data-id="${p.id}" aria-label="삭제">×</button>
        </div>`).join('');

      return `
      <div class="stack">
        <section class="card">
          <div class="spread no-print">
            <p class="card-t" style="margin:0">주간 시간표</p>
            <div class="row">
              <button class="btn sm ${edit ? 'pri' : ''}" data-act="edit">${edit ? '편집 끝내기' : '교시 편집'}</button>
              <button class="btn sm" data-act="print">인쇄 · PDF</button>
            </div>
          </div>
          <div class="print-only print-head"><b>주간 학습 시간표</b></div>
          <div class="tt-wrap" style="margin-top:10px">
            <table class="tt">
              <thead><tr><th class="h">교시</th>${DOWS.map(d => `<th>${App.DOW[d]}</th>`).join('')}</tr></thead>
              <tbody>${ps.length ? rows : `<tr><td colspan="8"><p class="empty">교시 편집에서 시간대를 추가하세요.</p></td></tr>`}</tbody>
            </table>
          </div>
          <p class="small muted no-print" style="margin:10px 0 0">
            칸을 눌러 과목과 내용을 지정합니다. 교시는 시작 시각 순으로 자동 정렬됩니다.
          </p>
        </section>

        ${edit ? `
        <section class="card no-print">
          <p class="card-t">교시 편집 · 이름 / 시작 / 종료</p>
          ${editor || `<p class="small muted">교시가 없습니다.</p>`}
          <div class="grid2" style="margin-top:12px">
            <button class="btn" data-act="p-add">교시 추가</button>
            <button class="btn" data-act="p-reset">기본 구성으로</button>
          </div>
          <p class="small muted" style="margin:10px 0 0">교시를 지워도 공부 기록과 성적은 그대로입니다.</p>
        </section>` : `
        <section class="card no-print">
          <p class="card-t">범례</p>
          <div class="chips">${st.subjects.filter(x => x.active !== false).map(x =>
            `<span class="chip"><i class="dot" style="background:${x.color}"></i>${UI.esc(x.name)}</span>`).join('')}</div>
        </section>`}
      </div>`;
    },

    mount(root) {
      root.addEventListener('change', e => {
        const t = e.target, a = t.dataset.act, id = t.dataset.id;
        if (a === 'p-label') App.Store.set(s => { find(s, id).label = t.value.trim() || '교시'; });
        if (a === 'p-start') App.Store.set(s => { find(s, id).start = t.value; });
        if (a === 'p-end') App.Store.set(s => { find(s, id).end = t.value; });
      });

      root.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-act]'); if (!b) return;
        const a = b.dataset.act, id = b.dataset.id;

        if (a === 'print') { try { window.print(); } catch (e) { UI.toast('인쇄를 열 수 없습니다'); } }
        if (a === 'edit') { App.ctx.ttEdit = !App.ctx.ttEdit; App.render(); }
        if (a === 'cell') editCell(b.dataset.k);

        if (a === 'p-add') {
          const ps = App.periods();
          const last = ps[ps.length - 1];
          const start = last ? bump(last.end || last.start, 10) : '08:00';
          App.Store.set(s => s.settings.periods.push({
            id: App.uid(), label: '새 교시', start, end: bump(start, 50)
          }));
        }
        if (a === 'p-del') UI.confirm('이 교시를 지울까요?', () => App.Store.set(s => {
          s.settings.periods = s.settings.periods.filter(p => p.id !== id);
          Object.keys(s.timetable).forEach(k => { if (k.endsWith('-' + id)) delete s.timetable[k]; });
        }));
        if (a === 'p-reset') UI.confirm('교시를 기본 구성으로 되돌릴까요? 시간표 내용은 비워집니다.', () =>
          App.Store.set(s => { s.settings.periods = App.defaultPeriods(); s.timetable = {}; }));
      });
    }
  });

  const find = (s, id) => s.settings.periods.find(p => p.id === id);

  function bump(hhmm, min) {
    const [h, m] = String(hhmm || '08:00').split(':').map(Number);
    const t = (h * 60 + m + min) % 1440;
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }

  function editCell(k) {
    const st = App.Store.get();
    const cur = st.timetable[k] || {};
    const parts = k.split('-'), d = parts[0], pid = parts.slice(1).join('-');
    const ps = App.periods();
    const p = ps.find(x => x.id === pid) || {};
    const idx = ps.indexOf(p);

    UI.sheet({
      title: `${App.DOW[+d]} · ${p.label || ''} ${p.start || ''}`,
      body: `
        <div class="field"><label>과목</label><select id="c-sub">${UI.subjectOptions(cur.subjectId, true)}</select></div>
        <div class="field"><label>표시할 내용(비우면 과목명)</label>
          <input type="text" id="c-text" value="${UI.esc(cur.text || '')}" placeholder="예: 자습, 인강, 학원"></div>
        <div class="field"><label>이어지는 교시까지 함께 적용</label>
          <select id="c-span">${[1, 2, 3, 4].map(n =>
            `<option value="${n}" ${idx + n > ps.length ? 'disabled' : ''}>${n}개 교시</option>`).join('')}</select></div>
        <div class="field"><label>적용 범위</label>
          <select id="c-all"><option value="0">이 요일만</option><option value="1">월~금 전체</option></select></div>
        <button class="btn danger block" id="c-del">이 칸 비우기</button>`,
      onOk: el => {
        const sub = el.querySelector('#c-sub').value;
        const text = el.querySelector('#c-text').value.trim();
        const span = +el.querySelector('#c-span').value;
        const all = el.querySelector('#c-all').value === '1';
        if (!sub && !text) return false;
        const dows = all ? [1, 2, 3, 4, 5] : [+d];
        App.Store.set(s => {
          dows.forEach(dw => {
            for (let i = 0; i < span; i++) {
              const q = ps[idx + i]; if (!q) break;
              s.timetable[`${dw}-${q.id}`] = { subjectId: sub, text };
            }
          });
        });
      },
      onOpen: el => {
        el.querySelector('#c-del').onclick = () => {
          App.Store.set(s => { delete s.timetable[k]; });
          UI.closeSheet();
        };
      }
    });
  }
})();
