# Slice 11a — Danh mục ngành học và hướng nghề (2026-10-07)

## Đã làm gì

- **Hai chiều phân loại** cho chương trình học, chuẩn bị cho 11b (phân loại) và 11c (bộ lọc):
  - **Ngành học**: cây ISCED-F 2013 của UNESCO (12 lĩnh vực rộng → 58 hẹp → 149 chi tiết).
  - **Hướng nghề**: nhóm do Nordic tự định nghĩa (ví dụ PO/PM, Business Analyst), không giới hạn số
    lượng, quản lý trên giao diện.
- Migration `20261006090000_taxonomy`: quyền `taxonomy.manage`, bảng `study_fields`,
  `career_paths`, `career_path_versions`, hàm `save_career_path()` và `import_study_fields()`.
- File dữ liệu `docs/data/isced-f-2013.csv` (chép từ PDF chính thức, **chờ đối chiếu**) và
  `docs/data/isced-f-2013.md` (nguồn, mã băm, cách đối chiếu và nhập).
- Script vận hành `scripts/import-isced.ts`.
- Trang quản trị `/admin/taxonomy`: tab Hướng nghề (bảng + khung chi tiết + lịch sử phiên bản)
  và tab Ngành học (cây chỉ đọc, có tìm kiếm).

## Vì sao thiết kế như vậy

- **Không ghi danh mục chính thức theo trí nhớ** (AGENTS.md §1). ISCED-F chỉ vào database qua một
  đường: CSV có số trang cho từng dòng → người đối chiếu ký tên từng dòng → script nhập. Hàm SQL
  kiểm tra lại mọi quy tắc, nên một file sửa tay sai vẫn bị chặn.
- **Mỗi mã ngành trỏ về tài liệu nguồn** (`document_id`) và script so mã băm SHA-256 của tài liệu
  với PDF đã dùng để chép. Người xem luôn lần được về đúng file gốc (AGENTS.md §23).
- **Không ghi đè**: nhập lại một mã đã có với tên khác thì dừng (`taxonomy_conflict`), giống quy tắc
  "không lặng lẽ giải quyết mâu thuẫn" (AGENTS.md §1.4, §4.3).
- **Hướng nghề có phiên bản**: sửa định nghĩa/tiêu chí/từ khóa thì `version + 1` và lưu một dòng
  vào `career_path_versions`. Ở 11b, mỗi lần phân loại sẽ ghi phiên bản tiêu chí lúc đó, nên đổi
  tiêu chí không làm thay đổi ý nghĩa của các quyết định cũ. Đổi tên hoặc ngừng dùng thì không tạo
  phiên bản (không đổi ý nghĩa).
- **Hướng nghề luôn ghi rõ là của Nordic** (AGENTS.md §15): form và trang đều có dòng "không phải
  ngành học chính thức".
- **Hai thứ tiếng bắt buộc** cho tên và định nghĩa hướng nghề (chủ dự án quyết 2026-10-07), vì web
  đã song ngữ. Với ngành học: tên tiếng Anh là của UNESCO, tên tiếng Việt là bản dịch của Nordic.

## Luồng hoạt động

```
PDF của UIS ──(Claude chép, kèm số trang)──▶ isced-f-2013.csv
     │                                            │ chủ dự án đối chiếu, điền verified_by/on
     ▼                                            ▼
/documents/import (lưu PDF làm tài liệu) ──▶ node scripts/import-isced.ts <uuid> [--write]
                                                  │ kiểm tra CSV, chữ ký, mã băm
                                                  ▼
                                   import_study_fields() (chỉ chủ DB chạy được)
                                                  ▼
                                   study_fields  ──▶  /admin/taxonomy?tab=fields

Admin (taxonomy.manage) ──form──▶ saveCareerPath (Server Action)
   ──▶ save_career_path() (kiểm quyền, khóa key, tạo phiên bản, ghi access_audit)
   ──▶ career_paths + career_path_versions ──▶ /admin/taxonomy
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261006090000_taxonomy/migration.sql` | bảng, RLS, hai hàm |
| `packages/db/prisma/schema.prisma` | model `StudyField`, `CareerPath`, `CareerPathVersion` |
| `apps/web/lib/taxonomy/isced-csv.ts` | đọc và kiểm tra CSV (dùng chung cho script và test) |
| `apps/web/lib/taxonomy/domain.ts` | dựng cây, tìm kiếm không dấu, tên theo ngôn ngữ, đọc từ khóa, thông báo lỗi |
| `scripts/import-isced.ts` | script nhập của người vận hành |
| `apps/web/app/(app)/admin/taxonomy/{page,forms,actions}.tsx` | trang quản trị |
| `docs/data/isced-f-2013.{csv,md}` | dữ liệu và hướng dẫn đối chiếu |

## Khái niệm Next.js / TypeScript / Node

- **Route types của Next**: `PageProps<"/admin/taxonomy">` chỉ hợp lệ sau khi Next sinh kiểu cho
  route mới. Thêm trang mới thì chạy `npx next typegen` (hoặc `next dev` / `next build`) trước `tsc`.
- **Node 24 chạy TypeScript trực tiếp** (type stripping): `node scripts/import-isced.ts` không cần
  biên dịch. Vì vậy `isced-csv.ts` chỉ dùng cú pháp TypeScript "xóa được" (kiểu, không có `enum`)
  và không import qua alias `@/…`.
- **Cây đệ quy trong React**: `FieldTree` tự gọi lại chính nó cho `children`.

## Bảo mật

- `import_study_fields()` bị thu hồi quyền chạy với mọi vai trò API (`anon`, `authenticated`,
  `service_role`), giống `bootstrap_administrator()`. Chỉ người có chuỗi kết nối database chạy được.
- Không ai ghi trực tiếp vào bảng qua API; ghi hướng nghề chỉ qua `save_career_path()`, có kiểm
  `taxonomy.manage` và ghi `access_audit`.
- RLS tách hai policy cho `career_paths` (công khai: chỉ `active`; biên tập viên: tất cả), vì
  `anon` không được gọi `has_permission()`.

## Lỗi thường gặp

- Viết một policy chung `USING(active OR has_permission(...))` cho cả `anon`: truy vấn của khách
  báo `permission denied for function has_permission`. Cách đúng: hai policy.
- Quên `npx next typegen` sau khi thêm trang → `tsc` báo route không thuộc `AppRoutes`.
- Test trang có `Inspector` mà không mock `@/components/key-nav` → lỗi "app router to be mounted".
- Sửa CSV bằng Excel rồi lưu sai mã hóa: phải lưu **CSV UTF-8**, nếu không tên tiếng Việt hỏng.

## Cách kiểm tra

- `npx vitest run lib/taxonomy "app/(app)/admin/taxonomy"`: CSV thật đọc được và đủ 219 mã; nhập
  bị từ chối khi chưa ký, sai cấp, thiếu cha, trùng mã, ngày tương lai, tài liệu không tồn tại; API
  không chạy được hàm nhập; nhập lại không trùng; đổi tên bị chặn; quyền, phiên bản và RLS của
  hướng nghề; trang và form ở hai ngôn ngữ.
- Thử tay: cấp `taxonomy.manage` (vai trò Administrator đã có sẵn), mở `/admin/taxonomy`, tạo một
  hướng nghề, sửa tiêu chí và xem lịch sử phiên bản.
- `node scripts/import-isced.ts <uuid>` khi CSV chưa ký: báo 219 dòng chưa đối chiếu, không ghi gì.

## Thứ tự đọc code

1. `docs/data/isced-f-2013.md` → 2. migration → 3. `lib/taxonomy/database.test.ts` →
4. `lib/taxonomy/isced-csv.ts` và `scripts/import-isced.ts` → 5. `lib/taxonomy/domain.ts` →
6. `app/(app)/admin/taxonomy/page.tsx`, `forms.tsx`, `actions.ts`.
