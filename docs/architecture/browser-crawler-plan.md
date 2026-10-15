# Kế hoạch L6 — Crawler đọc trang bằng trình duyệt thật (mặc định)

> **Trạng thái:** chủ dự án **đã duyệt hướng đi** (2026-10-15): "đồng ý dùng trình duyệt thật làm mặc định".
> Decision Log: "2026-10-15 — Crawler reads pages with a real browser by default".

## 1. Vấn đề

Trang chương trình Stockholm University vẽ **học phí, ngày bắt đầu, tiêu chí xét tuyển** bằng
JavaScript, từ dữ liệu ẩn trong trang. Crawler hiện đọc HTML tĩnh và bỏ mọi `<script>`. Vì vậy văn
bản lưu lại chỉ có tiêu đề "Tuition fee" mà không có "67500 SEK"; cả AI lẫn màn hình ghép đều không
thấy.

## 2. Thiết kế

| Phần | Thay đổi |
|---|---|
| **Database** | `crawl_targets.render_js` (mặc định **bật**, áp cho cả URL đã có). `save_crawl_target()` và `crawler_due_targets()` thêm trường này |
| **Crawler** | Mỗi trang: (1) GET thường như cũ, để kiểm robots, chuyển hướng, kiểu nội dung, kích thước, và trả lời "chưa đổi" (304); (2) nếu `render_js` thì mở bằng **Chromium không giao diện**, chờ trang tải xong, lấy HTML đã vẽ, rồi trích chữ bằng **đúng bộ trích chữ hiện tại** |
| **Trình duyệt** | Không tải ảnh, video, phông chữ; không đi theo link; trang tự chuyển sang tên miền khác thì từ chối; giới hạn thời gian; user agent trung thực như hiện nay |
| **Lỗi** | Vẽ trang lỗi thì ghi lỗi cho URL đó (`render_timeout`, `render_failed`…), **không** lặng lẽ dùng văn bản tĩnh |
| **GitHub Actions** | Cài Chromium trước khi chạy (`playwright install --with-deps chromium`) |
| **Admin** | Ô "Đọc bằng trình duyệt thật (cho trang dùng JavaScript)" trên form URL, mặc định bật |
| **Sitemap** | Vẫn đọc không cần trình duyệt |

## 3. Thư viện mới

**Playwright** (`playwright`, Microsoft): điều khiển trình duyệt Chromium không giao diện, chạy
JavaScript của trang như người xem thật. Cần để lấy nội dung trang vẽ bằng JavaScript. Chỉ dùng
trong `crawler/`, không có trong ứng dụng web. AGENTS.md §3 đã liệt kê sẵn công cụ này cho crawler.

## 4. Kiểm thử

- Crawler (trình duyệt giả trong test):
  - URL bật trình duyệt thì văn bản lấy từ trình duyệt;
  - URL tắt thì từ HTML tĩnh;
  - 304 thì không mở trình duyệt;
  - trình duyệt lỗi thì ghi lỗi, không lưu văn bản tĩnh.
- Database (PGlite): mặc định bật; lưu và đọc `render_js`; audit ghi trường mới.
- Admin: form có ô mới, mặc định bật.

## 5. Chưa làm

- Bấm mở phần thu gọn, cuộn để tải thêm.
- Chạy song song nhiều trang.
- Chụp ảnh màn hình trang.

Sẽ làm khi gặp trang thật cần đến.
