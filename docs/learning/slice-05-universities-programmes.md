# Slice 5 — Trường đại học và chương trình học

## Đã xây dựng

- 3 bảng mới: `universities`, `programmes`, `education_reviews`, cùng 3 cột mới
  trên `facts`: `university_id`, `programme_id`, `deadline_type`.
- 3 RPC mới: `propose_university`, `propose_programme`, `review_education`.
  `propose_fact` có thêm tham số tùy chọn.
- Trang công khai: `/universities`, `/programmes`, `/programmes/[id]`. Trang quốc
  gia có link sang hai trang này.
- Workspace biên tập: `/education/workspace`. Form ở `/facts/workspace` có thêm ô
  gắn với trường/chương trình và ô loại deadline.
- Kèm theo là 2 bản vá integrity từ đợt review Slice 1–4 (xem cuối tài liệu).

## Vì sao thiết kế như vậy (Phương án A)

Học phí và deadline là dữ liệu **nhạy cảm và hay thay đổi**. Nếu lưu thành cột
`programmes.tuition`, mỗi lần sửa sẽ ghi đè giá trị cũ, không có bằng chứng riêng,
không có lịch sử duyệt và không đánh dấu mâu thuẫn được. Muốn làm đúng thì phải
xây lại đúng những thứ Slice 4 đã có.

Vì vậy bảng `programmes` chỉ trả lời câu hỏi "chương trình này có tồn tại không, và
bằng chứng ở đâu?". Còn "học phí bao nhiêu?" là một **fact**, gắn với chương trình
qua `facts.programme_id`, có evidence, được review và có thể bị đánh dấu mâu thuẫn
như mọi fact khác.

Mỗi trường/chương trình bắt buộc có `document_id` và `evidence_excerpt` (SRS
FR-ED-02: không có trường hay chương trình nào thiếu bằng chứng). Không có dữ liệu
mẫu: mọi mục đều do người vận hành nhập từ tài liệu thật.

## Luồng hoạt động

1. Nhập tài liệu nguồn (Slice 3) — ví dụ trang giới thiệu chương trình trên
   website trường.
2. `/education/workspace` → "Đề xuất trường": chọn quốc gia, tên, website, tài
   liệu, trích đoạn → trạng thái `proposed` (công chúng chưa thấy).
3. Người có `facts.review` đọc tài liệu gốc → "Đã kiểm tra bằng chứng tồn tại"
   → `reviewed` → trường hiện ở `/universities`.
4. Đề xuất chương trình của trường đó rồi duyệt (hệ thống chặn duyệt chương trình
   khi trường chưa được duyệt).
5. `/facts/workspace` → đề xuất fact "học phí" hoặc "deadline", chọn
   "Chương trình: …", chọn loại deadline nếu là hạn nộp → duyệt → fact hiện trên
   `/programmes/[id]`.

## File quan trọng (đọc theo thứ tự)

1. `docs/architecture/slice-05.md` — ERD, quyền, giới hạn.
2. `packages/db/prisma/migrations/20260923100000_education/migration.sql` — bảng,
   RLS, RPC. Đây là nơi thực thi mọi quy tắc.
3. `packages/db/prisma/schema.prisma` — model `University`, `Programme`,
   `EducationReview` (phản chiếu SQL; partial unique index chỉ có trong SQL).
4. `apps/web/lib/education/domain.ts` — nhãn, allowlist filter, escape LIKE, map lỗi.
5. `apps/web/app/(app)/education/workspace/actions.ts` → `forms.tsx` → `page.tsx`.
6. `apps/web/lib/education/view.tsx` — select string PostgREST và component bằng chứng.
7. `apps/web/app/(public)/(explore)/programmes/page.tsx`, `[id]/page.tsx`,
   `universities/page.tsx`.
8. Test: `lib/education/*.test.ts`, `app/(public)/(explore)/programmes/pages.test.tsx`.

## Khái niệm Next.js

- **`next/form`** (`<Form action="/programmes">`): form GET, khi submit sẽ cập
  nhật search params bằng client-side navigation (không reload cả trang) và vẫn
  chạy được khi tắt JavaScript. Đáp ứng yêu cầu "lọc không cần reload toàn trang"
  của US-ED-01. Tài liệu: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md`.
- **`PageProps<"/programmes/[id]">`**: kiểu props do Next sinh theo route. Khi thêm
  route mới cần chạy `npx next typegen` (hoặc `next dev` / `next build`) thì
  `tsc` mới nhận ra route đó.
- **`params` / `searchParams` là Promise**, phải `await`.
- **Server Actions** (`"use server"`) luôn kiểm tra quyền, dù UI đã ẩn nút.

## Khái niệm TypeScript

- `as const` + `keyof typeof degreeTypes` tạo kiểu union từ một object, dùng chung
  cho nhãn UI và allowlist (tránh lệch giữa hai nơi).
- `Object.hasOwn(obj, key)` để kiểm tra giá trị nằm trong allowlist, không bị ảnh
  hưởng bởi prototype.
- Kết quả từ PostgREST embed được ép kiểu (`as unknown as ProgrammeListRow[]`) vì
  client không tự suy ra kiểu cho chuỗi select có FK hint.

## Supabase / PostgreSQL

- **Partial unique index** `... WHERE status <> 'rejected'`: chống trùng tên, nhưng
  vẫn cho tạo lại bản sửa sau khi bản cũ bị từ chối.
- **`num_nonnulls(a, b) = 1`**: một bản review gắn đúng 1 thực thể, vẫn dùng FK
  thật.
- **FK hint trong select** (`universities!programmes_university_id_fkey!inner(...)`):
  `documents` được nhiều bảng tham chiếu, nên ghi rõ đi theo khóa nào. `!inner`
  biến embed thành inner join để lọc được theo cột của bảng con
  (`universities.countries.slug`).
- **RLS lồng nhau**: policy công khai của `programmes` kiểm tra trường đã được
  duyệt, nên từ chối một trường sẽ tự ẩn các chương trình của nó.

## Bảo mật

- Không có quyền ghi trực tiếp vào bảng; chỉ ghi qua RPC `SECURITY DEFINER` có
  `search_path=''`.
- Actor lấy từ `auth.uid()`; form gửi `actor`/`status` giả sẽ bị bỏ qua (có test).
- URL chỉ chấp nhận http(s), không có credential (kiểm tra ở action và bằng CHECK
  trong DB).
- Lỗi DB thô không bao giờ hiện ra UI; chỉ các mã lỗi nằm trong allowlist mới được
  dịch sang thông báo.
- Chuỗi tìm kiếm ngành được escape `%`/`_` trước khi đưa vào `ilike`.

## Lỗi thường gặp

- Gán học phí/deadline vào chương trình bằng cách sửa bảng: không làm được và
  không nên làm. Hãy tạo fact.
- Duyệt chương trình trước khi duyệt trường: bị chặn.
- Chọn quốc gia khác với quốc gia của trường khi tạo fact: bị chặn; để trống thì
  hệ thống tự lấy theo trường.
- Deadline "rolling"/"year-round": không nhập ngày giả định vào "Đến ngày".
- Chưa chạy `npx next typegen` sau khi thêm route mới: `tsc` báo lỗi `PageProps`.

## Cách kiểm thử

Tự động (đã chạy, pass):

```bash
npm test                  # 131 pass, 4 live skip
npm run lint
npx tsc --noEmit -p apps/web
npm run build -- --webpack
```

Browser (chưa chạy, cần thực hiện sau khi deploy migration):

1. `npm run db:migrate:deploy` rồi `npm run db:generate` từ thư mục gốc.
2. `/admin/access`: kiểm tra role Administrator có `education.manage`.
3. Nhập một tài liệu thật ở `/documents/import`, rồi đề xuất trường và chương
   trình ở `/education/workspace`.
4. Mở cửa sổ ẩn danh: `/universities` và `/programmes` vẫn trống cho tới khi duyệt.
5. Duyệt trường, rồi duyệt chương trình → cả hai hiện ra; thử các filter.
6. Tạo fact học phí gắn chương trình, duyệt → fact hiện ở `/programmes/[id]`.

## Bản vá integrity kèm theo

- `20260923090000_fact_conflict_requires_review`: chỉ ghép cặp mâu thuẫn giữa hai
  fact đã được duyệt.
- `20260923091000_source_reverification`: `last_verified_at` chỉ được cập nhật khi
  chuyển sang verified hoặc khi tick "xác minh lại hôm nay".
- Chi tiết: phần "Cập nhật 2026-09-23" trong tài liệu Slice 2 và Slice 4.

## Cập nhật 2026-09-23 (Slice 6a)

Ràng buộc "một fact gắn tối đa một thực thể" nay tính cả quy định nhập cư
(`facts_single_entity`). `propose_fact` có thêm tham số tùy chọn
`p_immigration_rule`. Luồng giáo dục không thay đổi. Xem `slice-06-immigration.md`.
