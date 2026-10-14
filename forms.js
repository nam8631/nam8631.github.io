/* Tiện ích form: tự tạo slug/SEO, đếm ký tự, ô chọn có tìm kiếm, Ctrl+S, tự lưu nháp. */
/* global BDC */
(() => {
  'use strict';
  if (window.__bdcForms) return;
  window.__bdcForms = true;

  const {
    store, norm, esc, isOurUI, isAuthPage, toast, visible, setNativeValue, flash, slugify, cut,
    fmtTime, pageTitle, fixedAncestor, labelOf,
  } = BDC;

  const FIELD_SEL = [
    'input:not([type=password]):not([type=hidden]):not([type=file]):not([type=submit])',
    ':not([type=button]):not([type=search]):not([type=reset]):not([type=image]):not([type=range]):not([type=color])',
  ].join('') + ', textarea, select';
  const SAVE_RE = /^[\s✓✔💾]*(lưu|save|cập nhật|update|xuất bản|publish)\b/i;
  const SEARCH_RE = /\b(tim kiem|tim|search|loc|filter)\b/;
  const DRAFT_TTL = 3 * 24 * 3600 * 1000;
  const MAX_DRAFTS = 50;
  const LIMITS = { seoTitle: 60, metaDesc: 160 };

  let settings = { ...BDC.DEFAULTS };
  let programmatic = false;

  // ============================================================ phạm vi form
  // Mỗi popup (dialog / lớp phủ position:fixed) hoặc <form> là 1 phạm vi riêng
  function scopeOf(el) {
    return el.closest('[role="dialog"], dialog, [aria-modal="true"]') || fixedAncestor(el) || el.closest('form') || document.body;
  }
  const isField = (el) => !!(el && el.matches && el.matches(FIELD_SEL) && !isOurUI(el));

  function roleOf(el) {
    if (!el || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio') return '';
    if (el.__bdcRole !== undefined) return el.__bdcRole;
    const tests = [norm(labelOf(el)), norm((el.name || el.id || '').replace(/[_-]+/g, ' '))];
    let r = '';
    for (const l of tests) {
      if (!l) continue;
      if (/^(slug|duong dan)\b/.test(l)) r = 'slug';
      else if (/(seo title|tieu de seo|meta title)/.test(l)) r = 'seoTitle';
      else if (/(meta desc|mo ta seo|seo desc)/.test(l)) r = 'metaDesc';
      else if (/^(tieu de|ten|title|name)( (bai viet|san pham|danh muc|thuong hieu|trang|tai lieu))?$/.test(l)) r = 'title';
      else if (/^(tom tat|mo ta ngan|excerpt|summary|short desc)/.test(l)) r = 'summary';
      if (r) break;
    }
    if (labelOf(el)) el.__bdcRole = r;
    return r;
  }

  function findRole(scope, role) {
    const all = [...scope.querySelectorAll(FIELD_SEL)].filter((f) => !isOurUI(f) && scopeOf(f) === scope && roleOf(f) === role);
    return all.find(visible) || all[0] || null;
  }

  // ============================================================ 1) tự tạo slug / SEO
  function setAuto(el, value) {
    programmatic = true;
    try { setNativeValue(el, value); } finally { programmatic = false; }
    el.__bdcAuto = value;
    flash(el);
  }
  // Chỉ tự điền khi ô đang trống hoặc vẫn là giá trị do extension điền (người dùng chưa sửa tay)
  const canAuto = (el) => !el.value || el.value === el.__bdcAuto;

  function smartInput(el) {
    const role = roleOf(el);
    if (!role) return;
    const scope = scopeOf(el);
    if (role === 'title') {
      const slug = findRole(scope, 'slug');
      if (slug && canAuto(slug)) setAuto(slug, slugify(el.value));
      const seo = findRole(scope, 'seoTitle');
      if (seo && canAuto(seo)) setAuto(seo, cut(el.value, LIMITS.seoTitle));
    }
    if (role === 'summary') {
      const md = findRole(scope, 'metaDesc');
      if (md && canAuto(md)) setAuto(md, cut(el.value, LIMITS.metaDesc));
    }
  }

  // ============================================================ 2) đếm ký tự SEO
  let counter = null;
  function showCounter(el) {
    const max = LIMITS[roleOf(el)];
    if (!max || !visible(el)) return hideCounter();
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'bdc-ui bdc-counter';
      document.body.appendChild(counter);
    }
    const n = el.value.length;
    counter.textContent = `${n}/${max} ký tự${n > max ? ' – quá dài, Google sẽ cắt bớt' : ''}`;
    counter.classList.toggle('bdc-over', n > max);
    const r = el.getBoundingClientRect();
    counter.style.top = `${r.bottom + 3}px`;
    counter.style.left = `${Math.max(8, r.right - counter.offsetWidth)}px`;
  }
  function hideCounter() { if (counter) { counter.remove(); counter = null; } }

  // ============================================================ 3) ô chọn dài có tìm kiếm
  let picker = null;
  const bigSelect = (el) => el && el.tagName === 'SELECT' && !el.multiple && !el.disabled && el.options.length > 10 && !isOurUI(el);

  function closePicker() {
    if (picker) { picker.remove(); picker = null; }
  }

  function placePicker(p, sel, host) {
    const r = sel.getBoundingClientRect();
    const width = Math.max(r.width, 280);
    const h = p.offsetHeight;
    const roomBelow = window.innerHeight - r.bottom;
    const top = roomBelow >= h + 8 || roomBelow >= r.top ? r.bottom + 2 : r.top - h - 2;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    p.style.width = `${width}px`;
    if (host === document.body) {
      p.style.position = 'fixed';
      p.style.top = `${top}px`;
      p.style.left = `${left}px`;
    } else {
      const hr = host.getBoundingClientRect();
      p.style.position = 'absolute';
      p.style.top = `${top - hr.top - host.clientTop + host.scrollTop}px`;
      p.style.left = `${left - hr.left - host.clientLeft + host.scrollLeft}px`;
    }
  }

  function openPicker(sel) {
    if (picker && picker.__sel === sel) return closePicker();
    closePicker();
    const scope = scopeOf(sel);
    // Gắn vào trong popup (nếu có) để không bị lớp phủ / focus-trap của popup chặn
    const host = scope !== document.body && getComputedStyle(scope).position !== 'static' ? scope : document.body;

    const opts = [...sel.options].map((o, i) => ({ i, text: o.text.trim() || '—', value: o.value, s: norm(o.text), disabled: o.disabled }));
    let shown = opts;
    let act = Math.max(0, sel.selectedIndex);

    const p = document.createElement('div');
    p.className = 'bdc-ui bdc-picker';
    p.__sel = sel;
    p.innerHTML = `
      <input type="text" class="bdc-picker-q" placeholder="🔍 Gõ để tìm ${esc(labelOf(sel) || '')} (không cần dấu)…" autocomplete="off" />
      <div class="bdc-picker-list"></div>
      <div class="bdc-picker-hint">${opts.length} mục · ↑↓ chọn · Enter · Esc đóng</div>`;
    host.appendChild(p);
    picker = p;
    const q = p.querySelector('.bdc-picker-q');
    const list = p.querySelector('.bdc-picker-list');

    const render = () => {
      if (!shown.length) { list.innerHTML = '<div class="bdc-picker-empty">Không có kết quả</div>'; return; }
      list.innerHTML = shown.slice(0, 300).map((o, k) =>
        `<div class="bdc-picker-item${k === act ? ' bdc-active' : ''}${o.i === sel.selectedIndex ? ' bdc-selected' : ''}${o.disabled ? ' bdc-disabled' : ''}" data-k="${k}">${esc(o.text)}</div>`).join('');
      const a = list.querySelector('.bdc-active');
      if (a) a.scrollIntoView({ block: 'nearest' });
    };
    const choose = (o) => {
      if (!o || o.disabled) return;
      closePicker();
      programmatic = true;
      try { setNativeValue(sel, o.value); } finally { programmatic = false; }
      sel.focus();
      flash(sel);
    };

    shown = opts;
    act = Math.max(0, sel.selectedIndex);
    render();
    placePicker(p, sel, host);
    q.focus();

    q.addEventListener('input', () => {
      const tokens = norm(q.value).split(' ').filter(Boolean);
      shown = !tokens.length ? opts : opts
        .filter((o) => tokens.every((t) => o.s.includes(t)))
        .sort((a, b) => (b.s.startsWith(tokens[0]) ? 1 : 0) - (a.s.startsWith(tokens[0]) ? 1 : 0));
      act = 0;
      render();
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(act + 1, shown.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(act - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(shown[act]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); sel.focus(); }
      else if (e.key === 'Tab') { closePicker(); }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // giữ focus ở ô tìm
    list.addEventListener('click', (e) => {
      const it = e.target.closest('.bdc-picker-item');
      if (it) choose(shown[+it.dataset.k]);
    });
  }

  function setupSmartSelect() {
    document.addEventListener('mousedown', (e) => {
      if (picker && !picker.contains(e.target) && e.target !== picker.__sel) closePicker();
      if (e.button !== 0) return;
      const sel = e.target.closest ? e.target.closest('select') : null;
      if (!bigSelect(sel)) return;
      e.preventDefault(); // chặn danh sách gốc của trình duyệt
      sel.focus();
      openPicker(sel);
    }, true);
    document.addEventListener('keydown', (e) => {
      const sel = e.target;
      if (!bigSelect(sel)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        openPicker(sel);
      }
    }, true);
    document.addEventListener('scroll', (e) => { if (picker && !picker.contains(e.target)) closePicker(); }, true);
    window.addEventListener('resize', closePicker);
  }

  // ============================================================ 4) Ctrl+S = bấm nút Lưu
  const btnText = (b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();

  function findSaveButton() {
    const btns = [...document.querySelectorAll('button, input[type=submit], [role=button]')]
      .filter((b) => !isOurUI(b) && visible(b) && !b.disabled && SAVE_RE.test(btnText(b)));
    if (!btns.length) return null;
    const ae = document.activeElement;
    const aeScope = ae && ae !== document.body ? scopeOf(ae) : null;
    return (aeScope && btns.find((b) => scopeOf(b) === aeScope))
      || btns.find((b) => scopeOf(b) !== document.body) // đang mở popup -> ưu tiên nút trong popup
      || btns[0];
  }

  function onCtrlS(e) {
    if (!settings.ctrlS) return;
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== 'KeyS') return;
    e.preventDefault();
    e.stopPropagation();
    const b = findSaveButton();
    if (!b) return toast('Không tìm thấy nút Lưu trên trang này');
    b.click();
    toast(`💾 Đã bấm "${btnText(b)}"`);
  }

  // ============================================================ 5) tự lưu nháp
  const active = new Set(); // phạm vi đã khởi tạo nháp
  const tracked = new Set(); // phạm vi đang hiển thị (kể cả chưa khởi tạo)

  function fieldsOf(scope) {
    return [...scope.querySelectorAll(FIELD_SEL)].filter((el) =>
      !isOurUI(el) && scopeOf(el) === scope && !SEARCH_RE.test(norm(labelOf(el))) && !SEARCH_RE.test(norm(el.placeholder || '')));
  }

  function editorsOf(scope) {
    const out = [];
    scope.querySelectorAll('[contenteditable="true"], [contenteditable=""]').forEach((el) => {
      if (isOurUI(el) || (el.parentElement && el.parentElement.closest('[contenteditable="true"], [contenteditable=""]'))) return;
      if (scopeOf(el) === scope) out.push(el);
    });
    scope.querySelectorAll('iframe').forEach((f) => {
      try {
        const b = f.contentDocument && f.contentDocument.body;
        if (b && (b.isContentEditable || b.id === 'tinymce') && scopeOf(f) === scope) out.push(b);
      } catch (e) { /* iframe khác domain */ }
    });
    return out;
  }

  function keyedFields(scope) {
    const used = {};
    return fieldsOf(scope).map((el, i) => {
      const l = norm(labelOf(el));
      let k = l ? 'l:' + l : el.name ? 'n:' + el.name : el.id ? 'i:' + el.id : 'x:' + i;
      if (el.type === 'radio') k += '=' + el.value;
      if (used[k]) k += '#' + (++used[k]); else used[k] = 1;
      return { el, k };
    });
  }

  function snapshot(scope) {
    const fields = {};
    keyedFields(scope).forEach(({ el, k }) => {
      fields[k] = el.type === 'checkbox' || el.type === 'radio' ? { c: el.checked } : { v: el.value };
    });
    const editors = editorsOf(scope).map((e) => e.innerHTML.slice(0, 500000));
    return { fields, editors };
  }

  // Tiêu đề popup ("Bài viết mới", "Sản phẩm mới"...) để phân biệt nháp
  function titleFor(scope, field) {
    if (!field) return pageTitle();
    for (let p = field.parentElement; p; p = p.parentElement) {
      const c = [...p.querySelectorAll('h1, h2, h3, h4, h5, [class*="title" i]')].find((h) =>
        !h.contains(field) && !isOurUI(h) && h.tagName !== 'LABEL' && !h.querySelector('input, select, textarea')
        && (h.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)
        && h.innerText.trim().length > 0 && h.innerText.trim().length <= 80);
      if (c) return c.innerText.trim().split('\n')[0];
      if (p === scope) break;
    }
    return pageTitle();
  }

  async function getDrafts() {
    const { drafts = {} } = await store.get('drafts');
    const now = Date.now();
    Object.keys(drafts).forEach((k) => { if (!drafts[k] || now - drafts[k].time > DRAFT_TTL) delete drafts[k]; });
    return drafts;
  }
  async function putDrafts(drafts) {
    const keys = Object.keys(drafts).sort((a, b) => drafts[b].time - drafts[a].time);
    keys.slice(MAX_DRAFTS).forEach((k) => delete drafts[k]);
    await store.set({ drafts });
  }

  function idValue(kf) {
    const f = kf.find((x) => roleOf(x.el) === 'slug')
      || kf.find((x) => x.el.tagName !== 'SELECT' && x.el.type !== 'checkbox' && x.el.type !== 'radio');
    return f ? f.el.value : '';
  }

  // Ghi lại trạng thái lúc popup vừa hiện (trước khi người dùng gõ)
  function firstSight(sc) {
    sc.__bdcSeen = Date.now();
    sc.__bdcTouched = false;
    const kf = keyedFields(sc);
    sc.__bdcFirst = { id: idValue(kf), snap: JSON.stringify(snapshot(sc)) };
  }

  async function initScope(sc) {
    const kf = keyedFields(sc);
    if (kf.length < 3) return; // chỉ quan tâm form thật (>= 3 ô), bỏ qua ô tìm kiếm lẻ
    // Khoá nháp = URL + tiêu đề popup + slug ban đầu (popup sửa của từng mục có slug khác nhau).
    // Nếu người dùng đã gõ trước khi khởi tạo -> dùng giá trị lúc popup vừa mở;
    // nếu chưa gõ -> dùng giá trị hiện tại (popup sửa đã tải xong dữ liệu).
    const first = sc.__bdcTouched && sc.__bdcFirst;
    const title = titleFor(sc, kf[0].el);
    const key = `${location.origin}${location.pathname}${location.search}|${norm(title)}|${first ? first.id : idValue(kf)}`;
    const cur = JSON.stringify(snapshot(sc));
    const s = first ? first.snap : cur;
    sc.__bdc = { key, title, baseline: s, last: s, dirty: false };
    active.add(sc);

    const d = (await getDrafts())[key];
    if (d && !first && JSON.stringify({ fields: d.fields, editors: d.editors }) !== cur) showBanner(sc, d);
    if (first) saveScope(sc);
  }

  async function saveScope(sc) {
    const st = sc.__bdc;
    if (!st || !sc.isConnected) return;
    const snap = snapshot(sc);
    const s = JSON.stringify(snap);
    if (s === st.last) return;
    st.last = s;
    const drafts = await getDrafts();
    if (s === st.baseline) {
      if (st.dirty) { delete drafts[st.key]; await putDrafts(drafts); st.dirty = false; }
      return;
    }
    drafts[st.key] = { time: Date.now(), title: st.title, url: location.href, ...snap };
    st.dirty = true;
    await putDrafts(drafts);
  }

  function queueSave(sc) {
    if (!sc || !sc.__bdc) return;
    clearTimeout(sc.__bdcTimer);
    sc.__bdcTimer = setTimeout(() => saveScope(sc), 600);
  }

  async function markSaved(sc) {
    const st = sc && sc.__bdc;
    if (!st) return;
    clearTimeout(sc.__bdcTimer);
    const drafts = await getDrafts();
    delete drafts[st.key];
    await putDrafts(drafts);
    st.baseline = st.last = JSON.stringify(snapshot(sc));
    st.dirty = false;
    removeBanner(sc);
  }

  function restore(sc, d) {
    let n = 0;
    programmatic = true;
    try {
      keyedFields(sc).forEach(({ el, k }) => {
        const f = d.fields[k];
        if (!f) return;
        if ('c' in f) { if (el.checked !== f.c) { el.click(); n++; } }
        else if (f.v !== el.value) { setNativeValue(el, f.v); n++; }
      });
      editorsOf(sc).forEach((ed, i) => {
        const html = d.editors && d.editors[i];
        if (html == null || html === ed.innerHTML) return;
        ed.innerHTML = html;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        n++;
      });
    } finally { programmatic = false; }
    toast(`Đã khôi phục ${n} mục từ bản nháp`);
    saveScope(sc);
  }

  function removeBanner(sc) {
    if (sc.__bdcBanner) { sc.__bdcBanner.remove(); sc.__bdcBanner = null; }
  }

  function showBanner(sc, d) {
    removeBanner(sc);
    const inline = sc !== document.body && getComputedStyle(sc).position !== 'static';
    const b = document.createElement('div');
    b.className = 'bdc-ui bdc-banner' + (inline ? ' bdc-inline' : '');
    b.innerHTML = `📝 Có bản nháp chưa lưu của "${esc(d.title)}" (lúc ${fmtTime(d.time)}).
      <button type="button" data-a="restore">Khôi phục</button>
      <button type="button" data-a="discard">Bỏ nháp</button>
      <button type="button" data-a="close" title="Ẩn">✕</button>`;
    b.addEventListener('click', async (e) => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      if (a === 'restore') restore(sc, d);
      if (a === 'discard') { const drafts = await getDrafts(); delete drafts[sc.__bdc.key]; await putDrafts(drafts); }
      removeBanner(sc);
    });
    (inline ? sc : document.body).appendChild(b);
    sc.__bdcBanner = b;
  }

  // Quét định kỳ: phát hiện popup/form mới mở, tự lưu (cả trình soạn thảo trong iframe)
  function scan() {
    if (!settings.formDraft || isAuthPage()) return;
    const now = Date.now();
    const seen = new Set();
    document.querySelectorAll(FIELD_SEL).forEach((el) => { if (!isOurUI(el) && visible(el)) seen.add(scopeOf(el)); });
    seen.forEach((sc) => {
      if (!sc.__bdcSeen) firstSight(sc);
      tracked.add(sc);
      if (!sc.__bdc) { if (now - sc.__bdcSeen > 1200) initScope(sc); } // chờ popup sửa tải xong dữ liệu
      else saveScope(sc);
      if (settings.ctrlS) {
        editorsOf(sc).forEach((ed) => {
          const doc = ed.ownerDocument;
          if (doc !== document && !doc.__bdcKeys) { doc.__bdcKeys = true; doc.addEventListener('keydown', onCtrlS, true); }
        });
      }
    });
    // Popup đã đóng/ẩn -> quên trạng thái, lần mở sau khởi tạo lại từ đầu
    tracked.forEach((sc) => {
      if (seen.has(sc)) return;
      tracked.delete(sc);
      active.delete(sc);
      removeBanner(sc);
      sc.__bdc = null;
      sc.__bdcSeen = 0;
      sc.__bdcTouched = false;
    });
  }

  // ============================================================ sự kiện
  function onInput(e) {
    const el = e.target;
    if (programmatic || isOurUI(el)) return;
    if (isField(el) || el.isContentEditable) {
      const sc = scopeOf(el);
      if (!sc.__bdcSeen) { firstSight(sc); tracked.add(sc); } // gõ trước khi lượt quét phát hiện popup
      sc.__bdcTouched = true;
    }
    if (isField(el)) {
      if (settings.smartFields) smartInput(el);
      if (counter) showCounter(el);
    }
    if (settings.formDraft && (isField(el) || el.isContentEditable)) queueSave(scopeOf(el));
  }

  function setup() {
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    document.addEventListener('focusin', (e) => {
      if (!isField(e.target)) return;
      const sc = scopeOf(e.target);
      if (settings.formDraft && !sc.__bdcSeen) { firstSight(sc); tracked.add(sc); }
      if (settings.smartFields) showCounter(e.target);
    }, true);
    document.addEventListener('focusout', (e) => {
      const el = e.target;
      hideCounter();
      if (!settings.smartFields || !isField(el) || roleOf(el) !== 'slug' || !el.value) return;
      const s = slugify(el.value, true);
      if (s !== el.value) {
        programmatic = true;
        try { setNativeValue(el, s); } finally { programmatic = false; }
        flash(el);
        toast(`Đã chuẩn hoá slug: ${s}`);
      }
    }, true);

    if (settings.smartSelect) setupSmartSelect();
    document.addEventListener('keydown', onCtrlS, true);

    if (settings.formDraft) {
      document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('button, input[type=submit], [role=button]');
        if (!b || isOurUI(b) || !SAVE_RE.test(btnText(b))) return;
        let sc = scopeOf(b);
        if (!sc.__bdc) sc = [...active].find((s) => s.contains(b)) || (active.size === 1 ? [...active][0] : null);
        markSaved(sc);
      }, true);
      document.addEventListener('submit', (e) => markSaved(scopeOf(e.target)), true);
      setInterval(scan, 1500);
      setTimeout(scan, 300);
    }
  }

  BDC.loadSettings().then((s) => { settings = s; setup(); });
})();
