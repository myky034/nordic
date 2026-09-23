# Slice 6a — Quy định nhập cư

## Đã xây dựng

- Bảng `immigration_rules` và `immigration_rule_reviews`. Bảng `facts` có thêm cột
  `immigration_rule_id`.
- RPC mới: `propose_immigration_rule`, `review_immigration_rule`. `propose_fact`
  có thêm tham số `p_immigration_rule`.
- Trang công khai: `/immigration`, `/immigration/[id]`. Trang biên tập:
  `/immigration/workspace`.
- Banner cảnh báo mâu thuẫn (S6-05), disclaimer pháp lý, và nhãn cảnh báo cho điều
  kiện đến từ nguồn không phải T1.

Phần Labour Market (6b) chưa làm.

## Vì sao thiết kế như vậy

Thông tin nhập cư là loại nhạy cảm nhất (AGENTS.md mục 1.5): mỗi claim phải có
nguồn, URL, ngày xác minh và trạng thái hiệu lực, và sản phẩm không được đóng vai
cố vấn pháp lý. Vì vậy có 4 lớp bảo vệ:

1. **Chỉ lưu thông tin nhận diện, không lưu tóm tắt.** Bảng chỉ ghi "quy định này
   tồn tại, tên chính thức là gì, trang chính thức ở đâu". Mọi điều kiện cụ thể là
   fact có trích đoạn riêng.
2. **Bằng chứng phải là T1 của đúng quốc gia.** Trang của Migrationsverket không
   dùng để chứng minh quy định của Đan Mạch được. Trang chính thức của quy định
   phải nằm trên cùng domain với nguồn T1, để chữ "Official page" trên UI là thật.
3. **Nguồn phải được xác minh mới hiển thị.** Điều kiện này được kiểm tra ở RLS
   trên mỗi lần đọc. Khi bạn chuyển nguồn về `needs_verification`, quy định và các
   điều kiện liên quan biến mất khỏi trang công khai ngay lập tức.
4. **Disclaimer luôn hiển thị**, kèm link tới cơ quan di trú chính thức.

## Luồng hoạt động

1. `/admin/sources`: kiểm tra nguồn di trú (ví dụ Migrationsverket) đã được gán
   đúng quốc gia và là T1. Tự đối chiếu, ghi authority notes rồi đặt `verified`.
2. `/documents/import`: nhập trang quy định từ nguồn đó.
3. `/immigration/workspace`: đề xuất quy định (loại, tên chính thức, URL trang
   chính thức, tài liệu, trích đoạn nêu tên quy định).
4. Người có `facts.review` duyệt quy định.
5. `/facts/workspace`: đề xuất từng điều kiện (ví dụ yêu cầu tài chính), chọn
   "Quy định nhập cư: …" rồi duyệt.
6. `/immigration/[id]`: thấy quy định, các ngày tháng (thu thập, duyệt, xác minh
   nguồn) và danh sách điều kiện.

## File nên đọc theo thứ tự

1. `docs/architecture/slice-06-immigration.md`
2. `packages/db/prisma/migrations/20260923120000_immigration/migration.sql`, đặc
   biệt là hai policy `immigration_rules_public` và `facts_public` mới.
3. `apps/web/lib/immigration/domain.ts` — loại quy định, `isOfficialTier`, filter,
   thông báo lỗi.
4. `apps/web/lib/immigration/view.tsx` — select string, `LegalDisclaimer`,
   `ConflictBanner`.
5. `apps/web/app/(app)/immigration/workspace/{actions,forms,page}.tsx`
6. `apps/web/app/(public)/(explore)/immigration/page.tsx` và `[id]/page.tsx`
7. `apps/web/lib/facts/view.tsx` — nhãn "Không phải nguồn chính thức (T1)".
8. Test: `lib/immigration/*.test.ts`, `app/(public)/(explore)/immigration/pages.test.tsx`.

## Khái niệm PostgreSQL / Supabase

- **Kiểm tra lúc đọc thay vì lúc ghi.** "Nguồn đã verified" không lưu vào quy định
  mà được policy kiểm tra ở mỗi lần đọc, nên thông tin không bao giờ bị kẹt ở
  trạng thái cũ.
- **Không dựa vào RLS lồng nhau.** Policy của `facts` join thẳng sang
  `immigration_rules`, `documents` và `sources` rồi tự kiểm tra điều kiện. Nếu chỉ
  dựa vào RLS của `immigration_rules`, biên tập viên (thấy được mọi rule) sẽ được
  áp điều kiện lỏng hơn người dùng thường.
- **`url_origin()`**: hàm SQL `IMMUTABLE` lấy `scheme://host`, không phân biệt hoa
  thường, dùng để so domain.
- **Xóa rồi tạo lại `propose_fact`** thay vì overload, để PostgREST chỉ thấy một
  phiên bản. Các lời gọi cũ 10 hoặc 13 tham số vẫn chạy nhờ `DEFAULT NULL`.
- **`FOR UPDATE OF r`**: khi SELECT có join, chỉ khóa dòng của bảng quy định.

## Khái niệm Next.js / TypeScript

- Gọi `Promise.all` cho hai truy vấn độc lập (quy định và điều kiện) để giảm thời
  gian tải.
- `.eq("documents.sources.status", "verified")` chỉ lọc được khi embed có
  `!inner`; nếu thiếu, PostgREST trả `documents: null` thay vì bỏ dòng.
- `ruleFactSelect` được tạo từ `factSelect` bằng `replace`, để `FactCard` dùng lại
  đúng một kiểu `FactRow`.

## Bảo mật

- T1, quốc gia và domain đều được kiểm tra trong RPC, không tin dữ liệu từ form.
  Tier được kiểm tra lại khi duyệt, phòng trường hợp nguồn bị hạ tier trong lúc chờ.
- Không có đường ghi trực tiếp vào bảng. Lịch sử duyệt chỉ biên tập viên xem được.
- Lỗi DB không lộ ra UI (allowlist trong `immigrationError`).

## Lỗi thường gặp

- **"Phải là nguồn T1"**: tài liệu thuộc nguồn chưa đặt tier T1, hoặc là nguồn
  EU/T2.
- **"Nguồn … phải được gán đúng quốc gia"**: nguồn chưa có `country` trong Source
  Registry.
- **"Trang chính thức phải cùng domain"**: ví dụ SIRI (`siri.dk`) và
  `nyidanmark.dk` là hai domain khác nhau, cần đăng ký hai nguồn riêng.
- **Đã duyệt nhưng trang công khai vẫn trống**: nguồn T1 chưa `verified`. Trang
  workspace ghi rõ trường hợp này.
- **Điều kiện đã duyệt nhưng không hiện**: nguồn của chính fact đó chưa `verified`.

## Kiểm thử

Tự động (đã chạy, pass): `npm test` (147 pass, 4 live skip), `npm run lint`,
`npx tsc --noEmit -p apps/web`, `npm run build -- --webpack`.

Browser (cần làm sau khi `npm run db:migrate:deploy`):

1. Ở cửa sổ ẩn danh, mở `/immigration`: thấy disclaimer và danh sách cơ quan di trú.
2. Đề xuất một quy định bằng tài liệu từ nguồn T3 → bị từ chối. Làm lại với tài
   liệu T1 → thành công.
3. Duyệt quy định trong khi nguồn T1 chưa verified → trang công khai vẫn trống.
   Verify nguồn → quy định hiện ra.
4. Thêm hai điều kiện, một từ T1 và một từ nguồn T3 đã verified → điều kiện T3 có
   nhãn cảnh báo.
5. Đánh dấu hai điều kiện mâu thuẫn với nhau → banner đỏ xuất hiện.
6. Chuyển nguồn T1 về `needs_verification` → quy định và điều kiện biến mất khỏi
   trang công khai.
