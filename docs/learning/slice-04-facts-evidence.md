# Slice 4 — Thông tin đề xuất và bằng chứng

## Đã xây dựng và lý do

Slice 3 chỉ lưu tài liệu. Slice 4 cho phép người dùng tách một thông tin cụ thể,
gắn đoạn văn hỗ trợ và để người có quyền kiểm tra trước khi công bố.
Không cần có mẫu thông tin sẵn; form hướng dẫn cách chọn câu từ tài liệu thật.
Hệ thống không suy đoán nội dung từ URL hoặc hash.

Bốn phần: bảng facts, evidence, fact_reviews; RPC kiểm soát ghi;
UI /facts/workspace; trang công khai /facts. Không thêm dependency.

## Cách chạy và kiểm thử trên browser

1. Áp dụng migration bằng npx prisma migrate deploy, rồi npx prisma generate.
2. Chạy npm run dev, đăng nhập tài khoản quản trị.
3. Tại /admin/access, kiểm tra role có facts.propose và facts.review. Các role
   có đủ hai quyền quản lý RBAC được bổ sung cả hai khi migration chạy.
   Cấp facts.propose cho người nhập; facts.review cho người duyệt khi cần.
4. Mở /documents, chọn tài liệu bạn đã nhập, bấm “Thêm thông tin & bằng chứng”.
5. Mở nguồn gốc, đọc một câu có thể đối chiếu. Điền:
   - Chủ đề: câu thuộc lĩnh vực gì.
   - Đối tượng: câu nói về ai/điều gì.
   - Thuộc tính: điều gì được nói về đối tượng.
   - Nội dung/giá trị: điều nguồn thực sự nêu.
   - Bằng chứng: một trích đoạn nguyên văn hỗ trợ nội dung, tối đa 500 ký tự.
   Không tìm được câu phù hợp thì để việc nhập lại sau, không đoán.
6. Quốc gia, đơn vị, ngày hiệu lực không biết thì để trống.
   URL và ngày thu thập tự lấy từ tài liệu, không phải ngày bạn tạo đề xuất.
7. Lưu đề xuất: thấy trạng thái chưa duyệt trong workspace; cửa sổ ẩn danh tại
   /facts chưa thấy đề xuất.
8. Người có quyền review đọc nguồn, chọn quyết định và nhập lý do. Sau khi duyệt,
   /facts hiển thị bằng chứng, nguồn, tier và ngày thu thập.
9. Nếu thực sự có hai thông tin mâu thuẫn, chọn thông tin đối chiếu và đánh dấu
   mâu thuẫn: giữ cả hai cùng bằng chứng và lịch sử, không tự chọn bên đúng.
10. Thử bằng tài khoản không có quyền, và thu hồi quyền khi form đang mở:
    thao tác phải bị từ chối. Không tạo thông tin giả để test trên DB dùng chung.

“Đã duyệt bằng chứng” KHÔNG có nghĩa “Verified” hoặc còn hiệu lực hiện tại.
Nếu bạn có cả hai quyền, bản MVP cho phép tự duyệt; chưa có quy trình hai người.
Không sửa/ghi đè claim cũ trong Slice này. Gửi đề xuất mới cho nội dung sửa đổi;
chưa có chức năng hợp nhất, thay thế hoặc giải quyết mâu thuẫn.

## Luồng và file nên đọc theo thứ tự

1. docs/architecture/slice-04.md — quan hệ và giới hạn.
2. prisma/migrations/20260919090000_facts/migration.sql — RLS, giao dịch và RPC.
3. lib/facts/domain.ts — nhãn trạng thái, hiệu lực chưa xác minh và lỗi an toàn.
4. app/(app)/facts/workspace/actions.ts — kiểm tra quyền và gọi RPC.
5. app/(app)/facts/workspace/forms.tsx — form nhập và duyệt.
6. app/(app)/facts/workspace/page.tsx — dữ liệu biên tập, lịch sử.
7. lib/facts/view.tsx và app/(public)/(explore)/facts/page.tsx — nguồn hiển thị.
8. lib/facts/*.test.* — kiểm thử quyền, bằng chứng, mâu thuẫn và UI.

## Next.js và TypeScript

Server Components lấy dữ liệu qua Supabase SSR client; Client Components dùng
useActionState để hiện pending/thành công/lỗi. Server Actions kiểm tra quyền dù
button đã ẩn. RPC kiểm tra lại vì có thể gọi API trực tiếp.
revalidatePath cập nhật màn hình sau mutation, không thay thế kiểm tra quyền.

FactRow mô tả hình dạng projection PostgREST; evidence là object do khóa
fact_id unique tạo quan hệ một-một. FactState mô tả kết quả action an toàn.
TypeScript không xác thực dữ liệu runtime; CHECK, FK, NOT NULL và quyền SQL
là lớp bảo vệ đầu vào trực tiếp. React escape nội dung, không render HTML nguồn.

## Bảo mật và lỗi thường gặp

- Không chuyển role hoặc actor do browser gửi thành quyền thật.
- Không lấy URL bằng chứng từ ô nhập tùy ý; lấy từ phiên bản tài liệu.
- Không coi tier cao là mọi câu đều đúng; không tự xác minh excerpt bằng hash.
- Không dùng ngày thu thập thay ngày xuất bản/hiệu lực.
- Không ghi toàn bài có bản quyền vào excerpt.
- RLS che đề xuất chưa duyệt và lịch sử review khỏi public.
- Danh sách giới hạn 100 bản ghi gần nhất; chưa có phân trang.
- Không có seed facts, LLM, crawler hoặc lưu toàn văn.

## Kiểm thử

npx vitest run: tests SQL trên PGlite dùng dữ liệu giả trong DB tạm, không insert
facts giả lên Supabase. Bao phủ evidence bắt buộc/rollback, RLS public-editor,
cấm ghi trực tiếp, review có lịch sử, giữ hai phía mâu thuẫn, ngày hiệu lực,
thu hồi quyền, action actor spoofing và HTML escaping.
Chạy thêm npx prisma validate, npx tsc --noEmit, npm run lint,
npm run build -- --webpack.

FACTS_LIVE_TEST=1 npx vitest run lib/facts/live.test.ts chạy kiểm tra chỉ đọc
trên development (schema, grants và PostgREST projection); không tự tạo fact.
Luồng browser với nội dung thật cần được người dùng nhập và đối chiếu nguồn.

## Kết quả xác nhận 2026-09-19

- Migration đã áp dụng trên development/test; không tạo facts mẫu.
- 93 tests đạt, 4 kiểm thử live được bỏ qua mặc định.
- Kiểm thử live Slice 4 riêng đã đạt: grants và truy vấn PostgREST liên kết evidence.
- Prisma validate, TypeScript, ESLint và production webpack build đạt.
- HTTP smoke: /facts trả 200 với trạng thái trống; /facts/workspace khi chưa
  đăng nhập trả 307 về /login.
- Chưa thực hiện thao tác browser đăng nhập/tạo/duyệt với nội dung nguồn thật;
  cần người vận hành chọn câu và đối chiếu bằng chứng. Các luồng mutation và
  bảo vệ quyền đã được kiểm thử trong database tạm và action tests.
