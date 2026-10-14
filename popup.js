/* global BDC, BDC_SITES, bdcSiteOf */
const { DEFAULTS } = BDC;

const $ = (s) => document.querySelector(s);
const store = {
  get: (k) => new Promise((r) => chrome.storage.local.get(k, r)),
  set: (o) => new Promise((r) => chrome.storage.local.set(o, r)),
};
const esc = (s) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pathOf = (u) => { try { const x = new URL(u); return decodeURI(x.pathname + x.search); } catch { return u; } };
const badge = (url) => {
  const s = bdcSiteOf(url);
  return s ? `<i class="site" style="background:${s.color}">${esc(s.name)}</i>` : '';
};

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}
const onCms = (t) => !!(t && t.url && bdcSiteOf(t.url));
const say = (m) => { $('#msg').textContent = m; };

async function openUrl(url, newTab) {
  const t = await activeTab();
  // Cùng CMS với tab đang mở -> mở ngay trong tab; khác CMS -> tab mới (giữ nguyên phiên làm việc)
  const sameSite = t && t.url && bdcSiteOf(t.url) && bdcSiteOf(t.url) === bdcSiteOf(url);
  if (!newTab && sameSite) chrome.tabs.update(t.id, { url });
  else chrome.tabs.create({ url });
  window.close();
}

async function sendToPage(type) {
  const t = await activeTab();
  if (!onCms(t)) { say('Hãy mở một trang của CMS trước.'); return null; }
  try {
    return await chrome.tabs.sendMessage(t.id, { type });
  } catch {
    say('Chưa kết nối được trang – hãy tải lại (F5) trang CMS.');
    return null;
  }
}

// ---------------------------------------------------------------- sites
async function renderSites() {
  const t = await activeTab();
  const cur = t && t.url ? bdcSiteOf(t.url) : null;
  $('#current').innerHTML = cur ? `Đang ở: ${badge(t.url)}` : 'Không ở trang CMS';
  $('#sites').innerHTML = BDC_SITES.map((s) => `
    <button data-id="${s.id}" style="border-color:${s.color};color:${s.color}" title="${esc(s.home)}">
      Mở CMS ${esc(s.name)} ↗
    </button>`).join('');
  $('#sites').onclick = async (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const s = BDC_SITES.find((x) => x.id === b.dataset.id);
    // Nếu đã có tab của CMS này thì chuyển sang tab đó thay vì mở tab mới
    const tabs = await chrome.tabs.query({ url: s.origin + '/*' });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: s.home });
    }
    window.close();
  };
  const sel = $('#pinFilter');
  BDC_SITES.forEach((s) => sel.insertAdjacentHTML('beforeend', `<option value="${s.id}">${esc(s.name)}</option>`));
  if (cur) sel.value = cur.id; // mặc định chỉ hiện ghim của CMS đang mở
}

// ---------------------------------------------------------------- pins
async function renderPins() {
  const { pins = [] } = await store.get('pins');
  const filter = $('#pinFilter').value;
  const ul = $('#pins');
  const list = pins.map((p, i) => ({ ...p, i })).filter((p) => !filter || (bdcSiteOf(p.url) || {}).id === filter);
  if (!list.length) {
    ul.innerHTML = '<li class="empty">Chưa có trang nào. Bấm "Ghim trang này" hoặc Alt+Shift+P.</li>';
    return;
  }
  ul.innerHTML = list.map((p) => `
    <li data-i="${p.i}">
      <div class="t" data-a="open"><b>${badge(p.url)}${esc(p.title)}</b><span>${esc(pathOf(p.url))}</span></div>
      <button data-a="up" title="Lên trên">↑</button>
      <button data-a="edit" title="Đổi tên">✎</button>
      <button data-a="del" title="Bỏ ghim">✕</button>
    </li>`).join('');
}
$('#pinFilter').addEventListener('change', renderPins);

$('#pins').addEventListener('click', async (e) => {
  const li = e.target.closest('li[data-i]');
  const actionEl = e.target.closest('[data-a]');
  if (!li || !actionEl) return;
  const i = +li.dataset.i;
  const { pins = [] } = await store.get('pins');
  const a = actionEl.dataset.a;
  if (a === 'open') {
    if (li.querySelector('[contenteditable="true"]')) return;
    return openUrl(pins[i].url, e.ctrlKey || e.metaKey);
  }
  if (a === 'del') pins.splice(i, 1);
  if (a === 'up') {
    // đổi chỗ với ghim liền trên đang hiển thị (cùng bộ lọc)
    const visible = [...$('#pins').querySelectorAll('li[data-i]')].map((x) => +x.dataset.i);
    const pos = visible.indexOf(i);
    if (pos > 0) { const j = visible[pos - 1]; [pins[j], pins[i]] = [pins[i], pins[j]]; }
  }
  if (a === 'edit') {
    const b = li.querySelector('b');
    b.textContent = pins[i].title; // bỏ nhãn site khi sửa
    b.contentEditable = 'true';
    b.focus();
    document.getSelection().selectAllChildren(b);
    const done = async () => {
      b.contentEditable = 'false';
      const name = b.innerText.trim();
      if (name) { pins[i].title = name; await store.set({ pins }); }
      renderPins();
    };
    b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); b.blur(); } });
    b.addEventListener('blur', done, { once: true });
    return;
  }
  await store.set({ pins });
  renderPins();
});

$('#exportPins').addEventListener('click', async () => {
  const { pins = [] } = await store.get('pins');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(pins, null, 2)], { type: 'application/json' }));
  a.download = 'cms-ghim.json';
  a.click();
});

$('#importPins').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error();
    const { pins = [] } = await store.get('pins');
    const urls = new Set(pins.map((p) => p.url));
    let added = 0;
    incoming.forEach((p) => {
      if (p && typeof p.url === 'string' && bdcSiteOf(p.url) && !urls.has(p.url)) {
        pins.push({ url: p.url, title: String(p.title || pathOf(p.url)) });
        urls.add(p.url);
        added++;
      }
    });
    await store.set({ pins });
    renderPins();
    say(`Đã nhập thêm ${added} ghim.`);
  } catch {
    say('File không hợp lệ.');
  }
});

// ---------------------------------------------------------------- recent
async function renderRecent() {
  const { recent = [] } = await store.get('recent');
  const ul = $('#recent');
  if (!recent.length) { ul.innerHTML = '<li class="empty">Chưa có.</li>'; return; }
  ul.innerHTML = recent.slice(0, 12).map((r, i) => `
    <li data-i="${i}"><div class="t"><b>${badge(r.url)}${esc(r.title)}</b><span>${esc(pathOf(r.url))}</span></div></li>`).join('');
  ul.onclick = (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) openUrl(recent[+li.dataset.i].url, e.ctrlKey || e.metaKey);
  };
}
$('#clearRecent').addEventListener('click', async () => { await store.set({ recent: [] }); renderRecent(); });

// ---------------------------------------------------------------- settings
async function renderSettings() {
  const { settings = {} } = await store.get('settings');
  const s = { ...DEFAULTS, ...settings };
  document.querySelectorAll('[data-s]').forEach((cb) => {
    cb.checked = !!s[cb.dataset.s];
    cb.onchange = async () => {
      s[cb.dataset.s] = cb.checked;
      await store.set({ settings: s });
      say('Đã lưu – tải lại trang CMS để áp dụng.');
    };
  });
}

// ---------------------------------------------------------------- actions
$('#palette').addEventListener('click', async () => {
  const t = await activeTab();
  if (!onCms(t)) return say('Hãy mở một trang CMS rồi bấm lại (hoặc dùng nút "Mở CMS" phía trên).');
  try { await chrome.tabs.sendMessage(t.id, { type: 'open-palette' }); window.close(); }
  catch { say('Chưa kết nối được trang – hãy tải lại (F5) trang CMS.'); }
});
$('#pin').addEventListener('click', async () => {
  const info = await sendToPage('page-info');
  if (!info) return;
  const { pins = [] } = await store.get('pins');
  if (pins.some((p) => p.url === info.url)) return say('Trang này đã được ghim.');
  pins.push({ url: info.url, title: info.title });
  await store.set({ pins });
  renderPins();
  say('Đã ghim.');
});
$('#exportTable').addEventListener('click', () => sendToPage('export-table'));

(async () => {
  await renderSites();
  renderPins();
  renderRecent();
  renderSettings();
})();
