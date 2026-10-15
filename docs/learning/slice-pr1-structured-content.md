# PR 1 — Nội dung có cấu trúc, song song với văn bản (2026-10-15)

> Thiết kế (bản 2, đã duyệt): `docs/architecture/pr1-structured-content-plan.md`.
> Kết quả trang thật: `docs/architecture/pr1-real-world-results.md` (**80/80 đạt: SU + KTH**).
> Nhánh: `extraction/pr-1-structured-content`. Linear: KHLOE-161.

## Đã làm gì

- `crawler/src/structure.ts`: `extractStructure(html, selector, pageUrl)`, hàm thuần, định dạng
  `html-structure-v1`, gồm:
  - tiêu đề theo cấp, khối văn bản kèm mục, cặp nhãn–giá trị (`dl`, hàng bảng `th`/`td`, nhãn ngắn +
    giá trị), bảng, link tuyệt đối;
  - JSON-LD qua adapter `json-ld`;
  - `ref` + `domPath` cho từng phần tử;
  - giới hạn, có đếm phần bị bỏ.
- `crawler/src/extract.ts`: tách `contentRoot()` và `NOISE` dùng chung. **Văn bản và mã băm không đổi**
  (3 snapshot mốc PR 0).
- `crawler/src/crawl.ts` + `db.ts`: sau khi ghi tài liệu (`created` / `unchanged`), lưu snapshot cấu trúc
  qua `crawler_record_structure()`. Lỗi được ghi log, lần chạy thành `partial`, văn bản vẫn được lưu.
- Migration `20261016090000_document_structures`: bảng `document_structures` (có lịch sử) + hàm cho
  crawler.
- `crawler/scripts/snapshot.ts`, `real-check.ts`, `crawler/test/real/expectations.json`: nghiệm thu
  trang thật; HTML thật chỉ nằm trên máy (git bỏ qua).

## Vì sao thiết kế như vậy

- **Văn bản phẳng làm mất cấu trúc.** `Tuition feeFirst instalment…`, `1Sample Foundations10`: nhãn
  dính giá trị, ô bảng dính nhau, mất link. Luật trích xuất (PR 2) cần biết "đây là nhãn, kia là giá trị".
- **Không đụng văn bản cũ.** Văn bản quyết định "trang đổi chưa" và cờ "Nguồn đã đổi". Đổi nó sẽ làm
  mọi trang thành "đã đổi" ở lần crawl sau. Cấu trúc là phần **thêm**, lưu riêng.
- **Snapshot có lịch sử, không ghi đè.** Tài liệu mới chỉ sinh ra khi **chữ** đổi. Link PDF mới hay bảng
  sắp xếp lại mà chữ giữ nguyên thì không có tài liệu mới, nên cấu trúc phải có dòng riêng mỗi khi nó
  đổi, nếu không sẽ cũ mãi.
- **Hash do database tính.** `sha256(structure::text)`; jsonb tự sắp xếp khóa, nên cùng nội dung là cùng
  hash dù crawler gửi khóa theo thứ tự nào. Crawler không thể "nói dối" về hash.
- **Không đọc JSON trạng thái trong `<script>`.** Chỉ đọc chữ người xem thấy và JSON-LD (dữ liệu công bố
  có chủ đích cho máy). Adapter khác phải được duyệt riêng.

## Luồng

```
crawler: GET (robots, origin, loại, cỡ) → Chromium vẽ trang → HTML
  ├─ extractPage(html)      → văn bản → sha256-text-v1 → crawler_record() → documents / document_texts   (như cũ)
  └─ extractStructure(html) → JSON   → crawler_record_structure(run, document, format, json, captured_at)
                                        ├─ tài liệu phải do chính lần chạy này vừa ghi
                                        ├─ khóa theo tài liệu (advisory lock)
                                        ├─ hash do database tính; trùng bản mới nhất → "unchanged"
                                        └─ khác → dòng mới (lịch sử) → "created"
```

## File quan trọng

| File | Vai trò |
|---|---|
| `crawler/src/structure.ts` | Bộ trích cấu trúc |
| `crawler/src/structure.test.ts` | 11 test: cặp, bảng, `dl`, mục, truy vết, JSON-LD, ổn định hash, giới hạn |
| `packages/db/prisma/migrations/20261016090000_document_structures/migration.sql` | Bảng + hàm + RLS |
| `apps/web/lib/crawler/database.test.ts` | Lịch sử snapshot, hai lần chạy cùng lúc, từ chối, RLS, hồi quy A → B → A |
| `crawler/scripts/real-check.ts` | Nghiệm thu trang thật; thiếu thì báo FAIL |

## Khái niệm cần biết

- **`ref` vs `domPath`.** `ref` (`p11`) là định danh trong **một** snapshot; bằng chứng về sau lưu
  `structure_id + ref`. `domPath` (`main>div:nth-of-type(8)>span:nth-of-type(1)`) để người đọc tìm lại
  phần tử. Nó chỉ dùng thẻ và vị trí, không dùng class/id (hay đổi giữa các lần tải trang).
- **Bản chụp đến không đúng thứ tự.** Hai lần chạy có thể ghi bản chụp cũ **sau** bản mới. Vì thế:
  - (1) "bản mới nhất" chỉ đọc qua view `document_structures_latest` (sắp theo `captured_at`, rồi
    `created_at`, rồi `id`, đều giảm dần): bản cũ đến muộn không bao giờ thành bản mới nhất, và mọi chỗ
    đọc thống nhất một kết quả;
  - (2) bản chụp mới được so với bản **đứng ngay trước nó theo thời gian**, nên bản cũ đến muộn mà giống
    bản trước nó thì không sinh dòng thừa.
- **`pg_advisory_xact_lock`.** Khóa theo khóa số tự chọn (ở đây là hash của id tài liệu), tự nhả khi
  giao dịch kết thúc. Hai lần chạy cùng ghi một tài liệu sẽ xếp hàng, nên không có chuyện cả hai cùng
  thấy "đã đổi" và ghi hai lần.
- **jsonb chuẩn hóa thứ tự khóa.** `'{"b":1,"a":2}'::jsonb::text` = `{"a": 2, "b": 1}`, nên hash ổn định.
- **Chỉ `<br>` và `<pre>` tạo dòng mới.** Xuống dòng trong mã nguồn HTML chỉ là khoảng trắng, nếu
  không thì định dạng lại mã nguồn trang cũng làm đổi cấu trúc và hash.
- **Điều kiện "không có" phải có đối tượng.** `real-check` báo FAIL nếu chuỗi kiểm "không có trong cấu
  trúc" vốn không có trong HTML, vì khi đó nó không chứng minh được gì.
- **Heuristic cặp nhãn–giá trị.** Nhãn ngắn (≤ 60 ký tự), không có chữ số, không kết thúc câu, không tự
  chứa "Nhãn: giá trị"; loại trừ danh sách và điều khiển biểu mẫu. Cặp loại này có `from: "label_value"`
  để luật PR 2 tự quyết có tin hay không.

## Bảo mật

- `document_structures` có RLS giống `document_texts`: chỉ biên tập viên đọc; không ai ghi trực tiếp
  (kể cả admin).
- Vai trò crawler chỉ có thêm quyền gọi `crawler_record_structure()`, không có quyền bảng.
- HTML trang thật không vào repo (repo public, AGENTS.md §8).

## Lỗi thường gặp

- `structure_failed` trong log: thường do chưa chạy migration. Văn bản vẫn được lưu.
- `real-check` báo FAIL "missing": chưa chạy `npm run snapshot` cho trang đó trên máy này.
- `crawler_invalid` với `captured_at` ở tương lai: đồng hồ máy chạy crawler sai.

## Cách kiểm tra

- `npm test -w @nordic/crawler`; `npx vitest run lib/crawler lib/db-schema-drift.test.ts` (apps/web).
- Trang thật:
  1. `npm run snapshot -w @nordic/crawler -- su-sprom-ht2027 "<url>"`;
  2. `npm run real-check -w @nordic/crawler`.

## Thứ tự đọc code

1. `structure.ts` (đọc `walk` và `isLabel`) → 2. `structure.test.ts` → 3. migration →
4. `crawl.ts` (đoạn "PR 1") → 5. `scripts/real-check.ts`.
