/* Bảng lệnh, ghim, gần đây, công cụ bảng, tiền tố tab. Cần sites.js + common.js nạp trước. */
/* global BDC, BDC_SITES, bdcSiteOf */
(() => {
  'use strict';
  if (window.__bdcAdmin) return;
  window.__bdcAdmin = true;

  const {
    store, norm, esc, debounce, pad, isOurUI, isAuthPage, toast, visible, setNativeValue, safePath,
    pageTitle, fixedAncestor, labelOf,
  } = BDC;

  const SITE = bdcSiteOf(location.href) || { id: 'x', name: location.host, origin: location.origin, home: location.origin + '/', color: '#1d4ed8' };
  const MENU_KEY = 'menuCache:' + SITE.origin;
  const MAX_RECENT = 30;
  const MAX_MENU_CACHE = 300;
  const NAV_SEL = 'nav, aside, [role="navigation"], [class*="sidebar" i], [class*="menu" i]';
  const CREATE_RE = /(^\+|thêm|tạo|mới|new|add|import|nhập)/i;

  let settings = { ...BDC.DEFAULTS };

  // ---------------------------------------------------------------- recent & pins
  async function trackRecent() {
    if (!settings.recent || isAuthPage()) return;
    const { recent = [] } = await store.get('recent');
    const item = { url: location.href, title: pageTitle(), time: Date.now() };
    await store.set({ recent: [item, ...recent.filter((r) => r.url !== item.url)].slice(0, MAX_RECENT) });
  }

  async function pinCurrent() {
    const { pins = [] } = await store.get('pins');
    if (pins.some((p) => p.url === location.href)) return toast('Trang này đã được ghim');
    pins.push({ url: location.href, title: pageTitle() });
    await store.set({ pins });
    toast(`📌 Đã ghim [${SITE.name}]: ${pageTitle()}`);
  }

  // ---------------------------------------------------------------- thu thập mục cho bảng lệnh
  function collectLinks() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      if (isOurUI(a)) return;
      const href = a.href;
      if (!href || !href.startsWith(location.origin) || href.endsWith('#') || /\/(auth\/)?(logout|dang-xuat)/i.test(href)) return;
      if (seen.has(href)) return;
      const text = (a.innerText || a.title || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 80) return;
      seen.add(href);
      out.push({ kind: a.closest(NAV_SEL) ? 'menu' : 'link', url: href, title: text });
    });
    return out.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'menu' ? -1 : 1));
  }

  // Nút trên trang hiện tại: menu dạng nút (không phải link) + nút "Thêm / Tạo mới…"
  function collectClickables() {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="tab"]').forEach((el) => {
      if (isOurUI(el) || !visible(el) || el.disabled || el.closest('a[href]')) return;
      const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 40 || /đăng xuất|logout/i.test(text)) return;
      const inMenu = !!el.closest(NAV_SEL);
      if (!inMenu && !CREATE_RE.test(text) && el.getAttribute('role') !== 'tab') return;
      const k = norm(text);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ kind: inMenu ? 'menu' : 'action', title: inMenu ? text : `Bấm: ${text}`, run: () => el.click() });
    });
    return out;
  }

  // Ô chọn ngắn ngoài form (vd: chọn site TTECH / TTECH Commerce ở trang Tổng quan)
  function collectQuickSelects() {
    const out = [];
    document.querySelectorAll('select').forEach((sel) => {
      if (isOurUI(sel) || !visible(sel) || sel.disabled || sel.options.length > 15 || fixedAncestor(sel)) return;
      const form = sel.closest('form');
      if (form && form.querySelectorAll('input, textarea, select').length > 2) return;
      const label = labelOf(sel) || 'tuỳ chọn';
      [...sel.options].forEach((o, i) => {
        if (i === sel.selectedIndex || o.disabled || !o.text.trim()) return;
        out.push({ kind: 'action', title: `Chọn ${label}: ${o.text.trim()}`, run: () => { setNativeValue(sel, o.value); toast(`Đã chọn ${o.text.trim()}`); } });
      });
    });
    return out;
  }

  // ---------------------------------------------------------------- bảng lệnh
  let palette = null;
  let items = [];
  let shown = [];
  let active = 0;

  async function buildItems() {
    const otherKeys = BDC_SITES.filter((s) => s.origin !== SITE.origin).map((s) => 'menuCache:' + s.origin);
    const data = await store.get(['pins', 'recent', MENU_KEY, ...otherKeys]);
    const { pins = [], recent = [] } = data;
    const links = collectLinks();

    // Ghi nhớ link menu đã thấy của site này (kể cả menu con bị thu gọn ở trang khác)
    const cache = new Map((data[MENU_KEY] || []).map((x) => [x.url, x]));
    links.filter((l) => l.kind === 'menu').forEach((l) => cache.set(l.url, { url: l.url, title: l.title }));
    const cacheList = [...cache.values()].slice(-MAX_MENU_CACHE);
    store.set({ [MENU_KEY]: cacheList });
    const otherMenus = otherKeys.flatMap((k) => data[k] || []);

    const actions = [
      ...collectClickables().filter((x) => x.kind === 'action'),
      ...collectQuickSelects(),
      ...BDC_SITES.filter((s) => s.origin !== SITE.origin).map((s) => ({
        kind: 'action', title: `Chuyển sang CMS ${s.name} (tab mới)`, run: () => window.open(s.home, '_blank'),
      })),
      { kind: 'action', title: 'Ghim trang hiện tại', run: pinCurrent },
      { kind: 'action', title: 'Sao chép link trang hiện tại', run: () => navigator.clipboard.writeText(location.href).then(() => toast('Đã sao chép link'), () => toast('Không sao chép được')) },
      { kind: 'action', title: 'Xuất bảng trên trang ra CSV', run: () => { const t = firstDataTable(); if (t) exportCSV(t); else toast('Không tìm thấy bảng dữ liệu'); } },
      { kind: 'action', title: 'Tải lại trang', run: () => location.reload() },
      { kind: 'action', title: 'Lên đầu trang', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    ];

    const seen = new Set();
    items = [
      ...actions,
      ...pins.map((p) => ({ kind: 'pin', ...p })),
      ...links,
      ...collectClickables().filter((x) => x.kind === 'menu'),
      ...cacheList.map((c) => ({ kind: 'menu', ...c })),
      ...recent.map((r) => ({ kind: 'recent', ...r })),
      ...otherMenus.map((c) => ({ kind: 'menu', ...c })),
    ].filter((it) => {
      const k = it.url || 't:' + norm(it.title);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    items.forEach((it) => {
      it.site = it.url ? bdcSiteOf(it.url) : null;
      it._s = norm(`${it.title} ${it.site ? it.site.name : ''} ${it.url ? safePath(it.url) : ''}`);
    });
  }

  const KIND_LABEL = { action: '⚡ Lệnh', pin: '📌 Ghim', menu: '☰ Menu', link: '🔗 Link', recent: '🕘 Gần đây' };

  function filterItems(q) {
    const tokens = norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return items.slice(0, 80);
    const first = tokens[0];
    const rank = { menu: 0, pin: 0, action: 1, link: 2, recent: 2 };
    return items
      .filter((it) => tokens.every((t) => it._s.includes(t)))
      .map((it) => ({
        it,
        score: (norm(it.title).replace(/^bam: /, '').startsWith(first) ? 0 : 10)
          + (it.site && it.site.origin !== SITE.origin ? 5 : 0) + (rank[it.kind] || 0),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 80)
      .map((x) => x.it);
  }

  function renderList() {
    const list = palette.querySelector('.bdc-list');
    if (!shown.length) { list.innerHTML = '<div class="bdc-empty">Không có kết quả</div>'; return; }
    list.innerHTML = shown.map((it, i) => {
      const tag = it.site ? `<span class="bdc-site" style="background:${it.site.color}">${esc(it.site.name)}</span>` : '';
      return `<div class="bdc-item${i === active ? ' bdc-active' : ''}" data-i="${i}">
        <span class="bdc-kind">${KIND_LABEL[it.kind] || ''}</span>
        <span class="bdc-title">${tag}${esc(it.title)}</span>
        <span class="bdc-path">${it.url ? esc(safePath(it.url)) : ''}</span>
      </div>`;
    }).join('');
    const el = list.querySelector('.bdc-active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function runItem(it, newTab) {
    closePalette();
    if (!it) return;
    if (it.run) return it.run();
    if (newTab) window.open(it.url, '_blank');
    else location.href = it.url;
  }

  async function openPalette() {
    if (palette) return closePalette();
    await buildItems();
    palette = document.createElement('div');
    palette.id = 'bdc-palette';
    palette.className = 'bdc-ui';
    palette.innerHTML = `
      <div class="bdc-backdrop"></div>
      <div class="bdc-box">
        <div class="bdc-head" style="border-color:${SITE.color}">Đang ở: <b style="color:${SITE.color}">CMS ${esc(SITE.name)}</b> · ${esc(pageTitle())}</div>
        <input class="bdc-input" type="text" placeholder="Tìm trang, menu, lệnh… (không cần gõ dấu)" autocomplete="off" />
        <div class="bdc-list"></div>
        <div class="bdc-hint">↑↓ chọn · Enter mở · Ctrl+Enter tab mới · Esc đóng · Ctrl+S lưu form</div>
      </div>`;
    document.body.appendChild(palette);
    const input = palette.querySelector('.bdc-input');
    active = 0;
    shown = filterItems('');
    renderList();
    input.focus();

    input.addEventListener('input', () => { active = 0; shown = filterItems(input.value); renderList(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); renderList(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
      else if (e.key === 'Enter') { e.preventDefault(); runItem(shown[active], e.ctrlKey || e.metaKey); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
    palette.querySelector('.bdc-backdrop').addEventListener('click', closePalette);
    palette.querySelector('.bdc-list').addEventListener('click', (e) => {
      const row = e.target.closest('.bdc-item');
      if (row) runItem(shown[+row.dataset.i], e.ctrlKey || e.metaKey);
    });
  }

  function closePalette() {
    if (palette) { palette.remove(); palette = null; }
  }

  function setupPalette() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyK') { e.preventDefault(); openPalette(); }
    }, true);
    if (settings.floatingButton) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bdc-ui bdc-fab';
      btn.title = `CMS ${SITE.name} – Bảng lệnh quản trị (Alt+K)`;
      btn.textContent = '⚡';
      btn.style.background = SITE.color;
      btn.addEventListener('click', openPalette);
      document.body.appendChild(btn);
    }
  }

  // ---------------------------------------------------------------- công cụ bảng
  const TABLE_HOST = '.el-table, .ant-table-wrapper, .v-data-table, .MuiTableContainer-root, .dataTables_wrapper';
  const bars = new Set();

  function firstDataTable() {
    return [...document.querySelectorAll('table')].find((t) => !isOurUI(t) && visible(t) && t.querySelectorAll('tbody tr').length > 0);
  }

  function headerRowFor(t) {
    const own = t.querySelector('thead tr');
    if (own) return own;
    const host = t.closest(TABLE_HOST);
    return host ? host.querySelector('thead tr') : null;
  }

  const cellsOf = (tr) => [...tr.children]
    .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
    .map((c) => c.innerText.replace(/\s+/g, ' ').trim());

  function tableRows(t) {
    const out = [];
    const head = headerRowFor(t);
    if (head) out.push(cellsOf(head));
    t.querySelectorAll('tbody tr').forEach((tr) => { if (tr.style.display !== 'none') out.push(cellsOf(tr)); });
    return out;
  }

  function fileName(ext) {
    const slug = norm(pageTitle()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bang';
    const d = new Date();
    return `${SITE.id}-${slug}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
  }

  function exportCSV(t) {
    const rows = tableRows(t);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM để Excel đọc đúng tiếng Việt
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName('csv');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(`Đã xuất ${Math.max(rows.length - 1, 0)} dòng ra CSV`);
  }

  async function copyTable(t) {
    const tsv = tableRows(t).map((r) => r.join('\t')).join('\n');
    try { await navigator.clipboard.writeText(tsv); toast('Đã sao chép bảng (dán thẳng vào Excel/Sheets)'); }
    catch (e) { toast('Không sao chép được – trình duyệt chặn clipboard'); }
  }

  function applyFilter(bar) {
    const t = bar.__table;
    const tokens = norm(bar.querySelector('input').value).split(' ').filter(Boolean);
    const rows = [...t.querySelectorAll('tbody tr')];
    let shownRows = 0;
    rows.forEach((tr) => {
      const ok = !tokens.length || tokens.every((tk) => norm(tr.innerText).includes(tk));
      const want = ok ? '' : 'none';
      if (tr.style.display !== want) tr.style.display = want;
      if (ok) shownRows++;
    });
    const label = tokens.length ? `${shownRows}/${rows.length} dòng` : `${rows.length} dòng`;
    const span = bar.querySelector('.bdc-count');
    if (span.textContent !== label) span.textContent = label; // tránh vòng lặp MutationObserver
  }

  function enhanceTables() {
    bars.forEach((bar) => {
      if (!bar.__table.isConnected) { bar.remove(); bars.delete(bar); } else applyFilter(bar);
    });
    document.querySelectorAll('table').forEach((t) => {
      if (t.__bdcBar || isOurUI(t) || fixedAncestor(t)) return; // bỏ qua bảng trong popup
      if (t.querySelectorAll('tbody tr').length < 1) return;
      const host = t.closest(TABLE_HOST) || t;
      if (host.__bdcBar) return;

      const bar = document.createElement('div');
      bar.className = 'bdc-ui bdc-table-bar';
      bar.innerHTML = `
        <input type="text" placeholder="🔍 Lọc nhanh trong bảng (không cần dấu)…" autocomplete="off" />
        <span class="bdc-count"></span>
        <button type="button" data-a="copy">Sao chép</button>
        <button type="button" data-a="csv">Xuất CSV</button>`;
      bar.__table = t;
      t.__bdcBar = host.__bdcBar = bar;
      host.parentNode.insertBefore(bar, host);
      bars.add(bar);

      bar.querySelector('input').addEventListener('input', () => applyFilter(bar));
      bar.addEventListener('click', (e) => {
        const a = e.target.dataset && e.target.dataset.a;
        if (a === 'csv') exportCSV(t);
        if (a === 'copy') copyTable(t);
      });
      applyFilter(bar);
    });
  }

  // ---------------------------------------------------------------- tiền tố tiêu đề tab
  function applyTabPrefix() {
    if (!settings.tabPrefix) return;
    const p = `[${SITE.name}] `;
    if (!document.title.startsWith(p)) document.title = p + document.title;
  }

  // ---------------------------------------------------------------- SPA routing
  function watchRoute() {
    let last = location.href;
    setInterval(() => {
      applyTabPrefix();
      if (location.href === last) return;
      last = location.href;
      closePalette();
      setTimeout(trackRecent, 800);
    }, 700);
  }

  // ---------------------------------------------------------------- tin nhắn từ popup/background
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'open-palette') openPalette();
    if (msg.type === 'pin-page') pinCurrent();
    if (msg.type === 'export-table') { const t = firstDataTable(); if (t) exportCSV(t); else toast('Không tìm thấy bảng dữ liệu'); }
    if (msg.type === 'page-info') sendResponse({ url: location.href, title: pageTitle(), site: SITE.id });
  });

  // ---------------------------------------------------------------- khởi động
  (async () => {
    settings = await BDC.loadSettings();
    if (settings.palette) setupPalette();
    if (settings.tableTools) {
      enhanceTables();
      new MutationObserver(debounce(enhanceTables, 400)).observe(document.body, { childList: true, subtree: true });
    }
    applyTabPrefix();
    setTimeout(trackRecent, 800);
    watchRoute();
  })();
})();
