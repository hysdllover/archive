/* ============================================================
   ui.js — 공통 UI 유틸 (시트/토스트/차트/포맷)
   ============================================================ */
(function () {
  const App = window.App;
  const UI = (App.UI = {});

  UI.esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  UI.hm = m => {
    m = Math.max(0, Math.round(m || 0));
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? `${h}시간 ${mm}분` : `${mm}분`;
  };
  UI.hmShort = m => {
    m = Math.max(0, Math.round(m || 0));
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  };
  UI.dateLabel = s => {
    const d = App.parse(s);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${App.DOW[d.getDay()]})`;
  };

  /* ---------- 토스트 ---------- */
  let tId = null;
  UI.toast = msg => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(tId); tId = setTimeout(() => t.classList.remove('on'), 1800);
  };

  /* ---------- 바텀 시트 ----------
     UI.sheet({title, body:HTML, ok:'저장', onOk:(sheetEl)=>true|false, extra:HTML})  */
  UI.sheet = opt => {
    const root = document.getElementById('sheet-root');
    root.innerHTML =
      `<div class="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">
        <h3>${UI.esc(opt.title || '')}</h3>
        <div class="stack" id="sheet-body">${opt.body || ''}</div>
        <div class="actions">
          <button class="btn" data-close>취소</button>
          ${opt.ok === null ? '' : `<button class="btn pri" data-ok>${UI.esc(opt.ok || '저장')}</button>`}
        </div>
      </div></div>`;
    const bg = root.firstElementChild;
    const close = () => { root.innerHTML = ''; };
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.querySelector('[data-close]').onclick = close;
    const okBtn = bg.querySelector('[data-ok]');
    if (okBtn) okBtn.onclick = () => {
      if (!opt.onOk || opt.onOk(bg) !== false) close();
    };
    if (opt.onOpen) opt.onOpen(bg);
    UI.close = close;
    return bg;
  };
  UI.closeSheet = () => { document.getElementById('sheet-root').innerHTML = ''; };

  UI.confirm = (msg, onYes) => UI.sheet({
    title: msg, body: '', ok: '확인', onOk: () => { onYes(); }
  });

  /* ---------- 과목 선택 옵션 ---------- */
  UI.subjectOptions = (sel, allowEmpty) => {
    const s = App.Store.get().subjects.filter(x => x.active !== false);
    return (allowEmpty ? `<option value="">과목 없음</option>` : '') +
      s.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${UI.esc(x.name)}</option>`).join('');
  };

  /* ---------- 막대 차트 (주간 공부시간 등) ---------- */
  UI.barChart = (items, opt) => {
    opt = opt || {};
    const W = 320, H = opt.h || 92, pad = 14, bw = (W - pad * 2) / items.length;
    const max = Math.max(opt.max || 0, ...items.map(i => i.v), 1);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H + 16}" preserveAspectRatio="none">`;
    s += `<line class="gl" x1="${pad}" y1="${H}" x2="${W - pad}" y2="${H}"/>`;
    if (opt.avg) {
      const gy = H - (opt.avg / max) * (H - 10);
      s += `<line x1="${pad}" y1="${gy.toFixed(1)}" x2="${W - pad}" y2="${gy.toFixed(1)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 3" opacity=".55"/>`;
    }
    items.forEach((it, i) => {
      const h = (it.v / max) * (H - 10);
      const x = pad + i * bw + bw * 0.24, w = bw * 0.52;
      s += `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="1.5" fill="${it.color || 'var(--accent)'}" opacity="${it.dim ? .35 : .85}"/>`;
      s += `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H + 11}" text-anchor="middle">${UI.esc(it.label)}</text>`;
    });
    return s + '</svg>';
  };

  /* ---------- 등급 추이 (1등급이 위로, 실제 구간에 맞춰 확대) ---------- */
  UI.gradeChart = series => {
    const W = 320, H = 120, padL = 20, padR = 8, padT = 10, padB = 16;
    const vals = [];
    series.forEach(se => {
      se.points.forEach(p => { if (p != null) vals.push(p); });
      if (se.target) vals.push(se.target);
    });
    let lo = 1, hi = 9;
    if (vals.length) {
      lo = Math.max(1, Math.min.apply(null, vals) - 1);
      hi = Math.min(9, Math.max.apply(null, vals) + 1);
      if (hi - lo < 2) { hi = Math.min(9, lo + 2); lo = Math.max(1, hi - 2); }
    }
    const n = Math.max(...series.map(s => s.points.length), 1);
    const x = i => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
    const y = g => padT + ((g - lo) / (hi - lo)) * (H - padT - padB);

    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
    const step = hi - lo > 5 ? 2 : 1;
    for (let g = lo; g <= hi; g += step) {
      s += `<line class="gl" x1="${padL}" y1="${y(g).toFixed(1)}" x2="${W - padR}" y2="${y(g).toFixed(1)}"/>`;
      s += `<text x="2" y="${(y(g) + 3).toFixed(1)}">${g}</text>`;
    }
    series.forEach(se => {
      if (se.target) {
        s += `<line x1="${padL}" y1="${y(se.target).toFixed(1)}" x2="${W - padR}" y2="${y(se.target).toFixed(1)}"
                stroke="${se.color}" stroke-width="1" stroke-dasharray="2 4" opacity=".4"/>`;
      }
      const pts = se.points.map((p, i) => (p == null ? null : [x(i), y(p)])).filter(Boolean);
      if (pts.length > 1) {
        s += `<polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"
                fill="none" stroke="${se.color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      pts.forEach(p => { s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="${se.color}"/>`; });
    });
    return s + '</svg>';
  };

  /* ---------- 파일 저장 / 불러오기 ---------- */
  UI.download = (filename, text) => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
})();
