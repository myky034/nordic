# PR 1 — Nội dung có cấu trúc, song song với văn bản (thiết kế bản 2, chờ duyệt)

> **Trạng thái:** bản 2 **đã duyệt** (2026-10-15) và **đã code** trên nhánh `extraction/pr-1-structured-content`.
> **Nghiệm thu trang thật: ĐẠT 80/80** trên SU (HT2026, HT2027) và KTH (2 chương trình),
> `docs/architecture/pr1-real-world-results.md`. Chờ review. Linear: KHLOE-161.
> Khác bản thiết kế khi code: cặp lưu `labelPath` / `valuePath` (domPath) thay cho `labelRef` / `valueRef`;
> thêm loại khối `text` (chữ không nằm trong `p` / `li`…); hàm SQL nhận thêm `p_captured_at`; khóa
> chống trùng là `(document_id, format_version, structure_hash, captured_at)` + advisory lock theo tài
> liệu, để A → B → A vẫn ghi được; `<br>` giữ thành dòng riêng trong khối (phát hiện trên trang KTH).
> Nhánh dự kiến: `extraction/pr-1-structured-content`, tách từ `extraction/pr-0-audit`.
> **Ngoài phạm vi:** L7b, PR 2 (luật), extractor dùng cấu trúc, PDF, giao diện mới, database production.

## 0. Thay đổi so với bản 1

| Mục review | Bản 2 |
|---|---|
| 1. Truy vết nguồn | Mỗi phần tử có `ref` (định danh duy nhất **trong snapshot**) và `domPath` (đường dẫn DOM từ vùng đọc) (§2) |
| 2. Mở rộng dữ liệu JavaScript | Mảng `structuredData[]` có trường `adapter`; PR 1 chỉ có **một** adapter `json-ld`. Thêm adapter khác cần quyết định riêng (§2.3) |
| 3. Vòng đời phiên bản | Đã kiểm code (§3). `ON CONFLICT DO NOTHING` theo `document_id` **sẽ** giữ dữ liệu cũ, nên **bỏ**. Thay bằng **snapshot cấu trúc có lịch sử**: khóa `(document_id, format_version, structure_hash)`, đọc bản mới nhất (§4) |
| 4. Nghiệm thu trang thật | Test trên CI chỉ dùng fixture. Nghiệm thu trang thật là **lệnh riêng, thiếu snapshot thì báo lỗi, không bỏ qua**; kết quả ghi vào tài liệu và PR (§6) |

## 1. Mục tiêu

Bên cạnh văn bản đọc được (`document_texts`, **không đổi**), crawler lưu thêm biểu diễn có cấu trúc
của trang đã vẽ:
- tiêu đề, khối văn bản, cặp nhãn–giá trị, bảng, link;
- dữ liệu có cấu trúc công khai (JSON-LD).

Mỗi phần tử truy vết được về vị trí trong trang. Đây là đầu vào cho luật ở PR 2.

## 2. Định dạng `html-structure-v1`

```ts
type Ref = string;                 // "h3", "b17", "p4", "t1", "l9": duy nhất TRONG snapshot này
type DomPath = string;             // "main>aside:nth-of-type(1)>div:nth-of-type(3)", tính từ vùng đọc
type Section = string[];           // tiêu đề bao ngoài: ["Programme overview", "Year 1"]

type DocumentStructure = {
  formatVersion: "html-structure-v1";
  title: string | null;
  lang: string | null;
  canonicalUrl: string | null;     // <link rel=canonical>, chỉ khi cùng origin
  root: { kind: "selector" | "main" | "article" | "body"; selector: string | null };
  headings: { ref: Ref; domPath: DomPath; level: 1|2|3|4|5|6; text: string; section: Section }[];
  blocks:   { ref: Ref; domPath: DomPath; kind: "p"|"li"|"dd"|"blockquote"|"pre"|"summary"; text: string; section: Section; depth?: number }[];
  pairs:    { ref: Ref; domPath: DomPath; label: string; value: string; section: Section;
              from: "dl" | "th_row" | "label_value"; labelRef?: Ref; valueRef?: Ref }[];
  tables:   { ref: Ref; domPath: DomPath; section: Section; caption: string | null; headers: string[];
              rows: { cells: string[] }[] };   // ô xác định bằng ref + chỉ số hàng/cột: "t1[2][1]"
  links:    { ref: Ref; domPath: DomPath; text: string; href: string; sameOrigin: boolean; fileType: "pdf"|"doc"|null; section: Section }[];
  structuredData: { adapter: "json-ld"; adapterVersion: 1; items: unknown[] }[];
  limits: { truncated: boolean; dropped: Partial<Record<"blocks"|"pairs"|"tables"|"links"|"structuredData", number>> };
};
```

### 2.1 Truy vết (mục 1 của review)

- **`ref`** gán theo thứ tự tài liệu, tiền tố theo loại (`h`, `b`, `p`, `t`, `l`). Nó **chỉ ổn định trong
  một snapshot**; giữa hai snapshot, cùng một `ref` có thể chỉ phần tử khác. Bằng chứng ở PR 3 sẽ lưu
  **`structure_id` (snapshot cụ thể) + `ref`**, nên luôn trỏ đúng phần tử, kể cả khi trang đổi sau đó.
- **`domPath`** đọc được bằng mắt và dùng được làm selector trong snapshot, giúp người viết luật (PR 2)
  biết phần tử nằm đâu. Nó **không** được dùng làm định danh lâu dài.
- Cặp nhãn–giá trị giữ `labelRef`/`valueRef` khi lấy từ 2 phần tử riêng; ô bảng định danh bằng
  `t1[hàng][cột]`.

### 2.2 Cặp nhãn–giá trị

Chỉ lấy từ cấu trúc **tường minh**:
- `<dl><dt><dd>` → `from: "dl"`;
- hàng bảng có `<th>` + `<td>` → `from: "th_row"`;
- phần tử có đúng 2 con, con đầu là nhãn ngắn (≤ 60 ký tự, không kết thúc bằng dấu chấm câu) →
  `from: "label_value"`. Đây là heuristic, có nhãn rõ để luật PR 2 tự quyết có dùng hay không.

### 2.3 Dữ liệu có cấu trúc và JavaScript (mục 2 của review)

- PR 1 đọc **DOM đã vẽ** (chữ người xem thấy) và đúng **một** adapter: `json-ld`, tức
  `<script type="application/ld+json">` parse được. Bản hỏng thì bỏ qua, không lỗi.
- **Không** đọc JSON trạng thái trong `<script>` thường (ví dụ dữ liệu ẩn của SU), theo quyết định
  2026-10-15.
- **Điểm mở rộng:** `structuredData` là mảng có `adapter` + `adapterVersion`. Adapter mới cho dữ liệu
  **công khai có chủ đích** (ví dụ một API công khai của trường mà trang tự gọi) sẽ:
  1. là một hàm có kiểu, nằm trong repo, có test;
  2. được **cho phép theo từng nguồn** (danh sách cho phép, như `render_js`);
  3. cần quyết định ghi vào Decision Log trước khi bật.

  PR 1 **không** thêm adapter nào ngoài `json-ld` và không thêm cột cấu hình. Chỉ cấu trúc dữ liệu là
  sẵn sàng cho việc mở rộng.

### 2.4 Giới hạn

1 000 khối, 300 cặp, 50 bảng × 200 hàng × 20 cột, 500 link, 20 mục JSON-LD; mỗi chuỗi ≤ 2 000 ký tự;
toàn bộ JSON ≤ 1 MB. Vượt giới hạn thì cắt, `limits.truncated = true` và đếm số bị bỏ theo loại.
Không bao giờ cắt im lặng. Vùng đọc và danh sách phần tử nhiễu **dùng chung** với văn bản hiện tại.

## 3. Vòng đời Document / DocumentText hiện tại (mục 3 của review: đã kiểm code)

Nguồn: `crawler_record()` (migration `20260928090000_crawler`, dòng 234–247), chỉ mục unique
`documents_source_id_canonical_url_content_hash_key` (`20260918090000_documents`),
`packages/db/src/document-hash.ts`, `crawler/src/crawl.ts`.

1. **Khóa phiên bản** = `(source_id, canonical_url, content_hash)`, với `content_hash` =
   `sha256-text-v1` của **văn bản đã chuẩn hóa** (NFC, gộp khoảng trắng).
2. Văn bản đổi → **tài liệu mới** + `document_texts` mới; thông tin đã duyệt của bản cũ bị gắn cờ "Nguồn
   đã đổi". Kết quả: `created`.
3. Văn bản **không đổi**, kể cả khi HTML, link, thuộc tính, `title` hay chỉ khoảng trắng đổi →
   **không có tài liệu mới**. `document_texts` giữ văn bản lần đầu; `metadata_hash` chỉ được ghi lúc tạo
   (title đổi không được ghi nhận). Kết quả: `unchanged`; `crawl_url_states.last_document_id` trỏ về tài
   liệu đó.
4. Trang trả 304 (chỉ URL không dùng trình duyệt) → không có HTML, không có gì mới.
5. **Phát hiện mới, có từ trước, PR 1 không sửa:** trang đổi A → B rồi **quay lại A**.
   `ON CONFLICT` gặp lại tài liệu A cũ → kết quả `unchanged`, **không gắn cờ** cho thông tin đã duyệt
   trên B. PR 1 thêm **test hồi quy ghi lại hành vi này** (để không ai vô tình đổi) và đưa vào danh sách
   việc sau.

**Hệ quả cho cấu trúc:** nếu khóa cấu trúc chỉ theo `document_id` với `ON CONFLICT DO NOTHING`, thì
khi link (ví dụ link PDF mới), bảng hay thuộc tính đổi mà chữ không đổi, cấu trúc sẽ **cũ mãi mãi**.
Vì vậy bản 1 bị bỏ.

## 4. Lưu cấu trúc: snapshot có lịch sử

```sql
CREATE TABLE public.document_structures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  format_version  text NOT NULL CHECK (format_version IN ('html-structure-v1')),
  structure       jsonb NOT NULL CHECK (jsonb_typeof(structure)='object' AND pg_column_size(structure) <= 1048576),
  structure_hash  varchar(64) NOT NULL CHECK (structure_hash ~ '^[0-9a-f]{64}$'),   -- do DATABASE tính
  captured_at     timestamptz NOT NULL,                                           -- giờ lấy trang
  crawler_run_id  uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, format_version, structure_hash)
);
CREATE INDEX document_structures_latest_idx ON public.document_structures(document_id, format_version, captured_at DESC);
-- RLS giống hệt document_texts (biên tập viên đọc; không ai ghi trực tiếp).
```

Hàm `crawler_record_structure(p_run, p_document, p_format_version, p_structure, p_captured_at)`
(`SECURITY DEFINER`, chỉ `nordic_crawler_ops`):
1. lần chạy đang mở; tài liệu **vừa được chính lần chạy này ghi** (có `crawler_run_items` với
   `run_id = p_run`, `document_id = p_document`); nguồn vẫn được phép crawl;
2. kiểm phiên bản định dạng và kích thước;
3. **database tự tính** `structure_hash` = sha256 của `structure::text` (dạng jsonb đã chuẩn hóa thứ
   tự khóa), không tin giá trị từ crawler;
4. nếu snapshot **mới nhất** của `(document_id, format_version)` có cùng hash → không ghi, trả
   `unchanged`; ngược lại ghi dòng mới, trả `created`. Lịch sử được giữ, không ghi đè, không xóa.

**Đọc:** người dùng (PR 2–3) lấy snapshot **mới nhất** theo `captured_at` cho `format_version` mình hiểu.

**Ba trường hợp mục 3 của review:**

| Thay đổi | Văn bản / tài liệu | Cấu trúc |
|---|---|---|
| Chữ đổi | Tài liệu mới (như hiện nay) | Snapshot đầu tiên của tài liệu mới |
| HTML / link / thuộc tính đổi, chữ không đổi | Không đổi (`unchanged`) | **Snapshot mới** cho cùng tài liệu: không bao giờ cũ mãi |
| Không gì đổi | `unchanged` | Không ghi gì (hash trùng) |
| `title` đổi, chữ không đổi | Không đổi (giới hạn hiện có, ghi nhận) | `title` mới nằm trong snapshot mới |

**Nâng định dạng (`html-structure-v2`):**
- thêm giá trị mới vào CHECK của `format_version` (migration nhỏ);
- crawler ghi v2 **bên cạnh** v1 ở mỗi lần crawl;
- người dùng chuyển sang đọc v2 khi sẵn sàng;
- v1 giữ làm lịch sử.

Không có bước "chuyển đổi tại chỗ".

**Trích xuất lại:** hệ thống **không lưu HTML gốc** (AGENTS.md §8, repo và DB không làm bản sao trang),
nên chỉ trích xuất lại được khi **crawl lại**. Cách làm: bấm Run workflow, và mọi URL đang bật tự có
snapshot theo định dạng mới. Phiên bản tài liệu **cũ** (trang đã đổi chữ) không trích xuất lại được;
điều này được ghi nhận.

**Dung lượng:** chỉ ghi khi cấu trúc đổi, tối đa một lần mỗi URL mỗi lần crawl (hằng tuần). Trang có
link chứa mã đổi liên tục có thể sinh một snapshot mỗi tuần. Admin crawler sẽ hiện số snapshot theo
URL để phát hiện (PR 1 chỉ có truy vấn + test; chưa có giao diện).

**Gỡ:** `DROP FUNCTION crawler_record_structure(…); DROP TABLE document_structures;`. Không bảng nào phụ thuộc.

## 5. File sửa / thêm

| File | Thay đổi |
|---|---|
| `crawler/src/structure.ts` **(mới)** | `extractStructure(html, selector, pageUrl)`: hàm thuần (cheerio, đã có) |
| `crawler/src/extract.ts` | Tách `contentRoot()` và danh sách phần tử nhiễu dùng chung. **Đầu ra không đổi**: 3 snapshot mốc PR 0 |
| `crawler/src/crawl.ts` | Sau `record()` (`created` / `unchanged`, có HTML) gọi `db.recordStructure()`. Lỗi → log JSON (`operation: "structure"`, URL, loại lỗi) + lần chạy thành `partial`; văn bản vẫn lưu |
| `crawler/src/db.ts` | `recordStructure()` |
| `crawler/src/structure.test.ts` **(mới)** | Fixture PR 0 + 1 fixture mới (DOM đã vẽ có JSON-LD hợp lệ, JSON-LD hỏng, script state) |
| `crawler/src/crawl.test.ts` | Trường hợp gọi / không gọi `recordStructure`, lỗi lưu cấu trúc |
| `crawler/scripts/snapshot.ts` **(mới)** + `npm run snapshot` | Lưu HTML đã vẽ của URL bạn cung cấp vào thư mục bị git bỏ qua; kiểm robots.txt trước |
| `crawler/scripts/real-check.ts` **(mới)** + `npm run real-check` | Nghiệm thu trang thật (§6) |
| `crawler/test/real/expectations.json` **(mới)** | Điều kiện ngắn theo URL; không chứa nội dung trang |
| `.gitignore` | `crawler/test/real/snapshots/` |
| `packages/db/prisma/migrations/20261016090000_document_structures/` **(mới)** | §4 |
| `packages/db/prisma/schema.prisma` | Model `DocumentStructure` (test chống lệch bắt buộc) |
| `apps/web/lib/crawler/database.test.ts` | Test PGlite §7 |
| `crawler/README.md`, `docs/learning/slice-pr1-structured-content.md` **(mới)** | Tài liệu |

**Không sửa:** `extractor/*`, `crawler_record()`, `render.ts`, `fetch.ts`, giao diện web, quyền và RLS hiện có.

## 6. Nghiệm thu trang thật (mục 4 của review)

- **CI** chỉ chạy fixture tổng hợp. **Không có** test trang thật nào trong `npm test`, nên không có
  chuyện "bỏ qua mà vẫn báo qua".
- **`npm run real-check -w @nordic/crawler`:**
  - đọc `expectations.json`;
  - với **mỗi** URL: thiếu snapshot thì **lỗi** (không bỏ qua); có snapshot thì chạy `extractStructure`
    và kiểm từng điều kiện;
  - in bảng kết quả (URL, ngày snapshot, sha256 của HTML, từng điều kiện đạt / không đạt);
  - thoát mã ≠ 0 nếu có điều kiện nào không đạt hoặc thiếu snapshot.
- **PR 1 chỉ được coi là xong khi** kết quả `real-check` (toàn bộ đạt) được ghi vào
  `docs/architecture/pr1-real-world-results.md` và mô tả PR, kèm ngày và hash snapshot.
- **Trang:**
  - SU `HT2026`, SU `HT2027` (URL đã biết, nguồn đã đăng ký);
  - **KTH: 2 trang chương trình, URL do bạn cung cấp** (bắt buộc để hoàn thành PR 1).
- **Điều kiện mẫu:**
  - SU HT2027: có cặp có nhãn chứa "Tuition fee" và "Selection"; có khối thuộc mục chứa "Year 1"; có
    link `fileType: "pdf"`; không có `structuredData` nào ngoài `json-ld`;
  - KTH: viết sau khi xem snapshot.

## 7. Danh sách việc khi code (checklist)

- [ ] Tạo nhánh `extraction/pr-1-structured-content` từ `extraction/pr-0-audit`.
- [ ] `extract.ts`: tách `contentRoot()`; **chạy mốc PR 0 trước và sau, 3 snapshot không đổi**.
- [ ] `structure.ts` + test fixture:
  - [ ] cặp từ khung nhãn–giá trị, bảng, `<dl>`;
  - [ ] `ref` duy nhất; `domPath` tìm lại đúng phần tử bằng cheerio trên chính snapshot đó;
  - [ ] `section` đúng;
  - [ ] link tuyệt đối, `fileType`;
  - [ ] JSON-LD hợp lệ có, hỏng bỏ qua, script state không có;
  - [ ] giới hạn và `limits.dropped`.
- [ ] Migration `document_structures` + `crawler_record_structure()` + RLS + quyền.
- [ ] `schema.prisma` + test chống lệch qua.
- [ ] Test PGlite:
  - [ ] lưu và đọc lại;
  - [ ] hash do database tính (bỏ qua hash gửi lên);
  - [ ] cấu trúc giống hệt → không ghi; khác → snapshot mới, giữ lịch sử;
  - [ ] tài liệu không thuộc lần chạy, nguồn bị tắt, lần chạy đã đóng → từ chối;
  - [ ] định dạng lạ, quá 1 MB → từ chối;
  - [ ] khách và người không có quyền không đọc được; biên tập viên đọc được;
  - [ ] vai trò crawler không `SELECT` / `INSERT` trực tiếp được;
  - [ ] **test hồi quy hiện trạng A → B → A**.
- [ ] `crawl.ts` / `db.ts`:
  - [ ] `created` và `unchanged` có HTML → gọi; 304 và lỗi → không gọi;
  - [ ] lỗi lưu cấu trúc → log + `partial`, văn bản vẫn lưu.
- [ ] `snapshot.ts`, `real-check.ts`, `expectations.json`, `.gitignore`.
- [ ] Chạy toàn bộ: web 447 + mới, crawler 24 + mới, extractor 15; typecheck, lint, build.
- [ ] Tạo snapshot SU (2) + KTH (2) **trên máy**, chạy `real-check`, ghi `pr1-real-world-results.md`.
- [ ] README crawler, tài liệu học, Decision Log; commit; push nhánh. **Không chạy migration production.**
