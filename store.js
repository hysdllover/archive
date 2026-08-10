/* ============================================================
   store.js — 데이터 계층
   기능을 추가/수정해도 기존 기록이 유지되도록,
   데이터는 이 파일에서만 다루고 화면(views)은 데이터를 읽기만 한다.

   [기능 추가 시 규칙]
   1) 새 데이터가 필요하면 defaults()에 키를 추가한다.
   2) SCHEMA 번호를 +1 하고 MIGRATIONS에 변환 함수를 추가한다.
      → 기존 사용자의 저장 데이터가 자동으로 새 구조로 업그레이드된다.
   3) 절대 기존 키의 의미를 바꾸지 말 것(추가만 할 것).
   ============================================================ */
(function () {
  const App = (window.App = window.App || {});

  const KEY = 's3p.data';
  const SNAP_KEY = 's3p.snapshots';
  App.SCHEMA = 3;

  App.uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* 화면 등록소 — views 파일이 app.js보다 먼저 로드되므로 여기서 준비한다 */
  App.views = [];
  App.register = v => App.views.push(v);
  App.ctx = {};

  /* 저채도 과목 색상 팔레트 (직접 지정도 가능) */
  App.PALETTE = [
    '#5E6E8A', '#6C7A58', '#8A7C9B', '#A3808A', '#6F8A88',
    '#8B7F6C', '#6B839B', '#9B8C6E', '#7C7C86', '#8FA089',
    '#A99BB2', '#B09A93'
  ];

  /* 기본 교시 구성 — 시간표 탭에서 자유롭게 편집 */
  function defaultPeriods() {
    return [
      ['아침자습', '07:50', '08:30'], ['1교시', '08:40', '09:30'],
      ['2교시', '09:40', '10:30'], ['3교시', '10:40', '11:30'],
      ['4교시', '11:40', '12:30'], ['점심', '12:30', '13:20'],
      ['5교시', '13:20', '14:10'], ['6교시', '14:20', '15:10'],
      ['7교시', '15:20', '16:10'], ['야자 1', '17:00', '19:00'],
      ['야자 2', '19:30', '21:30'], ['귀가 후', '21:40', '23:30']
    ].map((p, i) => ({ id: 'p' + i, label: p[0], start: p[1], end: p[2] }));
  }
  App.defaultPeriods = defaultPeriods;

  function defaults() {
    const names = ['국어', '수학', '영어', '생활과 윤리', '사회·문화'];
    return {
      v: App.SCHEMA,
      settings: {
        owner: '',
        theme: 'light',
        accent: 'navy',
        periods: defaultPeriods(),
        lastBackup: null,
        backupNudgeDays: 7
      },
      subjects: names.map((n, i) => ({
        id: App.uid(), name: n, color: App.PALETTE[i % App.PALETTE.length], active: true
      })),
      ddays: [
        { id: App.uid(), label: '2027학년도 수능', date: '2026-11-19', pinned: true }
      ],
      goals: [],      // {id, ddayId, text, done}
      todos: [],      // {id, date, subjectId, text, done}
      logs: [],       // {id, date, subjectId, minutes, memo}
      events: [],     // {id, date, title, memo}
      timetable: {},  // 'dow-periodId' -> {subjectId, text}
      exams: [],      // {id, date, name, type, results:[{subjectId, raw, std, pct, grade, memo}]}
      applies: [],    // 수시 지원 {id, univ, dept, type, docDue, interview, pick, limit, subs:[id], memo}
      timer: null,    // {subjectId, startedAt}
      mock: null      // 실전 타이머 {subjectId, label, totalMin, startedAt, pausedMs, pausedAt}
    };
  }
  App.defaults = defaults;

  /* 스키마 마이그레이션: MIGRATIONS[n] = 버전 n → n+1 */
  const MIGRATIONS = {
    /* v1 → v2 : 시간(hour) 격자 → 교시(period) 격자, 목표 → 디데이 연결 */
    1: (d) => {
      const pad = n => String(n).padStart(2, '0');
      const keys = Object.keys(d.timetable || {});
      if (keys.length) {
        const hours = [...new Set(keys.map(k => +k.split('-')[1]))].sort((a, b) => a - b);
        d.settings.periods = hours.map(h => ({
          id: 'h' + h, label: pad(h) + '시', start: pad(h) + ':00', end: pad(h + 1) + ':00'
        }));
        const next = {};
        keys.forEach(k => { const [dw, h] = k.split('-'); next[dw + '-h' + h] = d.timetable[k]; });
        d.timetable = next;
      } else {
        d.settings.periods = defaultPeriods();
      }
      delete d.settings.dayStart; delete d.settings.dayEnd;

      const pin = ((d.ddays || []).find(x => x.pinned) || (d.ddays || [])[0] || {}).id || null;
      (d.goals || []).forEach(g => { if (!g.ddayId) g.ddayId = pin; delete g.scope; });
      return d;
    },
    /* v2 → v3 : 수시 지원 목록, 실전 타이머, 과목별 목표 등급 */
    2: (d) => {
      if (!d.applies) d.applies = [];
      if (d.mock === undefined) d.mock = null;
      (d.subjects || []).forEach(s => { if (s.target === undefined) s.target = null; });
      return d;
    }
  };

  function migrate(data) {
    let v = data.v || 1;
    while (v < App.SCHEMA && MIGRATIONS[v]) { data = MIGRATIONS[v](data) || data; v++; }
    data.v = App.SCHEMA;
    return data;
  }

  /* 누락된 키를 기본값으로 채움 (기존 기록은 그대로 보존) */
  function fill(data) {
    const d = defaults();
    for (const k in d) if (data[k] === undefined || data[k] === null) data[k] = d[k];
    for (const k in d.settings)
      if (data.settings[k] === undefined) data.settings[k] = d.settings[k];
    return data;
  }

  let state = null;
  let saveTimer = null;

  const Store = (App.Store = {
    get() { return state; },

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        state = raw ? fill(migrate(JSON.parse(raw))) : defaults();
      } catch (e) {
        console.warn('데이터를 읽지 못해 마지막 스냅샷을 찾습니다.', e);
        const snaps = Store.snapshots();
        state = snaps.length ? fill(migrate(JSON.parse(snaps[0].json))) : defaults();
      }
      return state;
    },

    /* 모든 변경은 여기로. 자동저장 + 화면 갱신 */
    set(mutator) {
      mutator(state);
      Store.save();
      if (App.render) App.render();
    },

    save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(state));
          Store.autoSnapshot();
        } catch (e) {
          alert('저장 공간이 부족합니다. 설정 → 백업에서 파일로 내보낸 뒤 오래된 기록을 정리하세요.');
        }
      }, 200);
    },

    saveNow() {
      clearTimeout(saveTimer);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    },

    /* ---------- 스냅샷(자동 백업) : 하루 1개, 최근 10개 보관 ---------- */
    snapshots() {
      try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); }
      catch (e) { return []; }
    },
    autoSnapshot() {
      const list = Store.snapshots();
      const today = App.ymd(new Date());
      if (list[0] && list[0].date === today) { list[0].json = JSON.stringify(state); }
      else { list.unshift({ date: today, at: Date.now(), json: JSON.stringify(state) }); }
      while (list.length > 10) list.pop();
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(list)); } catch (e) { list.pop(); }
    },
    restoreSnapshot(i) {
      const s = Store.snapshots()[i];
      if (!s) return false;
      state = fill(migrate(JSON.parse(s.json)));
      Store.saveNow();
      if (App.render) App.render();
      return true;
    },

    /* ---------- 파일 백업 ---------- */
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text, mode) {
      const incoming = fill(migrate(JSON.parse(text)));
      if (mode === 'merge') {
        // id 기준 병합: 기존 기록 유지 + 없는 항목만 추가
        ['subjects', 'ddays', 'goals', 'todos', 'logs', 'events', 'exams'].forEach(k => {
          const have = new Set(state[k].map(x => x.id));
          incoming[k].forEach(x => { if (!have.has(x.id)) state[k].push(x); });
        });
        Object.assign(state.timetable, incoming.timetable);
      } else {
        state = incoming;
      }
      state.settings.lastBackup = Date.now();
      Store.saveNow();
      if (App.render) App.render();
    },
    reset() {
      state = defaults();
      Store.saveNow();
      if (App.render) App.render();
    }
  });

  /* ---------- 날짜 유틸 ---------- */
  App.ymd = d => {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  App.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  App.addDays = (s, n) => { const d = App.parse(s); d.setDate(d.getDate() + n); return App.ymd(d); };
  App.today = () => App.ymd(new Date());
  App.DOW = ['일', '월', '화', '수', '목', '금', '토'];
  App.mondayOf = s => { const d = App.parse(s); const w = (d.getDay() + 6) % 7; return App.addDays(s, -w); };
  App.diffDays = (a, b) => Math.round((App.parse(b) - App.parse(a)) / 86400000);

  /* ---------- 조회 헬퍼 (뷰에서 공통 사용) ---------- */
  App.subject = id => state.subjects.find(s => s.id === id) || null;
  App.subName = id => (App.subject(id) || {}).name || '기타';
  App.subColor = id => (App.subject(id) || {}).color || '#9A9A94';
  App.minutesOn = date =>
    state.logs.filter(l => l.date === date).reduce((a, l) => a + (+l.minutes || 0), 0);
  App.minutesRange = (from, to) =>
    state.logs.filter(l => l.date >= from && l.date <= to).reduce((a, l) => a + (+l.minutes || 0), 0);

  /* 가장 최근 시험의 과목별 등급 (없으면 그 이전 시험에서 보충) */
  App.latestGrades = () => {
    const out = {};
    [...state.exams].sort((a, b) => a.date.localeCompare(b.date)).forEach(ex => {
      (ex.results || []).forEach(r => { if (r.grade) out[r.subjectId] = +r.grade; });
    });
    return out;
  };

  /* 교시 목록(시작 시각 순) */
  App.periods = () => (state.settings.periods || []).slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  /* 진행 중 타이머의 경과 분 */
  App.timerMinutes = () => {
    if (!state.timer) return 0;
    return Math.floor((Date.now() - state.timer.startedAt) / 60000);
  };
})();
