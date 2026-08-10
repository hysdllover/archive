/* ============================================================
   app.js — 앱 셸 (탭 / 라우팅 / 렌더)
   [기능 추가 방법]
   js/views/새기능.js 를 만들고 아래 형태로 등록한 뒤,
   index.html의 app.js 위에 <script>만 한 줄 추가하면 끝.

   App.register({
     id:'review', label:'복습',
     icon:'<path d="..."/>',          // 24x24 stroke 아이콘
     render(){ return '<div>...</div>' },
     mount(root){},                    // 이벤트 연결(선택)
     unmount(){}                       // 타이머 정리(선택)
   });
   ============================================================ */
(function () {
  const App = window.App;
  App.ctx.date = App.today();
  App.ctx.month = App.today().slice(0, 7);
  App.ctx.examId = null;

  let current = null;
  let route = (location.hash || '').slice(1) || null;

  App.go = id => {
    route = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    App.render();
  };

  function activeView() {
    return App.views.find(v => v.id === route) || App.views.find(v => !v.hidden);
  }

  App.render = () => {
    const st = App.Store.get();
    document.documentElement.dataset.theme = st.settings.theme;
    document.documentElement.dataset.accent = st.settings.accent;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', st.settings.theme === 'dark' ? '#141417' : '#FAFAF8');

    const v = activeView();
    const sameView = current === v;
    const keepY = sameView ? (window.scrollY || window.pageYOffset || 0) : 0;
    if (current && current.unmount) current.unmount();
    current = v;

    /* 상단 바 */
    const dd = [...st.ddays].sort((a, b) => a.date.localeCompare(b.date));
    const main = dd.find(d => d.pinned) || dd[0];
    const n = main ? App.diffDays(App.today(), main.date) : null;
    document.getElementById('tb-eyebrow').textContent =
      main ? (n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`) : 'STUDY';
    document.getElementById('tb-title').textContent = v.label;
    renderRight(v);

    /* 본문 — 매번 새 컨테이너에 그린다.
       (같은 노드를 재사용하면 mount()의 이벤트 처리기가 겹겹이 쌓여
        클릭이 여러 번 실행되고 체크 해제가 먹지 않는다) */
    const host = document.getElementById('view');
    const root = document.createElement('div');
    root.innerHTML = v.render();
    host.innerHTML = '';
    host.appendChild(root);
    if (v.mount) v.mount(root);
    /* 탭을 바꿀 때만 맨 위로. 같은 화면 안의 변경은 보던 위치를 지킨다 */
    window.scrollTo(0, sameView ? keepY : 0);

    /* 탭 */
    document.querySelectorAll('#tabbar button').forEach(b =>
      b.classList.toggle('on', b.dataset.id === v.id));
  };

  /* 숫자 서체 — 필요한 것만 그때그때 불러온다 */
  /* 상단 우측 — 진행 중 타이머 + 설정 */
  function renderRight(v) {
    const st = App.Store.get();
    const gear = App.views.find(x => x.id === 'settings');
    const el = document.getElementById('tb-right');
    el.innerHTML =
      (st.timer ? `<button class="tb-chip" id="tb-timer" aria-label="측정 중">
          <i class="pulse"></i><span class="num" id="tb-time">0:00:00</span>
          <span class="tb-sub">${App.UI.esc(App.subName(st.timer.subjectId))}</span>
        </button>` : '') +
      `<button class="tb-gear ${v.id === 'settings' ? 'on' : ''}" id="tb-gear" aria-label="설정">
         <svg viewBox="0 0 24 24">${gear ? gear.icon : ''}</svg></button>`;
    const g = el.querySelector('#tb-gear');
    if (g) g.onclick = () => App.go('settings');
    const t = el.querySelector('#tb-timer');
    if (t) t.onclick = () => App.go('planner');
    tickChip();
  }

  /* 어느 화면에 있든 1초마다 경과 시간 갱신 */
  function tickChip() {
    const st = App.Store.get();
    const el = document.getElementById('tb-time');
    if (!el || !st || !st.timer) return;
    const s = Math.floor((Date.now() - st.timer.startedAt) / 1000);
    el.textContent = Math.floor(s / 3600) + ':' +
      String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' +
      String(s % 60).padStart(2, '0');
  }
  setInterval(tickChip, 1000);

  function buildTabs() {
    document.getElementById('tabbar').innerHTML = App.views.filter(v => !v.hidden).map(v => `
      <button data-id="${v.id}">
        <svg viewBox="0 0 24 24">${v.icon}</svg><span>${v.label}</span>
      </button>`).join('');
    document.getElementById('tabbar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (b) App.go(b.dataset.id);
    });
  }

  /* 시작 */
  App.Store.load();
  buildTabs();
  window.addEventListener('hashchange', () => {
    route = (location.hash || '').slice(1) || route;
    App.render();
  });
  App.render();

  /* 저장 안정성: 화면을 떠날 때 즉시 저장 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) App.Store.saveNow();
  });
  window.addEventListener('pagehide', () => App.Store.saveNow());

  /* iOS에서 저장 공간이 지워지지 않도록 요청 */
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  /* 백업 알림 */
  setTimeout(() => {
    const se = App.Store.get().settings;
    const days = se.lastBackup ? (Date.now() - se.lastBackup) / 86400000 : 99;
    if (days > (se.backupNudgeDays || 7))
      App.UI.toast('설정 → 백업에서 기록을 파일로 저장해 두세요');
  }, 2500);
})();
