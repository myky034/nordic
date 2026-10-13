# L3a — Loại thông tin (fact types) và giá trị có cấu trúc (2026-10-13)

> Kế hoạch đã duyệt: `docs/architecture/fact-types-plan.md`. Task Linear: KHLOE-146.

## Đã làm gì

- Migration `20261013090000_fact_types`:
  - đổi `comparison_metrics` → **`fact_types`** và `facts.metric_id` → **`fact_type_id`**;
  - thêm tên và định nghĩa Việt/Anh, kiểu giá trị (`money` · `number` · `date` · `text`), đối tượng
    (`applies_to`), khoảng hợp lệ, cờ `comparable`;
  - thêm vào `facts` các cột `value_number`, `value_currency`, `value_period`, `value_date`;
  - `save_metric()` được thay bằng `save_fact_type()`;
  - `propose_fact()` thay `p_metric` bằng `p_fact_type` và nhận thêm 4 tham số giá trị có cấu trúc.
- Trang `/admin/metrics` thành **"Loại thông tin"**: bảng + form tạo/sửa (khóa mã, kiểu, đối tượng,
  nhóm sau khi tạo).
- Form "Thêm thông tin" (`/facts/workspace`):
  - chọn loại, danh sách lọc theo đối tượng đã gắn;
  - form hiện ô cấu trúc theo kiểu và định nghĩa của loại.
- Bảng So sánh chỉ lấy loại có `comparable = true`. Nhãn "So sánh đã sẵn sàng" (lib/coverage) cũng
  chỉ đếm các loại này.
- Thẻ thông tin hiện tên loại theo ngôn ngữ người xem, nếu thông tin có loại.

## Vì sao thiết kế như vậy

- **Một danh mục, không phải hai.** Chỉ số so sánh vốn đã là danh mục định nghĩa; tạo thêm bảng
  "loại thông tin" sẽ có hai danh sách cho cùng một ý (AGENTS.md §4). Bảng có 0 dòng nên đổi tên an
  toàn. Migration còn tự chặn nếu bảng có dữ liệu, thay vì bịa nhãn tiếng Anh cho dữ liệu cũ.
- **Chữ của nguồn vẫn là chính.** `value` (nguyên văn) vẫn bắt buộc; cột cấu trúc chỉ là cách đọc
  lại con số đó để lọc và tính. Không quy đổi đơn vị hay tiền tệ (AGENTS.md §1).
- **Con số phải có trong trích đoạn**, cho cả người nhập tay (quyết định D3). Phép so dùng lại
  `extraction_norm()` của AI trích xuất, nên "145 000", "145,000" và "6,5" / "6.5" đều khớp.
- **Không đổi được mã, kiểu, đối tượng, nhóm.** Thông tin đã gắn loại sẽ đổi nghĩa nếu loại đổi;
  muốn khác thì tạo loại mới và ngừng dùng loại cũ.
- **Database kiểm tra lại mọi thứ.** Form và server action chỉ kiểm hình dạng; `propose_fact()` quyết
  định cột nào bắt buộc, khoảng hợp lệ, đối tượng khớp, con số có trong trích đoạn.

## Luồng

```
Quản trị (metrics.manage) → /admin/metrics → saveMetric → save_fact_type()  [audit: fact_type.saved]

Biên tập (facts.propose) → /facts/workspace → chọn đối tượng → chọn loại → ô cấu trúc
  → proposeFact (kiểm hình dạng, chuẩn hóa "6,5" → 6.5, "sek" → "SEK")
  → propose_fact() (kiểm loại, đối tượng, kiểu, khoảng, con số trong trích đoạn) → facts + evidence

Người duyệt → checklist thêm dòng "giá trị có cấu trúc khớp trích đoạn"
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261013090000_fact_types/migration.sql` | đổi tên, cột mới, hai hàm |
| `apps/web/lib/compare/domain.ts` | danh sách kiểu / đối tượng / kỳ, nhãn Việt/Anh, `formatStructuredValue`, thông báo lỗi |
| `apps/web/app/(app)/admin/metrics/*` | trang quản trị "Loại thông tin" |
| `apps/web/app/(app)/facts/workspace/{forms,actions,page}.tsx` | form nhập có loại và ô cấu trúc |
| `apps/web/lib/compare/database.test.ts` | test PGlite cho toàn bộ quy tắc |

## Khái niệm cần biết

- **Đổi tên trong Postgres giữ nguyên dữ liệu và khóa ngoại**, nhưng tên ràng buộc, chỉ mục, policy
  không tự đổi theo; migration đổi từng cái cho nhất quán.
- **`trim_scale(numeric)`** bỏ số 0 thừa sau dấu thập phân (6.50 → 6.5) trước khi so với trích đoạn.
- **`IF NOT (CASE … END) THEN`** trong PL/pgSQL phải có ngoặc; nếu không, `THEN` đầu tiên của
  `CASE` bị hiểu là `THEN` của `IF`.
- **Form phụ thuộc lựa chọn** (client component): `useState` giữ đối tượng và loại đang chọn; đổi đối
  tượng thì xóa loại đã chọn, vì loại cũ có thể không còn hợp.

## Bảo mật

- Ghi loại thông tin chỉ qua `save_fact_type()`: kiểm `metrics.manage`, ghi `access_audit`.
- `propose_fact()` vẫn kiểm `facts.propose`. Không cột mới nào ghi trực tiếp được qua API.
- `fact_types` đọc công khai (định nghĩa, không phải dữ liệu), như chỉ số trước đây.

## Lỗi thường gặp

- Gửi giá trị cấu trúc mà không chọn loại → bị từ chối (ràng buộc `facts_structured_needs_type`).
- Con số gõ khác trích đoạn (13200 so với "12 300") → `facts_number_not_in_excerpt`.
- Chọn loại "Chương trình" nhưng không gắn chương trình → `facts_type_entity_mismatch`.

## Cách kiểm tra

- `npx vitest run lib/compare lib/facts "app/(app)/facts/workspace"`.
- Thử tay, sau khi chạy migration:
  1. tạo loại `min_ielts_overall` (Con số, Chương trình, 0–9);
  2. ở "Thêm thông tin", gắn một chương trình, chọn loại đó;
  3. nhập 6.5 với trích đoạn có "6.5", rồi thử 7 để thấy lỗi.

## Thứ tự đọc code

1. migration → 2. `lib/compare/database.test.ts` → 3. `lib/compare/domain.ts` (phần fact types) →
4. `app/(app)/admin/metrics/forms.tsx` → 5. `app/(app)/facts/workspace/forms.tsx` và `actions.ts`.

## Còn lại

- **L3b:** hiển thị công khai "Học phí / năm — 145.000 SEK / năm · Nguồn ghi: …".
- **L3c:** đưa loại thông tin vào AI trích xuất.
