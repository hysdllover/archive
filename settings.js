/* 설정 — 과목/색상, 디데이, 화면, 백업 */
(function () {
  const App = window.App, UI = App.UI;
  const ACCENTS = [
    { k: 'navy', n: '네이비' }, { k: 'olive', n: '올리브' },
    { k: 'violet', n: '바이올렛' }, { k: 'rose', n: '로즈' }, { k: 'grey', n: '그레이' }
  ];

  App.register({
    id: 'settings', label: '설정', hidden: true,
    icon: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10h.1a2 2 0 1 1 0 4H21"/>',

    render() {
      const st = App.Store.get(), se = st.settings;
      const snaps = App.Store.snapshots();
      const bk = se.lastBackup ? new Date(se.lastBackup) : null;

      return `
      <div class="stack">
        <section class="card">
          <p class="card-t">과목과 색상</p>
          ${st.subjects.map(s => `
            <div class="item">
              <input type="color" value="${s.color}" data-act="s-color" data-id="${s.id}" aria-label="색상">
              <input type="text" class="grow" value="${UI.esc(s.name)}" data-act="s-name" data-id="${s.id}">
              <select class="gsel" data-act="s-target" data-id="${s.id}" aria-label="목표 등급">
                ${['', 1, 2, 3, 4, 5, 6].map(g =>
                  `<option value="${g}" ${String(s.target || '') === String(g) ? 'selected' : ''}>${g === '' ? '목표–' : g + '등급'}</option>`).join('')}
              </select>
              <button class="x" data-act="s-del" data-id="${s.id}" aria-label="삭제">×</button>
            </div>`).join('')}
          <button class="btn block" data-act="s-add" style="margin-top:10px">과목 추가</button>
          <p class="small muted" style="margin:8px 0 0">목표 등급을 정하면 성적 그래프에 점선으로 표시됩니다. 과목을 지워도 지난 기록과 성적은 남습니다.</p>
        </section>

        <section class="card">
          <p class="card-t">디데이</p>
          ${[...st.ddays].sort((a, b) => a.date.localeCompare(b.date)).map(d => {
            const over = d.date < App.today();
            return `
            <div class="item" style="${over ? 'opacity:.5' : ''}">
              <input type="radio" name="pin" ${d.pinned ? 'checked' : ''} data-act="d-pin" data-id="${d.id}" aria-label="대표" ${over ? 'disabled' : ''}>
              <span class="t">${UI.esc(d.label)}<span class="small muted num"> · ${d.date}${over ? ' · 지남' : ''}</span></span>
              <button class="x" data-act="d-del" data-id="${d.id}">×</button>
            </div>`; }).join('')}
          <button class="btn block" data-act="d-add" style="margin-top:10px">디데이 추가</button>
        </section>

        <section class="card">
          <p class="card-t">화면</p>
          <div class="spread" style="margin-bottom:10px">
            <span>테마</span>
            <div class="row">
              <button class="chip ${se.theme === 'light' ? 'on' : ''}" data-act="theme" data-v="light">밝게</button>
              <button class="chip ${se.theme === 'dark' ? 'on' : ''}" data-act="theme" data-v="dark">어둡게</button>
            </div>
          </div>
          <div class="spread" style="margin-bottom:12px">
            <span>포인트 색</span>
            <div class="chips">${ACCENTS.map(a =>
              `<button class="chip ${se.accent === a.k ? 'on' : ''}" data-act="accent" data-v="${a.k}">${a.n}</button>`).join('')}</div>
          </div>
          <p class="small muted" style="margin:2px 0 0">교시 이름과 시간은 시간표 탭의 <b>교시 편집</b>에서 바꿉니다.</p>
        </section>

        <section class="card">
          <p class="card-t">백업</p>
          <p class="small muted" style="margin:0 0 10px">
            기록은 이 기기에 자동 저장됩니다. 기기를 바꾸거나 사파리 데이터를 지우면 사라지므로,
            주 1회 파일로 내보내 파일 앱·iCloud에 두는 것을 권합니다.
            ${bk ? `<br>마지막 내보내기 ${bk.getFullYear()}. ${bk.getMonth() + 1}. ${bk.getDate()}.` : ''}
          </p>
          <div class="grid2">
            <button class="btn pri" data-act="export">파일로 내보내기</button>
            <button class="btn" data-act="import">파일 불러오기</button>
          </div>
          <div class="grid2" style="margin-top:8px">
            <button class="btn" data-act="copy">텍스트로 복사</button>
            <button class="btn" data-act="paste">붙여넣기로 복원</button>
          </div>
          <div class="hr"></div>
          <p class="sec-t">자동 스냅샷 (최근 ${snaps.length}일)</p>
          ${snaps.length ? snaps.map((s, i) => `
            <div class="item">
              <span class="t num small">${s.date}</span>
              <button class="btn sm" data-act="restore" data-i="${i}">되돌리기</button>
            </div>`).join('') : `<p class="small muted">아직 없음</p>`}
          <div class="hr"></div>
          <button class="btn danger block" data-act="reset">모든 기록 초기화</button>
        </section>

        <section class="card">
          <p class="card-t">정보</p>
          <div class="spread small"><span class="muted">데이터 버전</span><span class="num">v${st.v}</span></div>
          <div class="spread small" style="margin-top:4px"><span class="muted">기록 수</span>
            <span class="num">공부 ${st.logs.length} · 할 일 ${st.todos.length} · 시험 ${st.exams.length}</span></div>
        </section>
      </div>`;
    },

    mount(root) {
      /* 즉시 반영되는 입력들 */
      root.addEventListener('change', e => {
        const t = e.target, a = t.dataset.act;
        if (a === 's-color') App.Store.set(s => { App.subject(t.dataset.id).color = t.value; });
        if (a === 's-name') App.Store.set(s => { App.subject(t.dataset.id).name = t.value.trim() || '과목'; });
        if (a === 's-target') App.Store.set(s => { App.subject(t.dataset.id).target = t.value ? +t.value : null; });
        if (a === 'd-pin') App.Store.set(s => s.ddays.forEach(d => d.pinned = d.id === t.dataset.id));
      });

      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const a = b.dataset.act;

        if (a === 's-add') UI.sheet({
          title: '과목 추가',
          body: `<div class="field"><label>이름</label><input type="text" id="n-name" placeholder="예: 지구과학Ⅰ"></div>
                 <div class="chips" id="n-pal">${App.PALETTE.map((c, i) =>
                   `<button class="chip" data-c="${c}"><i class="dot" style="background:${c}"></i></button>`).join('')}</div>`,
          onOk: el => {
            const n = el.querySelector('#n-name').value.trim(); if (!n) return false;
            const picked = el.querySelector('#n-pal .on');
            const st = App.Store.get();
            App.Store.set(s => s.subjects.push({
              id: App.uid(), name: n,
              color: picked ? picked.dataset.c : App.PALETTE[st.subjects.length % App.PALETTE.length],
              active: true
            }));
          },
          onOpen: el => el.querySelector('#n-pal').addEventListener('click', ev => {
            const c = ev.target.closest('[data-c]'); if (!c) return;
            el.querySelectorAll('#n-pal .chip').forEach(x => x.classList.remove('on'));
            c.classList.add('on');
          })
        });

        if (a === 's-del') UI.confirm('과목을 목록에서 지울까요? 기록은 유지됩니다.', () =>
          App.Store.set(s => { s.subjects = s.subjects.filter(x => x.id !== b.dataset.id); }));

        if (a === 'd-add') UI.sheet({
          title: '디데이 추가',
          body: `<div class="field"><label>이름</label><input type="text" id="dd-l" placeholder="예: 9월 모의평가"></div>
                 <div class="field"><label>날짜</label><input type="date" id="dd-d" value="${App.today()}"></div>`,
          onOk: el => {
            const l = el.querySelector('#dd-l').value.trim(); if (!l) return false;
            App.Store.set(s => s.ddays.push({
              id: App.uid(), label: l, date: el.querySelector('#dd-d').value, pinned: !s.ddays.length
            }));
          }
        });
        if (a === 'd-del') App.Store.set(s => { s.ddays = s.ddays.filter(x => x.id !== b.dataset.id); });

        if (a === 'theme') App.Store.set(s => { s.settings.theme = b.dataset.v; });
        if (a === 'accent') App.Store.set(s => { s.settings.accent = b.dataset.v; });

        if (a === 'export') {
          UI.download(`planner-${App.today()}.json`, App.Store.exportJSON());
          App.Store.set(s => { s.settings.lastBackup = Date.now(); });
          UI.toast('파일 앱에 저장하세요');
        }
        if (a === 'copy') {
          navigator.clipboard.writeText(App.Store.exportJSON())
            .then(() => UI.toast('복사됨 · 메모 앱에 붙여넣어 두세요'))
            .catch(() => UI.toast('복사 실패'));
        }
        if (a === 'import') pickFile();
        if (a === 'paste') UI.sheet({
          title: '붙여넣기로 복원',
          body: `<textarea id="p-json" placeholder="내보낸 JSON을 붙여넣으세요" style="min-height:140px"></textarea>
                 <div class="field"><label>방식</label>
                   <select id="p-mode"><option value="merge">병합 (기존 기록 유지)</option><option value="replace">덮어쓰기</option></select></div>`,
          onOk: el => {
            try { App.Store.importJSON(el.querySelector('#p-json').value, el.querySelector('#p-mode').value); UI.toast('복원 완료'); }
            catch (err) { UI.toast('형식이 올바르지 않습니다'); return false; }
          }
        });

        if (a === 'restore') UI.confirm(`${App.Store.snapshots()[b.dataset.i].date} 상태로 되돌릴까요?`, () => {
          App.Store.restoreSnapshot(+b.dataset.i); UI.toast('되돌렸습니다');
        });

        if (a === 'reset') UI.confirm('모든 기록이 사라집니다. 계속할까요?', () => {
          App.Store.reset(); UI.toast('초기화됨');
        });
      });
    }
  });

  function pickFile() {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = () => {
      const f = i.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        UI.sheet({
          title: '불러오기 방식',
          body: `<select id="f-mode"><option value="merge">병합 (기존 기록 유지)</option><option value="replace">덮어쓰기</option></select>`,
          onOk: el => {
            try { App.Store.importJSON(r.result, el.querySelector('#f-mode').value); UI.toast('불러왔습니다'); }
            catch (e) { UI.toast('파일을 읽지 못했습니다'); return false; }
          }
        });
      };
      r.readAsText(f);
    };
    i.click();
  }
})();
