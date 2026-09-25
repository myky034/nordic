# Slice 7 — Tìm kiếm và so sánh quốc gia

## Đã xây dựng

- **Tìm kiếm** `/search`: tìm trên 8 loại dữ liệu (quốc gia, chương trình, trường,
  quy định nhập cư, nghề, fact, nguồn, tài liệu). Kết quả chia nhóm; có nút tìm
  kiếm trên header.
- **So sánh** `/compare`: chọn 2–5 quốc gia, xem song song bốn phần: chỉ số, quy
  định nhập cư, số liệu của một nghề, và số mục giáo dục đã duyệt.
- **Chỉ số so sánh** `/admin/metrics`: quản trị viên định nghĩa các chỉ số. Mỗi
  fact có thể gắn một chỉ số (form ở Thông tin & bằng chứng).

## Vì sao thiết kế như vậy

### Tìm kiếm
- **Full-text search của PostgreSQL** là đủ cho quy mô hiện tại; spec cấm thêm
  Elasticsearch khi chưa có nhu cầu đo được.
- **Cấu hình `simple`**: nội dung có nhiều ngôn ngữ; stemmer tiếng Anh sẽ cắt sai
  tên riêng tiếng Thụy Điển hay Đan Mạch.
- **Bỏ dấu bằng hàm tự viết `search_fold`** thay vì extension `unaccent`: project
  chưa cài extension đó, và database test (PGlite) cũng không có. Một hàm SQL
  thuần chạy giống hệt nhau ở cả hai nơi.
- **Cột generated + index GIN**: vector tìm kiếm tự cập nhật theo dữ liệu, không
  bao giờ lệch.
- **Client ẩn danh** (`lib/supabase/public.ts`): kết quả tìm kiếm luôn là bản công
  khai, kể cả khi biên tập viên đang đăng nhập. Quy tắc hiển thị nằm trong RLS của
  database, không bị viết lặp lại ở UI.

### So sánh
- Fact là dạng tự do, nên hai fact "chi phí sống" của hai nước không có khóa chung
  để xếp cùng hàng. **Chỉ số so sánh** là khóa đó: "fact này là giá trị của chỉ
  số X cho quốc gia Y".
- **Chỉ số chỉ là định nghĩa, không seed sẵn**: mỗi định nghĩa là quyết định của
  người.
- **Không đổi được key và nhóm** sau khi tạo, vì nếu đổi thì các giá trị đã gắn sẽ
  bị đổi nghĩa mà không ai biết.
- **Mỗi ô hiện mọi giá trị**, mỗi giá trị kèm nguồn, tier, kỳ số liệu và ngày. Hệ
  thống không tính trung bình, không chọn giá trị, không chấm điểm (AGENTS.md
  1.4 và 15).

## File nên đọc theo thứ tự

1. `docs/architecture/slice-07-search-comparison.md`
2. `packages/db/prisma/migrations/20260926090000_search/migration.sql`
3. `packages/db/prisma/migrations/20260926100000_comparison_metrics/migration.sql`
4. `apps/web/lib/supabase/public.ts` — client ẩn danh.
5. `apps/web/lib/search/domain.ts` — nhóm kết quả, link.
6. `apps/web/lib/compare/domain.ts` — đọc tham số quốc gia, `buildCells`.
7. `apps/web/app/(public)/(explore)/search/page.tsx`, `compare/page.tsx`
8. `apps/web/app/(app)/admin/metrics/*`
9. Test: `lib/compare/database.test.ts` (search + metrics trên PGlite, chạy tất cả
   migration theo thứ tự), `lib/search/domain.test.ts`, `lib/compare/domain.test.ts`,
   test của trang search và compare.

## Khái niệm kỹ thuật

- **`tsvector` / `tsquery`**: văn bản được tách thành từ và chuẩn hóa;
  `websearch_to_tsquery` hiểu cú pháp giống Google (dấu ngoặc kép cho cụm từ
  chính xác, dấu `-` để loại trừ) và không bao giờ báo lỗi cú pháp.
- **`SECURITY INVOKER` và `SECURITY DEFINER`**: hàm search chạy với quyền của người
  gọi, nên RLS được áp dụng. Ngược lại, các RPC ghi dữ liệu là DEFINER và tự kiểm
  tra quyền.
- **Window function** `row_number() OVER (PARTITION BY type)`: lấy top N cho từng
  nhóm trong một truy vấn duy nhất.
- **Bảng rộng trên mobile**: bảng nằm trong container `overflow-x-auto`, cột đầu
  `sticky left-0` để luôn biết đang xem hàng nào.
- **Checkbox dạng "pill"**: dùng Tailwind `has-[:checked]:` để đổi màu nhãn theo
  trạng thái checkbox, không cần JavaScript; `has-[:focus-visible]:` giữ vòng focus
  cho người dùng bàn phím.

## Cách dùng (luồng cho quản trị viên)

1. `/admin/metrics` → tạo chỉ số, ví dụ key `living_cost_student_month`, nhóm
   *Living cost*, định nghĩa "Chi phí sống hằng tháng của một sinh viên độc thân
   theo nguồn, không gồm học phí", đơn vị gợi ý `SEK/tháng`.
2. `/facts/workspace` → đề xuất fact, chọn chỉ số đó, quốc gia, kỳ số liệu, đơn vị;
   trích đoạn từ nguồn → duyệt.
3. `/compare?c=sweden&c=denmark` → giá trị hiện ở ô tương ứng.

## Lỗi thường gặp

- **Tìm "stock" không ra "Stockholm"**: full-text search khớp nguyên từ. Dùng ô
  tìm trong từng danh sách (khớp chuỗi con) nếu cần tìm theo tiền tố.
- **Muốn đổi key của chỉ số**: không được. Hãy tạo chỉ số mới và bỏ chọn "Đang dùng"
  ở chỉ số cũ.
- **Gắn chỉ số mà không chọn quốc gia**: bị từ chối.
- **So sánh hai giá trị khác kỳ hoặc khác đơn vị**: hệ thống không quy đổi; đọc kỹ
  badge kỳ số liệu và đơn vị.

## Kiểm thử

Tự động (đã chạy, pass): `npm test` (190 pass, 4 live skip), lint, tsc, build.

Browser (sau khi `npm run db:migrate:deploy`):

1. `/search?q=malmo` và `/search?q=sweden` → có kết quả chia nhóm. Bản nháp không
   xuất hiện, kể cả khi đăng nhập bằng tài khoản editor.
2. `/compare?c=sweden` → trang yêu cầu chọn ít nhất 2 quốc gia.
   `/compare?c=sweden&c=denmark` → hiện đủ 4 phần.
3. Tạo chỉ số, gắn một fact, duyệt → giá trị hiện trong ô. Thử đổi key ở form sửa
   → ô bị khóa.
