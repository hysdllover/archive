/* 수시 원서 — 지원 대학별 마감·면접 일정과 수능 최저 충족 여부 */
(function () {
  const App = window.App, UI = App.UI;
  const TYPES = ['학생부교과', '학생부종합', '논술', '실기·특기', '기타'];

  /* 최저 충족 계산: 선택 과목 중 성적이 좋은 순으로 pick개를 골라 합을 낸다 */
  function minCheck(a) {
    if (!a.pick || !a.limit || !(a.subs || []).length) return null;
    const g = App.latestGrades();
    const have = a.subs.map(id => g[id]).filter(x => x != null).sort((x, y) => x - y);
    if (have.length < a.pick) return { ready: false };
    const sum = have.slice(0, a.pick).reduce((x, y) => x + y, 0);
    return { ready: true, sum, ok: sum <= a.limit, used: have.slice(0, a.pick) };
  }

  function dtag(date, label) {
    if (!date) return '';
    const n = App.diffDays(App.today(), date);
    const cls = n < 0 ? 'muted' : n <= 7 ? 'urgent' : '';
    return `<span class="dtag ${cls}">${label} ${date.slice(5).replace('-', '.')}
      <b class="num">${n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : '지남'}</b></span>`;
  }

  App.register({
    id: 'apply', label: '수시', hidden: true,
    icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',

    render() {
      const st = App.Store.get(), today = App.today();
      const list = [...(st.applies || [])].sort((a, b) =>
        (a.docDue || '9999') .localeCompare(b.docDue || '9999'));

      const cards = list.map(a => {
        const m = minCheck(a);
        return `
        <section class="card">
          <div class="spread">
            <div class="grow">
              <div style="font-size:14px">${UI.esc(a.univ || '대학 미정')}
                <span class="muted" style="font-size:12px"> ${UI.esc(a.dept || '')}</span></div>
              <div class="small muted">${UI.esc(a.type || '')}</div>
            </div>
            <button class="btn sm" data-act="edit" data-id="${a.id}">수정</button>
          </div>
          <div class="row wrap" style="margin-top:10px;gap:6px">
            ${dtag(a.docDue, '서류')}${dtag(a.interview, '면접')}
          </div>
          ${a.pick && a.limit ? `
            <div class="hr"></div>
            <div class="spread">
              <span class="small">최저 ${a.pick}개 합 ${a.limit}
                <span class="muted">· ${(a.subs || []).map(id => App.subName(id)).join(', ')}</span></span>
              ${m && m.ready
                ? `<span class="num small" style="color:${m.ok ? 'var(--accent)' : 'var(--danger)'}">
                     현재 ${m.sum} · ${m.ok ? '충족' : '미달'}</span>`
                : `<span class="small muted">성적 입력 필요</span>`}
            </div>
            ${m && m.ready ? `<div class="small muted num" style="margin-top:4px">${m.used.join(' + ')} 등급 기준</div>` : ''}
          ` : ''}
          ${a.memo ? `<p class="small muted" style="margin:10px 0 0">${UI.esc(a.memo)}</p>` : ''}
        </section>`;
      }).join('');

      /* 다가오는 일정 요약 */
      const upcoming = [];
      list.forEach(a => {
        if (a.docDue && a.docDue >= today) upcoming.push({ d: a.docDue, t: `${a.univ} 서류 마감` });
        if (a.interview && a.interview >= today) upcoming.push({ d: a.interview, t: `${a.univ} 면접` });
      });
      upcoming.sort((x, y) => x.d.localeCompare(y.d));

      return `
      <div class="stack">
        <section class="card">
          <div class="spread">
            <div>
              <p class="card-t" style="margin:0">지원 현황</p>
              <span class="small muted">${list.length} / 6곳</span>
            </div>
            <button class="btn sm pri" data-act="add" ${list.length >= 6 ? 'disabled' : ''}>지원 추가</button>
          </div>
          ${upcoming.length ? `<div class="hr"></div>${upcoming.slice(0, 5).map(u => {
            const n = App.diffDays(today, u.d);
            return `<div class="item">
              <span class="t small">${UI.esc(u.t)}</span>
              <span class="num small ${n <= 7 ? '' : 'muted'}" style="${n <= 7 ? 'color:var(--danger)' : ''}">${n > 0 ? 'D-' + n : 'D-DAY'}</span>
            </div>`;
          }).join('')}` : ''}
        </section>

        ${cards || `<div class="card"><p class="empty">지원할 대학을 추가하면 마감일과 최저 충족 여부를 함께 관리합니다.</p></div>`}
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        if (b.dataset.act === 'add') edit(null);
        if (b.dataset.act === 'edit') edit(b.dataset.id);
      });
    }
  });

  function edit(id) {
    const st = App.Store.get();
    const a = (st.applies || []).find(x => x.id === id) || { subs: [] };
    const subs = st.subjects.filter(s => s.active !== false);

    UI.sheet({
      title: id ? '지원 수정' : '지원 추가',
      body: `
        <div class="grid2">
          <div class="field"><label>대학</label><input type="text" id="a-univ" value="${UI.esc(a.univ || '')}" placeholder="예: ○○대"></div>
          <div class="field"><label>학과</label><input type="text" id="a-dept" value="${UI.esc(a.dept || '')}" placeholder="예: 생명공학과"></div>
        </div>
        <div class="field"><label>전형</label>
          <select id="a-type">${TYPES.map(t => `<option ${a.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="grid2">
          <div class="field"><label>서류 마감</label><input type="date" id="a-doc" value="${a.docDue || ''}"></div>
          <div class="field"><label>면접일</label><input type="date" id="a-int" value="${a.interview || ''}"></div>
        </div>
        <div class="hr"></div>
        <p class="sec-t" style="margin:0">수능 최저 조건</p>
        <div class="grid2">
          <div class="field"><label>몇 개 과목</label>
            <select id="a-pick"><option value="">없음</option>${[1, 2, 3, 4].map(n =>
              `<option value="${n}" ${+a.pick === n ? 'selected' : ''}>${n}개</option>`).join('')}</select></div>
          <div class="field"><label>등급 합 이내</label>
            <input type="number" inputmode="numeric" id="a-limit" value="${a.limit || ''}" placeholder="예: 5"></div>
        </div>
        <div class="field"><label>대상 과목</label>
          <div class="chips wrapchips" id="a-subs">${subs.map(s =>
            `<button class="chip ${(a.subs || []).includes(s.id) ? 'on' : ''}" data-s="${s.id}">
              <i class="dot" style="background:${s.color}"></i>${UI.esc(s.name)}</button>`).join('')}</div></div>
        <div class="field"><label>메모</label>
          <textarea id="a-memo" placeholder="예: 자소서 없음 / 면접 10분 제시문">${UI.esc(a.memo || '')}</textarea></div>
        ${id ? `<button class="btn danger block" id="a-del">이 지원 삭제</button>` : ''}`,
      onOk: el => {
        const univ = el.querySelector('#a-univ').value.trim();
        if (!univ) return false;
        const next = {
          id: id || App.uid(),
          univ,
          dept: el.querySelector('#a-dept').value.trim(),
          type: el.querySelector('#a-type').value,
          docDue: el.querySelector('#a-doc').value || null,
          interview: el.querySelector('#a-int').value || null,
          pick: el.querySelector('#a-pick').value ? +el.querySelector('#a-pick').value : null,
          limit: el.querySelector('#a-limit').value ? +el.querySelector('#a-limit').value : null,
          subs: [...el.querySelectorAll('#a-subs .chip.on')].map(x => x.dataset.s),
          memo: el.querySelector('#a-memo').value.trim()
        };
        App.Store.set(s => {
          s.applies = s.applies || [];
          const i = s.applies.findIndex(x => x.id === next.id);
          if (i >= 0) s.applies[i] = next; else s.applies.push(next);
        });
      },
      onOpen: el => {
        el.querySelector('#a-subs').addEventListener('click', ev => {
          const c = ev.target.closest('.chip'); if (c) c.classList.toggle('on');
        });
        const del = el.querySelector('#a-del');
        if (del) del.onclick = () => {
          App.Store.set(s => { s.applies = s.applies.filter(x => x.id !== id); });
          UI.closeSheet();
        };
      }
    });
  }
})();
