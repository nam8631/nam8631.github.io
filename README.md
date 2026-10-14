# CMS Admin – Trợ lý quản trị (Chrome / Edge / Cốc Cốc)

Dùng cho **2 CMS**:
- 🟦 **Biển Đông**: https://cms.biendongco.com.vn
- 🟥 **T-Tech**: https://cms.ttech.com.vn/cms

Extension **không lưu mật khẩu** và không gửi dữ liệu ra ngoài. Dữ liệu chỉ lưu ở `chrome.storage.local` trên máy bạn.

## Cài đặt
1. Tải file zip và **giải nén**.
2. Mở `chrome://extensions` → bật **Developer mode** (Chế độ dành cho nhà phát triển).
3. Bấm **Load unpacked** (Tải tiện ích đã giải nén) → chọn thư mục vừa giải nén (thư mục có `manifest.json`).
4. Bấm 🧩 trên thanh công cụ → ghim icon ⚡. Đăng nhập CMS như bình thường.

**Cập nhật bản mới:** giải nén đè lên thư mục cũ → vào `chrome://extensions` → bấm ↻ ở extension.

## Tính năng
### Soạn bài viết / sản phẩm
| | |
|---|---|
| **Tự tạo Slug** | Gõ *Tiêu đề* / *Tên* thì Slug tự điền, đã bỏ dấu (`Biến tần Áp Thấp` → `bien-tan-ap-thap`). Nếu bạn sửa Slug bằng tay, extension sẽ không ghi đè nữa. Khi rời ô, Slug có dấu hoặc khoảng trắng được tự chuẩn hoá. |
| **Tự điền SEO** | *SEO title* lấy từ Tiêu đề. *Meta description* lấy từ Tóm tắt / Mô tả ngắn, tự cắt ≤160 ký tự. Chỉ điền khi ô đang trống, nên không ghi đè dữ liệu của bài/sản phẩm cũ. |
| **Đếm ký tự SEO** | Bấm vào ô SEO title (60) hoặc Meta description (160) sẽ hiện bộ đếm, chuyển đỏ khi quá dài. |
| **Danh mục có tìm kiếm** | Bấm vào ô chọn dài (Danh mục, Thương hiệu…) sẽ hiện ô tìm. Gõ không dấu (`ac quy`, `bien tan trung`), rồi bấm Enter để chọn. |
| **Ctrl+S** | Bấm nút **Lưu** của popup đang mở. Không cần kéo xuống cuối form. |
| **Tự lưu nháp** | Lỡ đóng popup, F5 hoặc bị đăng xuất: mở lại popup sẽ hiện *Khôi phục*. Nháp gồm cả nội dung trình soạn thảo. Nháp tự xoá khi bấm Lưu, hoặc sau 3 ngày. |

### Điều hướng
| | |
|---|---|
| **Bảng lệnh `Alt+K`** | Hoặc bấm nút ⚡ góc phải dưới. Gõ không dấu: `bao gia`, `san pham`, `them`… để tìm menu, trang ghim, trang gần đây của **cả 2 CMS**, và các nút trên trang (*+ Thêm sản phẩm*). Có cả lệnh chọn site, ví dụ *TTECH Commerce*. |
| **Chuyển CMS** | Trong popup có nút *Mở CMS Biển Đông / T-Tech*. Nếu đã có tab CMS đó thì chuyển sang tab đó. |
| **Phân biệt 2 CMS** | Tiêu đề tab có `[Biển Đông]` / `[T-Tech]`. Mỗi CMS có màu riêng. |
| **Ghim trang** | `Alt+Shift+P`. Đổi tên, sắp xếp, lọc theo CMS. Xuất/nhập JSON để chia sẻ cho đồng nghiệp. |

### Bảng dữ liệu
Mỗi bảng có ô **lọc nhanh không dấu**, nút **Xuất CSV** (Excel đọc đúng tiếng Việt) và **Sao chép** (dán thẳng vào Excel/Sheets).

Bật/tắt từng tính năng trong popup → **Cài đặt**. Đổi phím tắt tại `chrome://extensions/shortcuts`.

## Lưu ý
- Menu của CMS kia chỉ tìm được trong bảng lệnh sau khi bạn đã mở CMS đó ít nhất 1 lần.
- Lọc và xuất CSV chỉ xử lý các dòng đang hiển thị (bảng phân trang thì tăng số dòng/trang trước).
- Khi con trỏ đang ở **trong** trình soạn thảo nội dung, Ctrl+S có thể không hoạt động (tuỳ loại trình soạn thảo). Bấm ra ngoài một ô khác rồi Ctrl+S.

## Thêm CMS khác
1. `sites.js`: thêm 1 dòng `{ id, name, origin, home, color }`.
2. `manifest.json`: thêm domain vào `host_permissions` và `content_scripts.matches`.
3. `chrome://extensions` → ↻.
