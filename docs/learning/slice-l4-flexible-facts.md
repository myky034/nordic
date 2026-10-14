# L4 — Thông tin linh hoạt: loại và con số là phần bổ sung (2026-10-14)

> Kế hoạch đã duyệt: `docs/architecture/flexible-facts-plan.md` ("đồng ý tất cả", Q1–Q5).
> Decision Log: "2026-10-14 — L4: flexible facts". Task Linear: KHLOE-146.

## Đã làm gì

| Phần | Nội dung |
|---|---|
| **L4a — database** | Migration `20261014100000_flexible_facts` |
| **L4b — màn duyệt** | Ô "Loại thông tin" trên thẻ đề xuất ở `/facts/workspace`, kèm ghi chú "hệ thống đã bỏ bớt…" |
| **L4c — AI** | Prompt `extract-v5`; `precheck` / `structuredNotes` cho chế độ dry-run |

Trong migration:

- `structured_value_fits()`: **một** quy tắc "giá trị có cấu trúc có hợp kiểu không", dùng chung cho
  ba đường vào (nhập tay, AI, người duyệt). Để trống thì luôn hợp; đã nhập thì phải đủ.
- `structured_value_in_excerpt()`: con số (hoặc năm của ngày) phải có trong trích đoạn (D3, không đổi).
- `propose_fact()`: loại có thể không có con số (Q1).
- `extractor_propose()`: chia lỗi thành **nhóm 1** (chống bịa → từ chối cả ứng viên) và **nhóm 2**
  (loại hoặc số sai → bỏ phần đó, giữ thông tin, ghi vào `extraction_items.adjustments`) (Q2).
- `set_fact_type()` + bảng `fact_type_changes`: người duyệt gắn, đổi hoặc bỏ loại của thông tin
  **đang chờ duyệt**, có lịch sử chỉ-thêm (Q3).
- Ràng buộc `facts_money_complete`: tiền tệ và kỳ chỉ tồn tại cùng một con số đầy đủ.

## Vì sao thiết kế như vậy

- **Chỗ hay đổi nhất là cách mỗi trang viết.** Trước đây chỗ đó được xử lý bằng chỗ khó đổi nhất
  (prompt, danh mục loại). Giờ biến thể của trang chỉ làm *mất phần bổ sung*, không mất thông tin,
  và người duyệt bù lại bằng một lần chọn.
- **Chống bịa không nới.** Câu trích phải có trong trang; con số trong *giá trị nguyên văn* phải có
  trong câu trích. Hai điều này vẫn làm ứng viên bị từ chối (nhóm 1).
- **Không giấu gì.** Phần bị bỏ được ghi lại bằng lời, hiện cho người duyệt (AGENTS.md §1.3, §9).
- **Người duyệt sửa nhãn, không sửa bằng chứng.** Nguyên văn, trích đoạn, tài liệu, đối tượng gắn
  không đổi được. Thông tin đã duyệt cũng không đổi tại chỗ, để trang công khai không đổi lặng lẽ.
- **Một hàm kiểm tra dùng chung** tránh ba bản copy lệch nhau (bài học L3c: bản cũ của
  `extractor_propose` có lỗi NULL mà `propose_fact` không có).

## Luồng

```
AI candidate ─► nhóm 1 (câu trích, số trong nguyên văn, chủ đề, ngày, quốc gia, trùng)
                 │ sai → invalid + lý do
                 ▼ đúng
               nhóm 2: loại có hợp trang? số có đúng kiểu, có trong câu trích?
                 │ sai → bỏ phần đó + ghi chú (adjustments)
                 ▼
               facts (proposed) ─► /facts/workspace
                                    ├─ "Loại thông tin": set_fact_type() → fact_type_changes
                                    └─ Duyệt / Từ chối: review_fact()
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261014100000_flexible_facts/migration.sql` | mọi quy tắc |
| `apps/web/lib/extraction/fact-types.database.test.ts` | test nhóm 1/2 và `set_fact_type` |
| `apps/web/lib/compare/database.test.ts` | test `propose_fact` (loại không có số) |
| `apps/web/lib/facts/domain.ts` | `factTypeKindsFor()`: loại nào hợp với một thông tin |
| `apps/web/lib/extraction/domain.ts` | `adjustmentLabel()`: ghi chú tiếng Việt |
| `apps/web/app/(app)/facts/workspace/{forms,actions,page}.tsx` | `FactTypeForm`, `setFactType`, `StructuredFields` dùng chung |
| `extractor/src/prompt.ts`, `validate.ts` | prompt v5, `precheck` (nhóm 1), `structuredNotes` (nhóm 2) |

## Khái niệm cần biết

- **`text[] || 'chuỗi'` trong PostgreSQL** bị hiểu là nối hai *mảng*, và chuỗi phải là một mảng hợp
  lệ ("malformed array literal"). Dùng `array_append(mảng, 'chuỗi')`. Test PGlite bắt được lỗi này.
- **Hàm SQL `IMMUTABLE` / `STABLE`.** `structured_value_fits` chỉ phụ thuộc tham số nên là
  `IMMUTABLE`. `structured_value_in_excerpt` gọi `extraction_norm` nên để `STABLE` cho an toàn.
- **Hàm nội bộ bị thu quyền** (`REVOKE … FROM PUBLIC`) vẫn được các hàm `SECURITY DEFINER` gọi,
  vì chúng chạy với quyền chủ sở hữu.
- **`key` để remount component React.** `<StructuredFields key={type.id}>` tạo lại ô nhập khi đổi
  loại, nên số của loại cũ không bị mang sang loại mới.
- **Server action dùng chung hàm kiểm hình dạng** (`readStructured`). Database vẫn là nơi quyết định.

## Bảo mật

- `set_fact_type()`: kiểm `facts.review`; dùng cùng khóa với `review_fact` nên đổi loại và quyết
  định không chen nhau; chỉ thông tin `proposed`.
- `fact_type_changes`: không ai sửa hay xóa được qua API; khách không đọc được; biên tập viên đọc được.
- Ghi chú AI (`adjustments`) chỉ biên tập viên thấy (RLS `extraction_items_editors`).

## Lỗi thường gặp

- Nhập số tiền mà thiếu tiền tệ hoặc kỳ → "chưa đúng kiểu". Bỏ trống hết, hoặc nhập đủ cả ba.
- Gắn loại "Chương trình" cho thông tin không gắn chương trình → không có trong danh sách chọn.
  Database cũng từ chối (`facts_type_entity_mismatch`).
- Bấm "Lưu loại" mà không đổi gì → "giống hệt hiện tại".
- Muốn đổi loại của thông tin **đã duyệt** → chưa làm được (Q3). Cách đúng là gỡ / thay thế, sẽ
  làm sau.

## Cách kiểm tra

- `npx vitest run lib/extraction lib/compare "app/(app)/facts"` (apps/web) và `npx vitest run` (extractor).
- Thử tay sau khi chạy migration:
  1. mở `/facts/workspace`, chọn đề xuất "two years" của SU;
  2. ở "Loại thông tin", chọn **Thời lượng**, để trống con số, bấm "Lưu loại";
  3. duyệt → trang chương trình hiện "Thời lượng: two years".

## Thứ tự đọc code

1. migration (đọc `structured_value_fits` trước) → 2. `fact-types.database.test.ts` →
3. `extractor/src/prompt.ts` → 4. `app/(app)/facts/workspace/forms.tsx` (`FactTypeForm`) →
5. `actions.ts` (`setFactType`).
