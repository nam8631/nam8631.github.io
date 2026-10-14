// Danh sách CMS được hỗ trợ. Muốn thêm site mới: thêm 1 dòng ở đây
// + thêm domain vào "host_permissions" và "content_scripts.matches" trong manifest.json.
// eslint-disable-next-line no-unused-vars
var BDC_SITES = [
  { id: 'bdc', name: 'Biển Đông', origin: 'https://cms.biendongco.com.vn', home: 'https://cms.biendongco.com.vn/', color: '#1d4ed8' },
  { id: 'ttech', name: 'T-Tech', origin: 'https://cms.ttech.com.vn', home: 'https://cms.ttech.com.vn/cms', color: '#dc2626' },
];

// eslint-disable-next-line no-unused-vars
function bdcSiteOf(url) {
  try {
    const o = new URL(url).origin;
    return BDC_SITES.find((s) => s.origin === o) || null;
  } catch (e) {
    return null;
  }
}
