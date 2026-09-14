/* ============================================================
   sync.js — GitHub Gist 기기 간 동기화 (추가 모듈)

   · store.js / app.js 를 고치지 않는다. 이 파일과 index.html의
     <script> 한 줄, settings.js의 진입 버튼만으로 동작한다.
   · 병합 방식: 마지막 동기화 시점(base)을 기준으로 한 3자 병합.
       - 한쪽에서만 바뀐 항목  → 바뀐 쪽 값
       - 양쪽에서 바뀐 항목    → 이 기기 값 (충돌 건수 표시)
       - base에 있었는데 사라진 항목 → 삭제로 보고 반영
   · timer / mock 은 기기별 상태라 동기화하지 않는다.
   · 토큰은 이 기기의 localStorage에만 저장된다(Gist로 올라가지 않음).
   ============================================================ */
(function () {
  const App = window.App, UI = App.UI;

  const CFG_KEY = 's3p.sync';
  const BASE_KEY = 's3p.syncbase';
  const FILE = 'planner.json';
  const LOCAL_ONLY = ['timer', 'mock'];
  const LIST_KEYS = ['subjects', 'ddays', 'goals', 'todos', 'logs', 'events', 'exams', 'applies'];

  /* ---------- 설정 저장소 ---------- */
  const DEFAULT_CFG = { token: '', gistId: '', auto: true, last: 0, device: '' };
  function cfg() {
    try { return Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULT_CFG); }
  }
  function setCfg(patch) {
    const c = Object.assign(cfg(), patch);
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }
  function getBase() {
    try { const r = localStorage.getItem(BASE_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function setBase(d) {
    try { localStorage.setItem(BASE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  /* ---------- 비교 유틸 (키 순서와 무관하게 동일 판정) ---------- */
  function sst(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(sst).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + sst(v[k])).join(',') + '}';
  }
  const same = (a, b) => sst(a) === sst(b);
  const clone = o => JSON.parse(JSON.stringify(o));

  /* 동기화 대상만 추린 사본 */
  function snap(st) {
    const o = clone(st);
    LOCAL_ONLY.forEach(k => delete o[k]);
    return o;
  }

  /* ---------- 병합 ---------- */
  const byId = arr => { const m = {}; (arr || []).forEach(x => { if (x && x.id) m[x.id] = x; }); return m; };

  function mergeList(b, l, r, stat) {
    const B = byId(b), L = byId(l), R = byId(r);
    const order = [];
    (l || []).forEach(x => order.push(x.id));
    (r || []).forEach(x => { if (!L[x.id]) order.push(x.id); });

    const out = [], seen = {};
    order.forEach(id => {
      if (seen[id]) return; seen[id] = 1;
      const bb = B[id], ll = L[id], rr = R[id];
      if (ll && rr) {
        if (same(ll, rr)) out.push(ll);
        else if (same(ll, bb)) { out.push(rr); stat.in++; }
        else if (same(rr, bb)) { out.push(ll); stat.out++; }
        else { out.push(ll); stat.conflict++; }
      } else if (ll && !rr) {
        if (bb) stat.del++;            // 다른 기기에서 삭제됨
        else { out.push(ll); stat.out++; }
      } else if (!ll && rr) {
        if (bb) stat.del++;            // 이 기기에서 삭제됨
        else { out.push(rr); stat.in++; }
      }
    });
    return out;
  }

  function mergeMap(b, l, r, stat) {
    b = b || {}; l = l || {}; r = r || {};
    const out = {}, keys = new Set([...Object.keys(l), ...Object.keys(r)]);
    keys.forEach(k => {
      const bb = b[k], ll = l[k], rr = r[k];
      const hasL = ll !== undefined, hasR = rr !== undefined, hasB = bb !== undefined;
      if (hasL && hasR) {
        if (same(ll, rr)) out[k] = ll;
        else if (same(ll, bb)) { out[k] = rr; stat.in++; }
        else if (same(rr, bb)) { out[k] = ll; stat.out++; }
        else { out[k] = ll; stat.conflict++; }
      } else if (hasL && !hasR) {
        if (hasB) stat.del++; else { out[k] = ll; stat.out++; }
      } else if (!hasL && hasR) {
        if (hasB) stat.del++; else { out[k] = rr; stat.in++; }
      }
    });
    return out;
  }

  function mergeSettings(b, l, r, stat) {
    b = b || {}; l = l || {}; r = r || {};
    const out = {}, keys = new Set([...Object.keys(l), ...Object.keys(r)]);
    keys.forEach(k => {
      if (k === 'periods') { out.periods = mergeList(b.periods, l.periods, r.periods, stat); return; }
      const bb = b[k], ll = l[k], rr = r[k];
      if (ll === undefined) { out[k] = rr; return; }
      if (rr === undefined) { out[k] = ll; return; }
      if (same(ll, rr)) out[k] = ll;
      else if (same(ll, bb)) out[k] = rr;
      else out[k] = ll;
    });
    /* 마지막 백업 시각은 더 최근 것 */
    if (l.lastBackup || r.lastBackup) out.lastBackup = Math.max(l.lastBackup || 0, r.lastBackup || 0) || null;
    return out;
  }

  function merge(b, local, remote) {
    const stat = { in: 0, out: 0, del: 0, conflict: 0 };
    b = b || {};
    const out = { v: App.SCHEMA };
    out.settings = mergeSettings(b.settings, local.settings, remote.settings, stat);
    LIST_KEYS.forEach(k => { out[k] = mergeList(b[k], local[k], remote[k], stat); });
    out.timetable = mergeMap(b.timetable, local.timetable, remote.timetable, stat);
    /* 이 코드가 모르는 키가 있어도 잃지 않는다 */
    Object.keys(Object.assign({}, remote, local)).forEach(k => {
      if (out[k] === undefined && LOCAL_ONLY.indexOf(k) < 0)
        out[k] = local[k] !== undefined ? local[k] : remote[k];
    });
    return { data: out, stat };
  }

  /* ---------- GitHub Gist API ---------- */
  function api(path, opt) {
    const c = cfg();
    if (!c.token) return Promise.reject(new Error('토큰이 없습니다'));
    return fetch('https://api.github.com' + path, Object.assign({
      headers: {
        'Authorization': 'token ' + c.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    }, opt)).then(res => {
      if (res.status === 401) throw new Error('토큰이 올바르지 않습니다');
      if (res.status === 404) throw new Error('NOT_FOUND');
      if (res.status === 403) throw new Error('요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요');
      if (!res.ok) throw new Error('통신 실패 (' + res.status + ')');
      return res.json();
    });
  }

  function pull() {
    const c = cfg();
    if (!c.gistId) return Promise.resolve(null);
    return api('/gists/' + c.gistId).then(g => {
      const f = g.files && g.files[FILE];
      if (!f) return null;
      if (f.truncated && f.raw_url) return fetch(f.raw_url).then(r => r.text()).then(JSON.parse);
      return JSON.parse(f.content);
    }).catch(e => {
      if (e.message === 'NOT_FOUND') throw new Error('Gist를 찾을 수 없습니다. ID를 확인하세요');
      throw e;
    });
  }

  function push(data) {
    const c = cfg();
    const body = JSON.stringify({
      description: 'Study Planner sync',
      files: { [FILE]: { content: JSON.stringify(data) } }
    });
    if (c.gistId) return api('/gists/' + c.gistId, { method: 'PATCH', body }).then(g => g.id);
    return api('/gists', { method: 'POST', body: JSON.stringify({
      description: 'Study Planner sync', public: false,
      files: { [FILE]: { content: JSON.stringify(data) } }
    }) }).then(g => { setCfg({ gistId: g.id }); return g.id; });
  }

  /* ---------- 동작 ---------- */
  let busy = false;

  function apply(data) {
    App.Store.set(s => {
      Object.keys(data).forEach(k => { if (LOCAL_ONLY.indexOf(k) < 0) s[k] = data[k]; });
    });
  }

  /* 양방향 동기화 */
  function sync(silent) {
    const c = cfg();
    if (!c.token) { if (!silent) UI.toast('토큰을 먼저 입력하세요'); return Promise.resolve(false); }
    if (busy) return Promise.resolve(false);
    busy = true;
    if (!silent) UI.toast('동기화 중…');
    App.Store.saveNow();

    return pull().then(remote => {
      const local = snap(App.Store.get());
      let next, stat = { in: 0, out: 0, del: 0, conflict: 0 };

      if (!remote) { next = local; stat.out = -1; }
      else { const m = merge(getBase(), local, remote); next = m.data; stat = m.stat; }

      const changedLocal = !same(next, local);
      const changedRemote = !remote || !same(next, remote);

      return (changedRemote ? push(next) : Promise.resolve(cfg().gistId)).then(() => {
        if (changedLocal) apply(next);
        setBase(next);
        setCfg({ last: Date.now() });
        dirty = false;
        if (!silent) {
          const msg = stat.out === -1 ? '업로드 완료'
            : (stat.in || stat.out || stat.del || stat.conflict)
              ? `동기화 완료 · 받음 ${stat.in} · 보냄 ${stat.out}` +
                (stat.del ? ` · 삭제 ${stat.del}` : '') + (stat.conflict ? ` · 충돌 ${stat.conflict}` : '')
              : '이미 최신입니다';
          UI.toast(msg);
        }
        if (App.render) App.render();
        return true;
      });
    }).catch(e => {
      if (!silent) UI.toast(e.message || '동기화 실패');
      return false;
    }).then(r => { busy = false; return r; });
  }

  /* 강제 업로드 / 강제 내려받기 */
  function force(dir) {
    if (busy) return;
    busy = true;
    if (dir === 'up') {
      const local = snap(App.Store.get());
      App.Store.saveNow();
      push(local).then(() => {
        setBase(local); setCfg({ last: Date.now() }); dirty = false;
        UI.toast('이 기기 내용으로 덮어썼습니다'); App.render();
      }).catch(e => UI.toast(e.message || '실패')).then(() => { busy = false; });
    } else {
      pull().then(remote => {
        if (!remote) { UI.toast('가져올 내용이 없습니다'); return; }
        apply(remote); setBase(remote); setCfg({ last: Date.now() }); dirty = false;
        UI.toast('서버 내용으로 덮어썼습니다');
      }).catch(e => UI.toast(e.message || '실패')).then(() => { busy = false; });
    }
  }

  /* ---------- 자동 동기화 ---------- */
  let dirty = false, timer = null;
  const AUTO_DELAY = 20000;

  const _save = App.Store.save;
  App.Store.save = function () {
    dirty = true;
    schedule();
    return _save.apply(App.Store, arguments);
  };

  function schedule() {
    const c = cfg();
    if (!c.auto || !c.token) return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (dirty && !document.hidden) sync(true); }, AUTO_DELAY);
  }

  document.addEventListener('visibilitychange', () => {
    const c = cfg();
    if (!c.auto || !c.token) return;
    if (!document.hidden) setTimeout(() => sync(true), 400);   // 돌아왔을 때 최신으로
  });

  window.addEventListener('load', () => {
    const c = cfg();
    if (c.auto && c.token) setTimeout(() => sync(true), 800);  // 앱을 열 때
  });

  /* ---------- 외부 공개 ---------- */
  App.Sync = {
    sync, force, cfg, setCfg,
    _merge: merge, _snap: snap,   /* 점검용 */
    on: () => !!cfg().token,
    lastText: () => {
      const t = cfg().last;
      if (!t) return '아직 동기화한 적 없음';
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      const today = App.today() === App.ymd(d);
      return (today ? '오늘' : `${d.getMonth() + 1}. ${d.getDate()}.`) + ` ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
  };

  /* ---------- 설정 화면에 진입 카드 덧붙이기 ----------
     settings.js를 고치지 않는다. 이 파일은 index.html에서
     settings.js 뒤에 실려, 등록된 설정 화면을 감싸 카드만 추가한다. */
  function entryCard() {
    const c = cfg();
    const txt = c.token
      ? `GitHub Gist로 아이폰·아이패드 기록을 자동으로 맞춥니다.<br>마지막 동기화 ${UI.esc(App.Sync.lastText())}`
      : '아직 연결되지 않았습니다. 연결하면 두 기기의 기록이 자동으로 합쳐집니다.';
    return `
        <section class="card">
          <p class="card-t">기기 간 동기화</p>
          <p class="small muted" style="margin:0 0 10px">${txt}</p>
          <button class="btn ${c.token ? '' : 'pri'} block" data-act="go-sync">동기화 설정</button>
        </section>`;
  }

  function attachToSettings() {
    const sv = (App.views || []).find(v => v.id === 'settings');
    if (!sv || sv.__syncPatched) return;
    sv.__syncPatched = true;
    const render = sv.render.bind(sv);
    const mount = sv.mount ? sv.mount.bind(sv) : null;

    sv.render = function () {
      const html = render();
      const i = html.lastIndexOf('</div>');
      return i < 0 ? html + entryCard() : html.slice(0, i) + entryCard() + html.slice(i);
    };
    sv.mount = function (root) {
      if (mount) mount(root);
      root.addEventListener('click', e => {
        if (e.target.closest('[data-act="go-sync"]')) App.go('sync');
      });
    };
  }
  attachToSettings();
  window.addEventListener('load', attachToSettings);

  /* ---------- 화면 ---------- */
  App.register({
    id: 'sync', label: '동기화', hidden: true,
    icon: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 20v-4h4"/>',

    render() {
      const c = cfg();
      const on = !!c.token;
      return `
      <div class="stack">
        <section class="card">
          <p class="card-t">상태</p>
          <div class="spread small">
            <span class="muted">연결</span>
            <span>${on ? (c.gistId ? '연결됨' : '토큰만 저장됨') : '연결 안 됨'}</span>
          </div>
          <div class="spread small" style="margin-top:4px">
            <span class="muted">마지막 동기화</span><span class="num">${UI.esc(App.Sync.lastText())}</span>
          </div>
          <div class="spread small" style="margin-top:4px">
            <span class="muted">Gist ID</span>
            <span class="num" style="max-width:150px;overflow:hidden;text-overflow:ellipsis">${UI.esc(c.gistId || '–')}</span>
          </div>
          <div class="hr"></div>
          <button class="btn pri block" data-act="now" ${on ? '' : 'disabled'}>지금 동기화</button>
          <div class="spread" style="margin-top:14px">
            <span class="small">자동 동기화</span>
            <div class="row">
              <button class="chip ${c.auto ? 'on' : ''}" data-act="auto" data-v="1">켬</button>
              <button class="chip ${c.auto ? '' : 'on'}" data-act="auto" data-v="0">끔</button>
            </div>
          </div>
          <p class="small muted" style="margin:8px 0 0">앱을 열 때, 다른 앱에서 돌아올 때, 기록을 바꾸고 20초 뒤에 자동으로 맞춥니다.</p>
        </section>

        <section class="card">
          <p class="card-t">연결 설정</p>
          <div class="field"><label>GitHub 토큰</label>
            <input type="password" id="sy-token" value="${UI.esc(c.token)}" placeholder="ghp_…" autocomplete="off"></div>
          <div class="field" style="margin-top:10px"><label>Gist ID</label>
            <input type="text" id="sy-gist" value="${UI.esc(c.gistId)}" placeholder="비우면 새로 만듭니다" autocomplete="off"></div>
          <button class="btn block" data-act="save" style="margin-top:12px">저장</button>
          <p class="small muted" style="margin:10px 0 0">
            github.com → Settings → Developer settings → Personal access tokens → <b>Tokens (classic)</b> →
            Generate new token, 권한은 <b>gist</b> 하나만 체크. 만료는 No expiration 또는 1년.<br>
            첫 기기에서 Gist ID를 비운 채 동기화하면 비공개 Gist가 자동으로 만들어집니다.
            그 뒤 이 화면에 표시되는 ID를 다른 기기에 그대로 적어 넣으세요.
          </p>
        </section>

        <section class="card">
          <p class="card-t">문제가 생겼을 때</p>
          <div class="grid2">
            <button class="btn" data-act="up" ${on ? '' : 'disabled'}>이 기기로 덮어쓰기</button>
            <button class="btn" data-act="down" ${on ? '' : 'disabled'}>서버로 덮어쓰기</button>
          </div>
          <p class="small muted" style="margin:10px 0 0">
            양쪽 기록이 어긋났을 때만 쓰세요. 한쪽 내용이 사라집니다.
            평소에는 <b>지금 동기화</b>만으로 양쪽 기록이 합쳐집니다.
          </p>
          <div class="hr"></div>
          <button class="btn danger block" data-act="off">연결 해제</button>
          <p class="small muted" style="margin:8px 0 0">토큰과 동기화 기준점만 지웁니다. 이 기기의 기록은 그대로입니다.</p>
        </section>

        <section class="card">
          <p class="card-t">알아둘 것</p>
          <p class="small muted" style="margin:0">
            토큰은 이 기기에만 저장되고 Gist에는 올라가지 않습니다. 기기를 잃어버렸다면 GitHub에서 토큰을 삭제하세요.<br>
            진행 중인 공부 타이머·실전 타이머는 기기별 상태라 동기화하지 않습니다.<br>
            같은 항목을 두 기기에서 동시에 고치면 이 기기의 값이 남습니다.
          </p>
        </section>
      </div>`;
    },

    mount(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const a = b.dataset.act;

        if (a === 'now') sync(false);
        if (a === 'auto') { setCfg({ auto: b.dataset.v === '1' }); App.render(); }
        if (a === 'save') {
          setCfg({
            token: root.querySelector('#sy-token').value.trim(),
            gistId: root.querySelector('#sy-gist').value.trim()
          });
          UI.toast('저장됨');
          App.render();
        }
        if (a === 'up') UI.confirm('서버 내용을 이 기기 기록으로 덮어쓸까요?', () => force('up'));
        if (a === 'down') UI.confirm('이 기기 기록을 서버 내용으로 덮어쓸까요?', () => force('down'));
        if (a === 'off') UI.confirm('연결을 해제할까요? 기록은 그대로 남습니다.', () => {
          localStorage.removeItem(CFG_KEY); localStorage.removeItem(BASE_KEY);
          UI.toast('연결 해제됨'); App.render();
        });
      });
    }
  });
})();
