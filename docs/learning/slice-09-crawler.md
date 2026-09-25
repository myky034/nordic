# Slice 9 — Crawler, crawl tăng dần và phát hiện thay đổi

## Đã xây dựng

- Package `crawler/`: worker Node/TypeScript chạy ngoài Next.js, lấy các URL đã
  đăng ký, trích text, hash, ghi vào DB qua 5 hàm SQL.
- Migration `20260928090000_crawler`: bảng `crawl_targets`, `crawl_url_states`,
  `crawler_runs`, `crawler_run_items`, `document_texts`; cột
  `facts.source_changed_at`; quyền `crawler.manage`; role `nordic_crawler_ops`.
- Trang `/admin/crawler`: đăng ký/sửa URL, xem vì sao nguồn chưa được crawl,
  kết quả từng URL, 10 lần chạy gần nhất.
- Hàng chờ **Nguồn đã đổi** trong `/facts/workspace` + cảnh báo trên thẻ thông tin.
- Mục **Văn bản trích (nội bộ)** trên trang tài liệu, chỉ biên tập viên thấy.
- Workflow GitHub Actions chạy hằng tuần hoặc chạy tay.

## Vì sao thiết kế như vậy

- **Chỉ URL đăng ký**: AGENTS.md 6 cấm crawl domain tùy ý. Không đi theo link
  nên phạm vi luôn là thứ con người đã chọn. DB kiểm tra lại từng URL, nên kể
  cả khi code worker sai, URL lạ vẫn bị từ chối.
- **Role Postgres riêng thay service-role key**: service-role key bỏ qua RLS và
  đọc được mọi thứ, kể cả workspace cá nhân. Role `nordic_crawler_ops` không có
  quyền trên bảng nào, chỉ gọi được 5 hàm. Lộ mật khẩu thì thiệt hại nhỏ.
- **Hash theo text, không theo byte**: trang web chèn token/thời gian thay đổi
  mỗi lần tải; hash byte sẽ tạo phiên bản mới và gắn cờ fact liên tục.
- **Lưu text riêng tư**: cần để so sánh và cho Slice 10, nhưng công khai toàn
  văn là tái xuất bản nội dung người khác (AGENTS.md 8).
- **Không tự quyết khi nguồn đổi**: trang đổi không có nghĩa là thông tin sai.
  Fact vẫn hiện nhưng có cảnh báo; người duyệt đối chiếu rồi quyết.

## Luồng hoạt động

1. Admin bật crawl cho nguồn (Source Registry) và đăng ký URL ở `/admin/crawler`.
2. Workflow chạy `npm run crawl -w @nordic/crawler` với `CRAWLER_DATABASE_URL`.
3. `crawler_start_run` → `crawler_due_targets` → `crawler_url_states`.
4. Sitemap trước: lấy danh sách URL cùng origin + tiền tố, tối đa `max_urls`.
5. Từng trang: kiểm tra robots.txt → fetch có điều kiện (ETag/Last-Modified) →
   304 thì ghi `not_modified` → không thì trích text, hash.
6. `crawler_record`: hash trùng → `unchanged`; hash mới → tạo document +
   `document_texts`, gắn cờ fact có bằng chứng là phiên bản cũ của URL đó.
7. `crawler_finish_run` lưu số lượng theo kết quả; có lỗi thì trạng thái `partial`.
8. Biên tập viên mở tab **Nguồn đã đổi**, xem phiên bản mới, chọn "Vẫn khớp"
   (`revalidated`) hoặc "Không còn đúng" (`rejected`).

## File nên đọc theo thứ tự

1. `packages/db/prisma/migrations/20260928090000_crawler/migration.sql`
2. `packages/db/src/document-hash.ts`
3. `crawler/src/config.ts`, `urls.ts`, `fetch.ts`, `extract.ts`, `sitemap.ts`
4. `crawler/src/db.ts`, `crawl.ts`, `main.ts`
5. `apps/web/lib/crawler/domain.ts`, `app/(app)/admin/crawler/*`
6. `apps/web/lib/facts/view.tsx` (cảnh báo), `app/(app)/facts/workspace/*` (hàng chờ)
7. `app/(public)/(explore)/documents/[id]/internal-text.tsx`
8. `.github/workflows/crawler.yml`

## Khái niệm kỹ thuật

- **Postgres role membership**: `IN ROLE nordic_crawler_ops` cho login role
  thừa hưởng quyền EXECUTE. Role nhóm là `NOINHERIT`/`NOLOGIN` nên không tự đăng nhập được.
- **SECURITY DEFINER + `search_path=''`**: hàm chạy bằng quyền của owner nhưng
  mọi tên bảng phải viết đầy đủ `public.x`, tránh bị chiếm quyền qua search_path.
- **Conditional request**: gửi `If-None-Match`/`If-Modified-Since`; server trả
  304 nghĩa là không đổi, không tốn băng thông.
- **Crawlee `BasicCrawler`**: hàng đợi, retry, giới hạn đồng thời, delay theo
  domain và robots.txt; phần fetch do mình tự viết để kiểm soát User-Agent,
  kích thước và redirect.
- **Server Component bất đồng bộ lồng nhau** (`InternalText`): tự đọc Supabase
  bằng session người xem; RLS quyết định có dữ liệu hay không.
- **TypeScript**: kiểu `Fetcher` làm "test seam", test chạy không cần mạng.

## Dependency mới

- `@crawlee/basic`, `@crawlee/utils`: hàng đợi crawl, retry, robots.txt (`crawler/src/crawl.ts`, `main.ts`).
- `cheerio`: phân tích HTML để lấy text (`crawler/src/extract.ts`, `sitemap.ts`).
- `pg`: kết nối Postgres bằng login role riêng (`crawler/src/db.ts`).
- `tsx`: chạy TypeScript trực tiếp, không cần bước build.

## Bảo mật

- Không service-role key; `CRAWLER_DATABASE_URL` chỉ ở GitHub secret, không ở Vercel.
- Không log connection string; log chỉ có URL, kết quả, mã lỗi.
- Tôn trọng robots.txt, không vượt 403/anti-bot, không giả trình duyệt.
- `document_texts` bị RLS chặn với anon và người không có quyền biên tập.

## Lỗi thường gặp

- Nguồn chưa verified / chưa approved / chưa bật crawl → trang admin hiện lý do, crawler bỏ qua.
- URL khác domain với canonical URL của nguồn → `crawler_url_not_source`.
- Selector sai → text rỗng → `error` với `empty_text`; thử bằng `npm run probe`.
- Site trả 403 cho bot → ghi lỗi; không tìm cách vượt qua.
- Quên tạo login role hoặc secret → workflow in "skipping crawl" và dừng êm.

## Kiểm thử

- `npm run test -w @nordic/crawler` (12 test: trích text, sitemap, fetch giới hạn, luồng crawl với fetcher giả).
- `apps/web/lib/crawler/database.test.ts` (PGlite: role không đọc được bảng, URL
  lạ bị từ chối, text riêng tư, gắn cờ và xử lý cờ, tắt nguồn là dừng).
- Test trang admin, cảnh báo trên thẻ, mục text nội bộ.
- Thủ công: bật crawl cho một nguồn T1, đăng ký 1 URL, chạy
  `CRAWLER_DATABASE_URL=... npm run crawl -w @nordic/crawler`, xem `/admin/crawler`,
  mở tài liệu mới; sửa một fact đã duyệt trỏ vào tài liệu cũ, chạy lại khi trang đổi.
