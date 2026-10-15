# PR 1.5 — Xem cấu trúc trang (chỉ đọc) trong admin (2026-10-15)

> Kế hoạch đã duyệt: `docs/architecture/pr1.5-structure-preview-plan.md` (mục 9: 8 yêu cầu bổ sung).
> Nhánh: `extraction/pr-1.5-structure-preview`, dựa trên PR 1. Linear: KHLOE-163.
> Ảnh chụp (dữ liệu tổng hợp): `docs/architecture/pr1.5-screens/`.

## Đã làm gì

- Trang mới `/admin/crawler/documents/[id]`: xem những gì crawler đọc được từ một tài liệu, gồm:
  - tổng quan, cặp nhãn–giá trị, khối, bảng, link, JSON-LD;
  - so sánh với snapshot khác, của chính phiên bản này hoặc của phiên bản khác cùng trang;
  - Inspector cho từng phần tử, mở bằng `?ref=`;
  - khung "thông tin đã chuẩn hóa" (facts) tách riêng.
- Ba lối vào trang:
  - Inspector URL ở `/admin/crawler`: link "Xem cấu trúc", hoặc dòng "Chưa crawl thành công lần nào";
  - các dòng trong một lần chạy;
  - `/documents/[id]`, dành cho người biên tập và người vận hành crawler.
- Kiểu `DocumentStructure` chuyển sang `@nordic/db/document-structure`, dùng chung cho crawler (bên ghi)
  và web (bên đọc). Thêm `isStructureV1()` để kiểm hình dạng dữ liệu trước khi hiển thị.

## Vì sao thiết kế như vậy

- **Chỉ đọc.** Không form, không server action, không API, không migration. Trang chỉ để kiểm tra việc
  trích xuất trước khi viết luật ở PR 2.
- **RLS quyết dữ liệu, trang chỉ chọn thông báo.** Mọi truy vấn dùng client của chính người xem
  (`accessContext()`), không có service role. Cổng vào trang là `crawler.manage` **hoặc** một quyền đọc
  cấu trúc. Như vậy người chỉ có `crawler.manage` vào được, xem được các lần crawl, nhưng RLS giấu cấu
  trúc. Trang nói rõ "cần quyền …" thay vì "chưa có cấu trúc", để không nhầm thiếu quyền với thiếu dữ liệu.
- **Ba trạng thái tách bạch** (`previewState`):
  1. không do crawler lấy;
  2. do crawler lấy nhưng chưa có snapshot (crawl trước PR 1, hoặc lưu lỗi; người vận hành thấy thêm 3
     lần crawl gần nhất kèm ghi chú lần chạy);
  3. có cấu trúc.
- **"Mới nhất" chỉ có một định nghĩa:** view `document_structures_latest` của PR 1. Trang không tự sắp xếp.
- **So sánh theo nội dung.** `ref`/`domPath` chỉ ổn định trong một snapshot; một thẻ `div` thêm vào đầu
  trang sẽ đổi hết. Nên `diffStructures` khớp cặp theo *mục + nhãn*, link theo *href + chữ*, khối và tiêu
  đề theo chữ (đếm lặp, không gộp).
- **Dữ liệu thô khác dữ liệu chuẩn hóa.** Có cảnh báo "NỘI DUNG THÔ" ở đầu trang; facts nằm trong một
  khung nền khác, có link sang màn hình ghép.

## Luồng

```
/admin/crawler/documents/[id]?tab=&q=&section=&ref=&snapshot=&compare=
  accessContext()            -> client của người xem + quyền
  canOpenPreview(perms)      -> không: NoAccess
  loadPreviewDocument()      -> không có: 404
  ingestion_method ≠ crawler -> trạng thái "không do crawler lấy" (dừng, không đọc gì thêm)
  loadPreview()              -> versions, snapshots, facts, (crawl attempts nếu crawler.manage),
                                current (theo id + document_id, hoặc view latest),
                                compare (theo id, chỉ trong các phiên bản của trang này)
  previewState()             -> no_access | missing | available
  isStructureV1()            -> không: JSON thô + cảnh báo
  filterStructure / diffStructures -> các tab
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/src/document-structure.ts` | Kiểu dùng chung + `isStructureV1` |
| `apps/web/lib/crawler/structure-view.ts` | Hàm thuần: quyền, trạng thái, lọc, so sánh |
| `apps/web/lib/crawler/structure-queries.ts` | Mọi câu SELECT (`server-only`) |
| `apps/web/components/crawler/structure-preview.tsx` | Các tab và Inspector, chỉ dùng component sẵn có |
| `apps/web/app/(app)/admin/crawler/documents/[id]/page.tsx` | Trang, đọc tham số URL, ghép các phần |

## Khái niệm Next.js

- **Trạng thái trong URL** (`?tab`, `?ref`, `?compare`…): trang là Server Component, không cần state phía
  client. Link nào cũng chia sẻ được, và nút Back hoạt động.
- **Form GET để lọc:** `<form method="get">` gửi `q`/`section` lên URL. Các tham số khác giữ qua
  `<input type="hidden">`.
- `notFound()` cho id sai định dạng, tài liệu không có, hoặc `?snapshot=` không thuộc tài liệu.
- `PageProps<"/admin/crawler/documents/[id]">` do `next typegen` sinh ra.

## Khái niệm TypeScript

- **Type guard** `isStructureV1(v): v is DocumentStructure`: dữ liệu `jsonb` đến từ DB có kiểu `unknown`;
  phải kiểm rồi mới thu hẹp kiểu.
- `(typeof TABS)[number]` lấy union `"overview" | "pairs" | …` từ mảng `as const`.

## Bảo mật

- Không service role; test kiểm (sau khi bỏ comment) rằng mã không có `service_role`,
  `@supabase/supabase-js`, `process.env`, hay `.insert/.update/.delete/.rpc(`.
- View `security_invoker`: chạy với quyền người gọi, nên không mở rộng quyền (test PGlite).
- JSON-LD và mọi chữ từ trang được React in ra dưới dạng chữ, không dùng `dangerouslySetInnerHTML`. Có test
  với chuỗi `<script>`.
- So sánh chỉ lấy snapshot thuộc các phiên bản của **cùng trang** (`in document_id`). Không kéo được
  snapshot của tài liệu khác qua `?compare=`.

## Lỗi hay gặp

- Viết component bên trong một component khác (ESLint `react-hooks/static-components`): đưa ra ngoài.
- Kiểm `parts.some(Boolean)` trên mảng JSX: phần tử JSX luôn truthy, nên phải kiểm độ dài dữ liệu.
- Assertion "rỗng" trên tab mặc định: tab Tổng quan không hiện cặp, nên test "không có trong khung facts"
  phải mở tab Cặp trước, nếu không assertion đúng một cách vô nghĩa.

## Cách test

- `npx vitest run "app/(app)/admin/crawler/documents"`: render trang với client Supabase giả có ghi lại
  truy vấn. Dữ liệu là đầu ra thật của `extractStructure` trên fixture tổng hợp.
- `npx vitest run lib/crawler/structure-preview.database.test.ts`: PGlite + toàn bộ migration. Mỗi vai
  trò (Administrator, Editor, AI Draft, chỉ `crawler.manage`, Member) chạy các câu SELECT của trang dưới
  RLS thật.
- Thử thật trên SU/KTH: **chỉ sau khi** migration PR 1 được duyệt và chạy, và crawler chạy một lần.

## Thứ tự đọc code

1. `packages/db/src/document-structure.ts`
2. `apps/web/lib/crawler/structure-view.ts` + test
3. `apps/web/lib/crawler/structure-queries.ts`
4. `apps/web/app/(app)/admin/crawler/documents/[id]/page.tsx`
5. `apps/web/components/crawler/structure-preview.tsx`
6. `page.test.tsx`, `structure-preview.database.test.ts`
