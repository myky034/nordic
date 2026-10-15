# PR 1.5 — Xem trước cấu trúc trích xuất trong admin (kế hoạch, chờ duyệt)

> **Trạng thái:** **đã duyệt** (2026-10-15): Q1 đồng ý, Q2 = **A** (giữ nguyên RLS), Q3, Q4 đồng ý, kèm 8
> yêu cầu bổ sung (mục 9). Linear: KHLOE-163.
> Nhánh dự kiến: `extraction/pr-1.5-structure-preview`, tách từ `extraction/pr-1-structured-content`.
> Phụ thuộc: PR 1 (bảng `document_structures`, view `document_structures_latest`).
> Ngoài phạm vi: sửa luật, AI trích xuất, ghi dữ liệu, L7b, PR 2, thay đổi hạ tầng.

## 1. Mục tiêu

Người có quyền xem được **chính xác crawler đã trích ra gì** từ một trang, ngay trong admin crawler hiện
có, với đầy đủ dấu vết:
- `ref`, `domPath`, `section`;
- `captured_at`, `format_version`, `structure_hash`.

Màn hình chỉ đọc. Nó **tách bạch** nội dung thô crawler đọc được với thông tin chương trình đã chuẩn hóa
(`facts`).

## 2. Giao diện và luồng thao tác

### 2.1 Lối vào (dùng lại trang hiện có)

- `/admin/crawler`:
  - tab **URL**: Inspector của một URL thêm link **"Xem cấu trúc"**, trỏ tới tài liệu mới nhất của URL đó
    (`crawl_url_states.last_document_id`);
  - tab **Lần chạy**: mỗi dòng kết quả có `document_id` thêm link **"Xem cấu trúc"**.
- `/documents/[id]` (biên tập viên): thêm link **"Xem cấu trúc"** cạnh "Ghép thông tin".

### 2.2 Trang mới `/admin/crawler/documents/[id]`

```
┌ Admin › Crawler › Cấu trúc trang ───────────────────────────────────────────────┐
│ SPROM - Stockholms universitet · su.se · ↗ trang gốc                            │
│ ⓘ Đây là NỘI DUNG THÔ crawler đọc được, chưa phải thông tin đã chuẩn hóa/duyệt. │
├─ Snapshot ──────────────────────────────────────────────────────────────────────┤
│ [● Mới nhất · 15/10 10:45 · html-structure-v1 · 9f3a…c21 ▾]  So sánh với: [▾]   │
│ Phiên bản trang: 14/10 (chữ khác) · 15/10 ← đang xem                            │
├─ [Tổng quan] [Cặp nhãn–giá trị 14] [Khối 72] [Bảng 0] [Link 23] [JSON-LD 0] ─────┤
│ Lọc: [ tuition        ]  Mục: [Tất cả ▾]                                        │
│ ┌ ref ─┬ nhãn ─────────┬ giá trị ─────────────────────┬ mục ─────────┬ nguồn ──┐  │
│ │ p11  │ Tuition fee   │ Applies to … 67500 SEK …    │ Autumn 2027… │ label_… │  │
│ └──────┴───────────────┴─────────────────────────────┴──────────────┴─────────┘  │
│  (bấm một dòng → Inspector: domPath, labelPath, valuePath, section đầy đủ, JSON)│
├─ Thông tin đã chuẩn hóa từ trang này (facts) ── tách riêng, nền khác ───────────┤
│ Học phí · 135 000 SEK / toàn khóa · đã duyệt   |  Thời lượng · two years · …   │
│ → mở /facts/map/[id]                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Phần đầu:** tài liệu (tiêu đề, nguồn, URL gốc, ngày lấy), kèm `Notice` "nội dung thô".
- **Chọn snapshot:** lịch sử của tài liệu (mới nhất đánh dấu theo view `document_structures_latest`),
  hiện `captured_at`, `format_version`, `structure_hash` (rút gọn, bấm để chép đủ), lần chạy crawler.
  Có thêm danh sách **phiên bản khác của cùng trang** (L7a: cùng nguồn + URL) để nhảy qua.
- **Tab (`Segmented` sẵn có):** Tổng quan, Cặp nhãn–giá trị, Khối, Bảng, Link, JSON-LD.
  - **Tổng quan:** số lượng từng loại, `root` (vùng đọc), `limits` (cắt bớt và số bị bỏ), `title`,
    `lang`, `canonicalUrl`.
  - **Cặp:** bảng `ref | nhãn | giá trị | mục | from` (`dl` / `th_row` / `label_value`, có chú thích
    nghĩa của từng nguồn).
  - **Khối:** `ref | loại | chữ (giữ xuống dòng) | mục | độ sâu`.
  - **Bảng:** mỗi bảng một khối, có tiêu đề cột, các hàng và ô (`t1[2][1]`).
  - **Link:** `ref | chữ | href | cùng origin | loại file`; link PDF có nhãn.
  - **JSON-LD:** JSON định dạng sẵn, chỉ đọc, kèm `adapter` và `adapterVersion`.
- **Lọc:** ô tìm chữ (nhãn, giá trị, chữ, href) và chọn mục (`section`). Lọc qua tham số URL, nên chia
  sẻ link là thấy đúng kết quả.
- **Chi tiết một phần tử:** bấm dòng → `Inspector` (slide-over sẵn có) hiện đủ
  `ref, domPath, section, labelPath/valuePath` và JSON của phần tử. `?ref=p11` dùng làm link trực tiếp.
- **So sánh:** chọn một snapshot khác (cùng tài liệu, hoặc phiên bản khác của trang) → tab **So sánh**
  liệt kê theo từng loại:
  - cặp *thêm / bỏ / đổi giá trị* (khớp theo nhãn + mục);
  - tiêu đề *thêm / bỏ*;
  - link *thêm / bỏ* (theo href);
  - khối *thêm / bỏ* (theo chữ).

  Không so `ref` / `domPath`, vì chúng chỉ ổn định trong một snapshot.
- **Thông tin đã chuẩn hóa:** khung riêng, nền khác, tiêu đề rõ "Thông tin chương trình đã chuẩn hóa
  (facts)". Liệt kê facts của **tài liệu này** (loại, giá trị cấu trúc nếu có, trạng thái), kèm link sang
  `/facts/map/[id]`. Không trộn với dữ liệu thô.
- **Trạng thái rỗng / lỗi:**
  - chưa có snapshot ("Trang này chưa có cấu trúc. Cấu trúc được tạo khi crawler chạy sau PR 1");
  - định dạng không biết (chỉ hiện JSON thô);
  - không có quyền;
  - tài liệu không tồn tại (404).

## 3. File tạo / sửa

| File | Thay đổi |
|---|---|
| `packages/db/src/document-structure.ts` **(mới)** | Kiểu `DocumentStructure` (`html-structure-v1`) + hàm kiểm hình dạng `isStructureV1()`: **một hợp đồng chung** cho crawler (ghi) và web (đọc) |
| `crawler/src/structure.ts` | Lấy kiểu từ `@nordic/db/document-structure` thay vì tự khai báo (đầu ra không đổi; test + `real-check` chạy lại) |
| `apps/web/lib/crawler/structure-view.ts` **(mới)** | Hàm thuần: lọc theo chữ / mục, gom mục, `diffStructures(a, b)`, rút gọn hash |
| `apps/web/lib/crawler/structure-queries.ts` **(mới)** | Truy vấn đọc (client RLS), dùng ở trang |
| `apps/web/app/(app)/admin/crawler/documents/[id]/page.tsx` **(mới)** | Trang xem trước (server component) |
| `apps/web/app/(app)/admin/crawler/documents/[id]/{loading,error}.tsx` **(mới)** | Như các trang admin khác |
| `apps/web/components/crawler/structure-tables.tsx` **(mới)** | Bảng cho cặp / khối / bảng / link / JSON-LD, dùng `DataTable`, `Badge`, `Inspector` sẵn có |
| `apps/web/app/(app)/admin/crawler/page.tsx` | Link "Xem cấu trúc" trong Inspector URL và dòng lần chạy |
| `apps/web/app/(public)/(explore)/documents/[id]/page.tsx` | Link "Xem cấu trúc" cho biên tập viên |
| `apps/web/lib/i18n/dictionaries/{vi,en}.ts` | Chuỗi Việt/Anh (`adminCrawler.structure`) |
| Test (mục 5) | `structure-view.test.ts`, `structure-preview.test.tsx`, cập nhật `admin/crawler/page.test.tsx` |
| `docs/learning/slice-pr1.5-structure-preview.md` **(mới)** | Tài liệu học |

**Không có migration** (trừ khi bạn chọn phương án B ở Q2). Không có server action, form ghi hay API mới.

## 4. Truy cập dữ liệu và phân quyền

- **Cách làm sẵn có:** `requireAuth()` + `accessContext()`, client Supabase của người dùng, **RLS là
  lớp quyết định**; không dùng service role.
- **Truy vấn** (chỉ đọc):
  - `documents` (tài liệu + nguồn);
  - `documents` cùng `source_id` + `canonical_url` (các phiên bản);
  - `document_structures` (danh sách snapshot: `id, format_version, structure_hash, captured_at,
    crawler_run_id`, **không** kèm JSON);
  - **một** snapshot đầy đủ: theo `?snapshot=` hoặc bản mới nhất qua **`document_structures_latest`**;
  - snapshot so sánh (nếu chọn);
  - `facts` của tài liệu (cho khung chuẩn hóa).
- **Cổng vào trang:** cần `crawler.manage` (như `/admin/crawler`). **Dữ liệu cấu trúc** thì do RLS quyết
  định: hiện chỉ biên tập viên đọc được (`facts.propose` / `facts.review` / `documents.ingest`).
  - Người có `crawler.manage` mà thiếu các quyền này thì thấy thông báo rõ "cần quyền …", **không
    phải** trang rỗng âm thầm.
  - Đây là **câu hỏi Q2** (mục 7): giữ nguyên RLS, hay mở thêm cho `crawler.manage`.
- **Không ghi gì:** không form, không action. JSON hiển thị bằng React (escape tự động), không
  `dangerouslySetInnerHTML`. `href` hiển thị dạng chữ, link "mở" dùng `rel="noopener noreferrer"`.
- **Kiểm hình dạng** trước khi hiển thị (`isStructureV1`). Định dạng lạ thì chỉ hiện JSON thô và cảnh
  báo; không bao giờ lỗi trang.

## 5. Test và tiêu chí nghiệm thu

**Đơn vị (hàm thuần):**
1. `isStructureV1`: nhận đầu ra thật của `extractStructure` (fixture PR 0/1), từ chối JSON thiếu trường
   hoặc sai `formatVersion`.
2. Lọc theo chữ (không phân biệt hoa thường) và theo mục; giữ thứ tự gốc.
3. `diffStructures`: cặp thêm / bỏ / đổi giá trị theo nhãn + mục; link thêm / bỏ theo href; hai snapshot
   giống nhau → không có khác biệt; không dùng `ref` để so.

**Giao diện** (`renderToStaticMarkup`, mock Supabase như `admin/crawler/page.test.tsx`):

4. Không có `crawler.manage` → `NoAccess`.
5. Có `crawler.manage`, RLS trả rỗng vì thiếu quyền biên tập → thông báo "cần quyền …", không phải
   "chưa có snapshot".
6. Mặc định mở bản **mới nhất** (truy vấn đi qua view `document_structures_latest`); `?snapshot=` mở đúng
   bản đã chọn.
7. Hiện `captured_at`, `format_version`, `structure_hash`; mỗi tab hiện đủ cột (`ref`, `domPath` trong
   Inspector, `section`).
8. Tab Cặp hiện `Tuition fee`; `?q=tuition` lọc; `?ref=p11` mở Inspector đúng phần tử.
9. JSON-LD hiển thị dạng chữ (một chuỗi `<script>` trong JSON-LD không thành thẻ HTML).
10. Khung "Thông tin đã chuẩn hóa" tách riêng, có tiêu đề và nền khác; dữ liệu thô không xuất hiện trong khung.
11. Chưa có snapshot → trạng thái rỗng có giải thích; định dạng lạ → JSON thô + cảnh báo.
12. Link "Xem cấu trúc" có ở `/admin/crawler` (Inspector URL, dòng lần chạy) và `/documents/[id]`.

**Hồi quy:**

13. Toàn bộ test hiện có qua; crawler 40, `real-check` 80/80 sau khi chuyển kiểu sang `@nordic/db`;
    typecheck, lint, build sạch.

**Thử thật:** chỉ làm được **sau khi** migration PR 1 đã chạy và crawler đã chạy một lần. Database dùng
chung là production, nên bước này phụ thuộc phê duyệt migration của bạn.

## 6. Hạn chế kỹ thuật

- Không có HTML gốc (không lưu, AGENTS.md §8), nên không "tô lên trang thật" được; `domPath` chỉ là chữ
  để đọc. Muốn đối chiếu thì mở trang gốc.
- `ref` / `domPath` chỉ có nghĩa trong một snapshot. So sánh dựa trên nội dung (nhãn, href, chữ), nên
  phần tử bị đổi chữ sẽ hiện là "bỏ + thêm".
- Snapshot đến 1 MB (tới 1 000 khối, 500 link): hiển thị theo trang (phân trang sẵn có); lọc chạy ở
  server trên một snapshot.
- Chỉ đọc được `html-structure-v1`; định dạng sau này cần thêm bộ hiển thị.
- Chưa có dữ liệu thật cho tới khi migration PR 1 được chạy và crawler chạy lại.
- Màn hình hẹp (điện thoại): bảng cuộn ngang như các bảng admin khác.

## 7. Câu hỏi cần bạn quyết

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Đường dẫn `/admin/crawler/documents/[id]` và 3 lối vào ở 2.1 | **Đồng ý** |
| Q2 | Quyền đọc cấu trúc: **A.** giữ nguyên RLS (chỉ biên tập viên; người chỉ có `crawler.manage` thấy thông báo thiếu quyền), hay **B.** thêm `crawler.manage` vào policy đọc của `document_structures` (migration nhỏ, nới quyền) | **A:** không đổi RLS trong PR xem trước. Chủ dự án hiện có đủ quyền |
| Q3 | Đưa kiểu `DocumentStructure` vào `@nordic/db` làm hợp đồng chung cho crawler và web | **Đồng ý** (một nguồn sự thật cho định dạng) |
| Q4 | So sánh: snapshot cùng tài liệu **và** phiên bản khác của cùng trang | **Đồng ý** |

## 8. Các bước khi được duyệt

1. Chuyển kiểu sang `@nordic/db`; chạy lại test crawler + `real-check` (phải giữ 40 / 80).
2. `structure-view.ts` + test (1–3).
3. `structure-queries.ts`, trang, bảng, Inspector, trạng thái rỗng / lỗi / không quyền + test (4–11).
4. Lối vào ở 3 trang + test (12).
5. Chuỗi Việt/Anh, tài liệu học; chạy toàn bộ test, typecheck, lint, build; commit, push nhánh.
6. Khi migration PR 1 đã chạy: thử trên trang SU/KTH thật, chụp kết quả vào tài liệu.

## 9. Yêu cầu bổ sung khi duyệt (2026-10-15) và cách đáp ứng

| # | Yêu cầu | Cách làm |
|---|---|---|
| 1 | Vai trò được phép hiện có vào được | Vai trò thật trong database (đã kiểm, chỉ đọc): **Administrator** (mọi quyền), **Editor** (`documents.ingest`), **AI Draft** (`facts.propose`, tài khoản AI), **Member**. Không có vai trò "Reviewer" riêng; người duyệt là Administrator. **Cổng trang:** `crawler.manage` **hoặc** một trong các quyền đọc cấu trúc theo RLS (`facts.propose`, `facts.review`, `documents.ingest`). Như vậy Administrator và Editor đều vào được; dữ liệu vẫn do RLS quyết. Test PGlite theo từng vai trò: Administrator / Editor đọc được, Member không |
| 2 | Không vượt RLS bằng service role | Chỉ dùng client của người dùng (`accessContext`); có test kiểm trang không import client service role |
| 3 | Phân biệt 3 trạng thái | **(a) Chưa crawl:** tài liệu không do crawler lấy (`ingestion_method ≠ crawler`), hoặc URL chưa có tài liệu nào (trong Inspector URL hiện "chưa crawl thành công", không có link). **(b) Có tài liệu nhưng thiếu cấu trúc hoặc lưu lỗi:** tài liệu do crawler lấy nhưng không có snapshot. Người có `crawler.manage` thấy thêm lần crawl gần nhất của URL (thời điểm, kết quả, trạng thái và ghi chú lần chạy) để biết là "crawl trước PR 1" hay "lần chạy partial". **(c) Có cấu trúc** |
| 4 | Trạng thái rỗng và lỗi quyền có ý nghĩa | Thiếu quyền đọc cấu trúc thì báo **"cần quyền …"** (khác hẳn "chưa có cấu trúc"); không có quyền vào trang thì `NoAccess`; tài liệu không tồn tại thì 404; định dạng lạ thì JSON thô + cảnh báo |
| 5 | So sánh theo nội dung | `diffStructures` khớp cặp theo nhãn + mục, link theo `href`, khối và tiêu đề theo chữ; **không** dùng `ref` / `domPath`. Có test: hai snapshot cùng nội dung nhưng khác `ref` → không khác biệt |
| 6 | Giữ design system | Chỉ dùng `PageHeader`, `Segmented`, `DataTable`, `Inspector`, `Notice`, `Badge`, `EmptyState` sẵn có |
| 7 | Chỉ đọc | Không form, không server action, không API mới, không migration |
| 8 | Đưa kế hoạch lên GitHub | Kế hoạch này nằm trên nhánh `extraction/pr-1.5-structure-preview` |
