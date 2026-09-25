# Slice 6b — Thị trường lao động

## Đã xây dựng

- Bảng `occupations` và `occupation_reviews`. Bảng `facts` có thêm hai cột
  `occupation_id` và `reference_period`.
- RPC mới: `propose_occupation`, `review_occupation`. `propose_fact` có thêm hai
  tham số tùy chọn `p_occupation` và `p_reference_period`.
- Trang công khai: `/occupations` và `/occupations/[id]` (lọc số liệu theo quốc
  gia). Workspace biên tập: `/labour/workspace`.
- Form fact có thêm ô "Kỳ số liệu"; `FactCard` hiện badge "Kỳ số liệu" và nhãn
  "Không phải số liệu thống kê chính thức".

## Vì sao thiết kế như vậy

- **Lương là dữ liệu nhạy cảm** (spec §10), và spec cấm tạo số liệu lương hay
  nhu cầu tuyển dụng khi không có nguồn (§6). Vì vậy mỗi con số là một fact có
  trích đoạn, được duyệt, và bị đánh dấu khi mâu thuẫn, giống học phí và điều kiện
  nhập cư.
- **Kỳ số liệu khác ngày hiệu lực.** "Lương trung vị 2024" mô tả năm 2024; nó
  không "có hiệu lực từ ngày…". Trộn hai khái niệm sẽ khiến số liệu cũ trông như
  còn hiệu lực. `reference_period` chỉ nhận định dạng chặt (2024, 2024-Q2,
  2024-H1, 2024-09), không nhận chữ mơ hồ như "gần đây".
- **Số liệu bắt buộc có quốc gia**: một con số lương không nói quốc gia nào thì
  không có ý nghĩa.
- **Nguồn phải được xác minh mới hiển thị.** Được kiểm tra ở RLS trên mỗi lần đọc,
  giống immigration.
- **Chưa làm tin tuyển dụng, nhà tuyển dụng hay kỹ năng**: spec xếp việc gom job
  board vào phần hoãn.

## Luồng hoạt động

1. `/admin/sources`: xác minh (verify) nguồn thống kê, ví dụ SCB hoặc Statistics
   Denmark.
2. `/documents/import`: nhập trang định nghĩa nghề (ESCO, cơ quan thống kê…) và
   trang bảng số liệu.
3. `/labour/workspace`: đề xuất nghề, gồm tên, phạm vi, và mã phân loại nếu nguồn
   có ghi. Người có `facts.review` duyệt.
4. `/facts/workspace`: đề xuất số liệu, chọn "Nghề: …", quốc gia, kỳ số liệu, đơn
   vị (ví dụ SEK/tháng), rồi trích đoạn bảng số liệu → duyệt.
5. `/occupations/[id]`: xem số liệu theo từng quốc gia.

## File nên đọc theo thứ tự

1. `docs/architecture/slice-06b-labour-market.md`
2. `packages/db/prisma/migrations/20260925090000_labour_market/migration.sql`
3. `apps/web/lib/labour/domain.ts` — hệ phân loại, `isReferencePeriod`,
   `isOfficialStatisticsTier`, thông báo lỗi.
4. `apps/web/lib/labour/view.tsx` — select string (`figureSelect` inner-join nguồn).
5. `apps/web/app/(app)/labour/workspace/{actions,forms,page}.tsx`
6. `apps/web/app/(public)/(explore)/occupations/page.tsx`, `[id]/page.tsx`
7. Test: `lib/labour/*.test.ts`, `app/(public)/(explore)/occupations/pages.test.tsx`.

## Khái niệm kỹ thuật

- **Unique theo phạm vi có NULL**: `unique(lower(name), coalesce(country_id,
  '000…'))`. PostgreSQL coi hai giá trị NULL là khác nhau, nên cần `coalesce` để
  "quốc tế" chỉ có một mục mỗi tên.
- **CHECK ràng buộc cặp**: `(classification_system IS NULL) = (classification_code
  IS NULL)`, nghĩa là có mã thì phải có hệ phân loại, và ngược lại.
- **Đếm cho segmented control**: dùng `select(..., { count: "exact", head: true })`,
  tức một request HEAD chỉ trả về số đếm, không tải dữ liệu.
- **Regex ở hai nơi**: `reference_period` được kiểm tra ở action (báo lỗi thân
  thiện), ở RPC và bằng CHECK trong DB (không thể bị bỏ qua). Ba nơi dùng cùng một
  pattern.

## Lỗi thường gặp

- **"Số liệu gắn với một nghề phải có quốc gia"**: nghề có phạm vi quốc tế nên
  phải tự chọn quốc gia cho số liệu.
- **Nhập mã phân loại mà không chọn hệ** (hoặc ngược lại): bị từ chối.
- **Đã duyệt nhưng số liệu không hiện**: nguồn của chính số liệu đó chưa `verified`.
- **So sánh số liệu khác kỳ hoặc khác đơn vị**: hệ thống không tự quy đổi; trang có
  ghi rõ các số liệu không so sánh trực tiếp được.

## Kiểm thử

Tự động (đã chạy, pass): `npm test` (173 pass, 4 live skip), `npm run lint`,
`npx tsc --noEmit -p apps/web`, `npm run build -- --webpack`.

Browser (sau khi `npm run db:migrate:deploy`):

1. Mở `/occupations` ở cửa sổ ẩn danh: thấy danh sách rỗng kèm ghi chú "not a
   forecast".
2. Đề xuất nghề có mã nhưng không chọn hệ phân loại → bị từ chối. Làm lại đúng →
   duyệt → nghề hiện ra.
3. Thêm số liệu không có quốc gia → bị từ chối. Thêm số liệu với kỳ "recent" → bị
   từ chối.
4. Duyệt số liệu khi nguồn chưa verified → trang công khai chưa hiện. Verify nguồn
   → số liệu hiện ra, tab quốc gia có số đếm.
5. Thêm một số liệu từ nguồn T3/T4 đã verified → hiện nhãn "Không phải số liệu
   thống kê chính thức".
