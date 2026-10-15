# L6 — Crawler đọc trang bằng trình duyệt thật (2026-10-15)

> Kế hoạch: `docs/architecture/browser-crawler-plan.md`.
> Decision Log: "2026-10-15 — Crawler reads pages with a real browser by default". Linear: KHLOE-158.

## Đã làm gì

- Migration `20261015090000_crawler_browser`:
  - cột `crawl_targets.render_js`, mặc định **bật**, kể cả cho URL cũ;
  - `save_crawl_target()` nhận thêm `p_render_js`;
  - `crawler_due_targets()` trả thêm `render_js`.
- Crawler:
  - `src/render.ts`: điều khiển Chromium không giao diện bằng Playwright;
  - `src/crawl.ts`: GET thường trước, rồi vẽ trang bằng trình duyệt nếu URL bật `render_js`.
- Workflow `crawler.yml`: cài Chromium (`npx playwright install --with-deps chromium`).
- Admin `/admin/crawler`: ô "Đọc bằng trình duyệt thật (mặc định)"; URL tắt ô này có nhãn "Chỉ HTML".

## Vì sao

Trang chương trình Stockholm University để học phí, tiêu chí xét tuyển trong dữ liệu ẩn, rồi
JavaScript mới vẽ ra chữ. Crawler cũ bỏ mọi `<script>`, nên văn bản lưu chỉ có tiêu đề
"Tuition fee", không có số tiền. Thử thật ngày 15/10: trình duyệt mất **4,4 giây** cho trang SU và
lấy được *"First instalment: 67500 SEK. The complete course: 135000 SEK."*

**Bài học:** spec ban đầu ghi "Playwright chỉ khi cần". Slice 9 chỉ thử với trang của cơ quan nhà
nước, không thử trang chương trình của trường đại học. Trước khi chốt cách lấy dữ liệu, hãy thử
với **một trang đại diện cho loại dữ liệu quan trọng nhất**.

## Luồng cho mỗi trang

```
crawlee: kiểm robots.txt, chờ giãn cách theo tên miền, thử lại khi lỗi tạm thời
  └─ fetchLimited(): GET thường — kiểu nội dung, kích thước, chuyển hướng sang tên miền khác
       ├─ render_js = false → dùng HTML vừa tải (có hỏi "trang đổi chưa?" bằng ETag)
       └─ render_js = true  → KHÔNG hỏi ETag (trang có thể giữ khung HTML mà đổi dữ liệu)
             └─ Chromium: mở trang, chờ "networkidle", lấy HTML đã vẽ
                  ├─ lỗi / quá giờ / sang tên miền khác → ghi lỗi cho URL, KHÔNG dùng văn bản tĩnh
                  └─ ok → extractPage() như cũ → mã băm → crawler_record()
```

## Thư viện mới: Playwright

- **Là gì:** thư viện của Microsoft điều khiển trình duyệt (ở đây là Chromium không giao diện).
- **Vì sao cần:** để chạy JavaScript của trang như người xem thật, lấy được nội dung vẽ bằng JavaScript.
- **Dùng ở đâu:** chỉ trong `crawler/src/render.ts`, được nạp lười (`await import("playwright")`)
  nên lần chạy không cần trình duyệt sẽ không tải nó. Trình duyệt (khoảng 100 MB) được cài trên máy
  GitHub Actions mỗi lần chạy, không nằm trong repo.

## Khái niệm cần biết

- **`waitUntil: "networkidle"`:** chờ tới khi trang không còn gọi mạng khoảng 500 ms, tức trang đã
  tải xong dữ liệu của nó.
- **`context.route`:** chặn tải ảnh, video, phông chữ (không cần để đọc chữ, và nhẹ cho máy chủ của trường).
- **Một trình duyệt cho cả lần chạy:** mở khi trang đầu tiên cần, đóng ở cuối kể cả khi lỗi, nên
  không để sót tiến trình Chromium.
- **Test không cần trình duyệt thật:** `runCrawl` nhận `startRenderer`, test truyền một trình duyệt giả.

## Giữ nguyên (AGENTS.md §6)

- Chỉ URL đã đăng ký của nguồn đã duyệt.
- robots.txt kiểm trước, một trang mỗi lần, giãn cách theo tên miền.
- User agent trung thực.
- Không đăng nhập, không vượt CAPTCHA, không đi theo link.
- Câu trích vẫn là chữ người xem thấy, nên mọi luật chống bịa không đổi.
- Sitemap vẫn đọc không cần trình duyệt.

## Lỗi thường gặp

- `render_timeout`: trang quá 45 giây vẫn còn gọi mạng (ví dụ trang có chat trực tuyến liên tục).
  Thử lại lần sau; nếu lặp lại, bỏ chọn ô trình duyệt cho URL đó, chấp nhận chỉ có HTML tĩnh.
- `off_origin`: trang tự chuyển sang tên miền khác, nên bị từ chối như với GET thường.
- Chạy trên máy cá nhân mà chưa cài trình duyệt: chạy `npx playwright install chromium` trong `crawler/`.

## Cách kiểm tra

- `npm test -w @nordic/crawler` (trình duyệt giả) và `npx vitest run lib/crawler "app/(app)/admin/crawler"` (apps/web).
- Thật: sau khi chạy migration và push, chạy **Actions → crawler → Run workflow**. Trang SU sẽ có
  phiên bản mới chứa học phí; các thông tin đã duyệt từ bản cũ vào hàng chờ "Nguồn đã đổi".

## Thứ tự đọc code

`crawler/src/render.ts` → `crawler/src/crawl.ts` (phần trang) → `crawler/src/crawl.test.ts` (4 test cuối) → migration.
