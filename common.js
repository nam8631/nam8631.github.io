/* Tiện ích dùng chung cho content script + popup */
/* global chrome */
// eslint-disable-next-line no-unused-vars
var BDC = (() => {
  const DEFAULTS = {
    palette: true, floatingButton: true, tableTools: true, formDraft: true, recent: true,
    tabPrefix: true, smartFields: true, smartSelect: true, ctrlS: true,
  };

  const store = {
    get: (k) => new Promise((r) => chrome.storage.local.get(k, r)),
    set: (o) => new Promise((r) => chrome.storage.local.set(o, r)),
  };

  // Bỏ dấu tiếng Việt + chữ thường -> tìm kiếm không cần gõ dấu
  const norm = (s) =>
    (s || '').toString().replace(/đ/gi, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  const esc = (s) =>
    (s || '').toString().replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const isOurUI = (el) => !!(el && el.closest && el.closest('.bdc-ui'));
  const isAuthPage = () => /\/(auth|login|signin|sign-in|dang-nhap)(\/|$)/i.test(location.pathname);
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  // "Biến tần Áp Thấp 3 pha" -> "bien-tan-ap-thap-3-pha"
  function slugify(s, keepSlash) {
    let r = norm(s).replace(keepSlash ? /[^a-z0-9/]+/g : /[^a-z0-9]+/g, '-');
    if (keepSlash) r = r.replace(/-*\/-*/g, '/').replace(/\/{2,}/g, '/');
    return r.replace(/-{2,}/g, '-').replace(/^[-/]+|[-/]+$/g, '');
  }

  // Cắt chuỗi tại ranh giới từ, tối đa n ký tự
  function cut(s, n) {
    s = (s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    const c = s.slice(0, n - 1);
    const i = c.lastIndexOf(' ');
    return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s,.;:–-]+$/, '') + '…';
  }

  function safePath(u) {
    try { const x = new URL(u); return decodeURI(x.pathname + x.search); } catch (e) { return u; }
  }

  function pageTitle() {
    const h = document.querySelector('h1, .page-title, [class*="page-title"], [class*="PageTitle"], .breadcrumb li:last-child, .ant-breadcrumb > span:last-child');
    const t = (h && h.innerText.trim()) || document.title.replace(/^\[[^\]]+\]\s*/, '') || location.pathname;
    return t.replace(/\s+/g, ' ').slice(0, 120);
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'bdc-ui bdc-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('bdc-show'), 10);
    setTimeout(() => { el.classList.remove('bdc-show'); setTimeout(() => el.remove(), 300); }, 2200);
  }

  // Gán giá trị sao cho React/Vue nhận biết (gọi setter gốc + phát sự kiện)
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function flash(el) {
    try {
      el.animate([{ boxShadow: '0 0 0 3px rgba(16,185,129,.55)' }, { boxShadow: '0 0 0 0 rgba(16,185,129,0)' }], { duration: 1000 });
    } catch (e) { /* ignore */ }
  }

  function fixedAncestor(el) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(p).position === 'fixed') return p;
    }
    return null;
  }

  // Tìm nhãn hiển thị của 1 ô nhập (label, aria-label, hoặc chữ đứng ngay trước nó)
  function labelOf(el) {
    if (el.__bdcLabel) return el.__bdcLabel;
    let t = '';
    if (el.labels && el.labels.length) t = el.labels[0].innerText;
    if (!t) t = el.getAttribute('aria-label') || '';
    if (!t) {
      let node = el;
      outer: for (let d = 0; d < 4 && node && node !== document.body; d++, node = node.parentElement) {
        let sib = node.previousElementSibling;
        for (let k = 0; k < 2 && sib; k++, sib = sib.previousElementSibling) {
          if (isOurUI(sib)) { k--; continue; }
          if (sib.querySelector('input, select, textarea, [contenteditable]') || /^(INPUT|SELECT|TEXTAREA)$/.test(sib.tagName)) break outer;
          const tx = (sib.innerText || '').trim();
          if (tx && tx.length <= 80) { t = tx; break outer; }
        }
      }
    }
    if (!t) t = el.placeholder || el.name || '';
    t = t.replace(/\s+/g, ' ').replace(/\*/g, '').trim();
    if (t) el.__bdcLabel = t;
    return t;
  }

  async function loadSettings() {
    const { settings } = await store.get('settings');
    return { ...DEFAULTS, ...(settings || {}) };
  }

  return {
    DEFAULTS, store, norm, esc, debounce, pad, fmtTime, isOurUI, isAuthPage, visible, slugify, cut,
    safePath, pageTitle, toast, setNativeValue, flash, fixedAncestor, labelOf, loadSettings,
  };
})();
