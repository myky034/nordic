# Slice 8 — Không gian nghiên cứu cá nhân

## Đã xây dựng

- 6 bảng dữ liệu riêng tư: `research_projects`, `research_project_countries`,
  `saved_items`, `notes`, `user_plans`, `user_plan_countries`.
- Nút **☆ Lưu** trên 6 loại trang chi tiết. Các trang `/workspace`,
  `/workspace/projects/[id]`, `/workspace/plan`.
- Hàm `delete_my_workspace()` và nút xóa toàn bộ dữ liệu, có bước gõ "XÓA" để xác
  nhận.

## Vì sao thiết kế như vậy

- **Đây là dữ liệu cá nhân đầu tiên** của hệ thống, nên quyền riêng tư được đặt ở
  tầng database (RLS) chứ không chỉ ở UI. Kể cả khi code app có lỗi, database vẫn
  không trả dữ liệu của người khác.
- **Khác với dữ liệu nghiên cứu**: dữ liệu nghiên cứu là append-only và phải qua
  duyệt, còn dữ liệu cá nhân thì người dùng được sửa và xóa tự do. Vì vậy slice này
  ghi thẳng vào bảng qua RLS, không dùng RPC kiểm duyệt.
- **Bookmark dùng khóa ngoại thật**: database đảm bảo mục được lưu tồn tại; xóa mục
  gốc thì bookmark tự xóa theo.
- **Chỉ lưu được mục công khai**: RLS kiểm tra khi ghi, nên không ai bookmark được
  bản nháp. Người dùng cũng không dò được ID của bản nháp qua lỗi trả về.
- **Không có gợi ý tự động**: trang Plan chỉ có "lối tắt" (link lọc sẵn theo câu
  trả lời của bạn) và ghi rõ không phải khuyến nghị.

## Luồng hoạt động

1. Đăng nhập → mở một chương trình → bấm **☆ Lưu**.
2. `/workspace` → **Tạo project mới** ("Sweden 2028", năm, vai trò, quốc gia).
3. Ở mục đã lưu, chọn project trong dropdown; mục được gắn vào project ngay.
4. Mở project để xem mục và ghi chú, bấm **So sánh các nước này**, sửa, lưu trữ,
   hoặc xóa project.
5. `/workspace/plan` → điền hồ sơ → xem **Lối tắt theo hồ sơ của bạn**.

## File nên đọc theo thứ tự

1. `docs/architecture/slice-08-research-workspace.md`
2. `packages/db/prisma/migrations/20260927090000_research_workspace/migration.sql`,
   đặc biệt các policy `*_owner` và hàm `workspace_item_visible`.
3. `apps/web/lib/workspace/domain.ts` — loại mục, `describeItem`, `parseYear`,
   `parseBudget`.
4. `apps/web/app/(app)/workspace/actions.ts` → `forms.tsx` → `page.tsx`,
   `projects/[id]/page.tsx`, `plan/page.tsx`.
5. `apps/web/components/save-button.tsx`, `apps/web/lib/workspace/saved.ts`.
6. Test: `lib/workspace/database.test.ts` (quyền riêng tư), `lib/workspace/*.test.ts`,
   `components/save-button.test.tsx`.

## Khái niệm kỹ thuật

- **`DEFAULT auth.uid()`**: chủ sở hữu do database tự điền theo phiên đăng nhập;
  form không bao giờ gửi `user_id`. Gửi `user_id` của người khác thì bị RLS từ chối.
- **`FOR ALL ... USING / WITH CHECK`**: `USING` lọc dòng được đọc, sửa, xóa;
  `WITH CHECK` kiểm dòng mới hoặc dòng sau khi sửa.
- **`ON DELETE CASCADE` và `SET NULL`**: xóa project thì ghi chú trong project bị
  xóa theo, còn bookmark chỉ bị bỏ khỏi project.
- **Partial unique index**: `unique(user_id, programme_id) WHERE programme_id IS NOT
  NULL` bảo đảm mỗi mục chỉ được lưu một lần.
- **`num_nulls(...) IN (0,3)`**: ngân sách phải nhập đủ cả ba trường hoặc bỏ trống
  cả ba.
- **`current_role` là từ khóa SQL**, nên cột được đặt tên `current_position`.
- **`requestSubmit()`** trong client component: đổi project ở dropdown là tự gửi
  form, không cần bấm thêm nút.

## Lỗi thường gặp

- **Không lưu được một mục**: mục chưa được công khai (còn là đề xuất), hoặc nguồn
  của quy định/số liệu chưa được xác minh.
- **Mở link project của người khác**: nhận trang 404. Hệ thống không cho biết
  project đó có tồn tại hay không.
- **Ngân sách chỉ nhập số tiền**: bị từ chối; cần đủ mã tiền tệ và kỳ.

## Kiểm thử

Tự động (đã chạy, pass): `npm test` (210 pass, 4 live skip), lint, tsc, build.
Test DB kiểm tra: admin không đọc được dữ liệu người khác, không ghi hộ người khác,
không bookmark bản nháp, không gắn mục vào project của người khác, quy tắc ngân
sách, xóa chỉ dữ liệu của mình, và xóa tài khoản thì dữ liệu tự xóa theo.

Browser (sau khi `npm run db:migrate:deploy`): đăng nhập hai tài khoản khác nhau,
tạo project hoặc ghi chú ở tài khoản A, rồi xác nhận tài khoản B không thấy (kể cả
khi B là admin); thử luồng Lưu → gắn vào project → so sánh → xóa dữ liệu.
