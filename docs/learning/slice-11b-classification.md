# Slice 11b — Phân loại chương trình theo ngành và hướng nghề (2026-10-07)

## Đã làm gì

- Migration `20261007090000_programme_classifications`: bảng `programme_classifications` và
  `classification_reviews`, hàm `propose_classification()`, `review_classification()` và hàm phụ
  `url_host()`.
- Trang `/education/workspace` có thêm loại thứ ba **"Phân loại ngành / hướng nghề"**:
  - form đề xuất: chọn chương trình → ngành ISCED-F hoặc hướng nghề → tài liệu → trích đoạn;
  - các tab Chờ duyệt / **Cần duyệt lại** / Đã duyệt / Từ chối;
  - mỗi dòng có trích đoạn, tài liệu, tiêu chí hướng nghề và ô quyết định.
- Số phân loại đang chờ được cộng vào khu "Trường & chương trình" ở thanh các bước duyệt và vào
  số tổng trên header.

## Vì sao thiết kế như vậy

- **Cùng khuôn với Slice 5** (trường, chương trình): đề xuất bất biến có tài liệu và trích đoạn,
  người có `facts.review` duyệt hoặc từ chối, sửa sai bằng cách từ chối rồi đề xuất lại. Không có
  đường sửa tại chỗ (AGENTS.md §1.3, §4.3).
- **Hai khóa ngoại thật + ràng buộc "đúng một"** thay cho cặp `target_type/target_id` không kiểu
  (AGENTS.md §4.5).
- **Trích đoạn phải từ website của chính chương trình**: so tên miền của tài liệu với trang chính
  thức của chương trình (bỏ "www.", chấp nhận tên miền con). Trang tổng hợp như danh sách khóa học
  của bên thứ ba bị từ chối, vì phân loại phải dựa trên điều trường tự công bố.
- **Phiên bản tiêu chí**: phân loại theo hướng nghề lưu phiên bản tiêu chí mà người duyệt đã đối
  chiếu. Khi admin sửa tiêu chí (phiên bản mới), phân loại cũ không tự đổi mà vào tab "Cần duyệt
  lại". Người duyệt chọn "Vẫn khớp tiêu chí mới" (lưu phiên bản mới) hoặc "Gỡ phân loại".
- **Chỉ thạc sĩ / tiến sĩ đã duyệt**, theo quyết định phạm vi 2026-10-03.

## Luồng hoạt động

```
Biên tập viên (education.manage)
  /education/workspace?kind=classification → ClassificationForm
     (chọn chương trình → form chỉ hiện tài liệu cùng website; chọn hướng nghề → hiện tiêu chí)
  → proposeClassification (Server Action) → propose_classification()  [status = proposed]

Người duyệt (facts.review)
  tab Chờ duyệt → ClassificationReviewForm → reviewClassification → review_classification()
     reviewed: lưu phiên bản tiêu chí hiện tại | rejected
  admin sửa tiêu chí hướng nghề (phiên bản tăng)
  tab Cần duyệt lại → "Vẫn khớp tiêu chí mới" (revalidated) | "Gỡ phân loại" (rejected)
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261007090000_programme_classifications/migration.sql` | bảng, RLS, hai hàm |
| `apps/web/lib/taxonomy/domain.ts` | `urlHost`, `sameSite`, `isStale`, `classifiableFields`, `classificationError` |
| `apps/web/app/(app)/education/workspace/classifications.tsx` | danh sách, tab, lịch sử, nạp dữ liệu cho form |
| `apps/web/app/(app)/education/workspace/forms.tsx` | `ClassificationForm`, `ClassificationReviewForm` |
| `apps/web/app/(app)/education/workspace/actions.ts` | `proposeClassification`, `reviewClassification` |
| `apps/web/lib/review/pending-counts.ts` | đếm phân loại đang chờ |

## Khái niệm Next.js / React / TypeScript

- **Server component async lồng nhau**: `ClassificationSection` và `ProposeClassification` tự nạp
  dữ liệu. `page.tsx` rẽ nhánh sớm khi `kind=classification` nên các truy vấn của trường/chương
  trình không chạy.
- **Test component async lồng nhau**: `renderToStaticMarkup` không chờ được, phải dùng
  `prerender` từ `react-dom/static`. React chèn `<!-- -->` giữa các đoạn chữ, test bỏ đi trước khi so.
- **Một nút, hai nghĩa**: `ReviewPanel` luôn gửi `decision=reviewed|rejected`. Với dòng "cần
  duyệt lại", form gửi thêm `mode=revalidate` và Server Action đổi `reviewed` thành `revalidated`.
  Database vẫn tự kiểm tra lại mọi điều kiện.
- **Lọc theo cột của bảng nối**: `programmes!inner(...)` cùng `.ilike("programmes.name", …)`
  để tìm phân loại theo tên chương trình.

## Bảo mật

- Ghi chỉ qua hai hàm `SECURITY DEFINER`, có kiểm `education.manage` / `facts.review`. Không có
  quyền `UPDATE`/`INSERT` trực tiếp. `url_host()` không gọi được qua API.
- RLS công khai: chỉ phân loại đã duyệt, khi chương trình đang công khai và hướng nghề còn dùng.
  Điều kiện dựa trên RLS của chính bảng `programmes` và `career_paths` (truy vấn con chạy với
  quyền người đọc), nên không thể lệch nhau.
- Lịch sử quyết định chỉ biên tập viên và người duyệt đọc được.

## Lỗi thường gặp

- **Tách mảng chuỗi như cặp**: `["proposed", …].map(([v]) => v)` vẫn biên dịch được nhưng chỉ lấy
  chữ cái đầu. Lỗi này từng làm tab "Đã duyệt" của ba trang biên tập không mở được (sửa cùng
  slice này, có test hồi quy `app/(app)/review-workspaces.test.tsx`).
- Lọc "cần duyệt lại" bằng PostgREST: không so sánh được hai cột, nên phải đọc (có giới hạn) rồi
  lọc trong code.

## Cách kiểm tra

- `npx vitest run lib/taxonomy "app/(app)/education" "app/(app)/review-workspaces.test.tsx"`.
- Thử tay trên dev:
  1. duyệt một chương trình thạc sĩ;
  2. nhập trang chương trình đó làm tài liệu;
  3. đề xuất phân loại "0613" và một hướng nghề, rồi duyệt;
  4. ở `/admin/taxonomy`, sửa tiêu chí hướng nghề;
  5. quay lại tab "Cần duyệt lại".

## Thứ tự đọc code

1. migration → 2. `lib/taxonomy/classification.database.test.ts` → 3. `lib/taxonomy/domain.ts`
(phần 11b) → 4. `classifications.tsx` → 5. `forms.tsx` → 6. `actions.ts`.
