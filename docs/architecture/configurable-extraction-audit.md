# PR 0 — Kiểm kê và mốc cho "Configurable Multi-Website Extraction"

> Spec gốc: `documents/NORDIC_CONFIGURABLE_EXTRACTION_IMPLEMENTATION_SPEC.md`. Spec tự ghi đường dẫn là
> `docs/architecture/…`, và review dựa trên tree `cce7689`. Repo hiện đã ở `eb649da`: thêm L7a
> (phiên bản trang) và bản sửa ghi lỗi crawler.
> **Phạm vi PR 0** (spec §12): đọc code thật, lập bảng hiện trạng/khoảng trống, chạy toàn bộ test, chuẩn
> bị fixture và mốc. **Không đổi hành vi hệ thống.** Ngoại lệ duy nhất là đồng bộ `schema.prisma` với
> database (mục 2). Việc này không tạo migration và không đổi database.
> Ngày: 2026-10-15.

## 1. Đã đọc và đã chạy

**Đọc** (spec §3):
- crawler: `config, db, crawl, extract, fetch, render, sitemap, urls` + test + `README.md`;
- extractor: `config, db, llm, prompt, run, validate` + test;
- `schema.prisma` và các migration crawler (09-28), AI (09-29), loại thông tin (10-13), L3c/L4/L5
  (10-14), L6/L7a (10-15), cùng hàm, RLS, quyền của chúng;
- `apps/web/lib/{crawler,extraction,education,facts}`, các trang admin crawler / extraction /
  metrics, `/facts/map`, `/facts/workspace`, trang chương trình công khai;
- các kế hoạch L3–L7a, slice-09, slice-10a, browser-crawler-plan, AGENTS.md, các workflow.

**Mốc test** (máy local, Node 24, commit `eb649da` + thay đổi của PR 0):

| Gói | Typecheck | Lint | Test |
|---|---|---|---|
| `apps/web` | ✅ | ✅ | 447 qua (446 cũ + 1 test chống lệch mới), 4 bỏ qua (`*/live.test.ts`, chỉ chạy khi có kết nối thật) |
| `crawler` | ✅ | — | 24 qua (20 cũ + 4 mốc mới) |
| `extractor` | ✅ | — | 15 qua |
| `packages/db` | — | — | không có test riêng; được kiểm qua PGlite ở `apps/web` |

## 2. Phát hiện ngoài spec (đã xử lý trong PR 0)

| Phát hiện | Rủi ro | Xử lý |
|---|---|---|
| **`schema.prisma` lệch database từ L4**: thiếu `fact_type_changes`, `extraction_items.adjustments`, `crawl_targets.render_js`, `evidence_history` | `prisma migrate dev` có thể đề xuất **xóa** các bảng/cột này | Bổ sung 2 model + 2 cột vào `schema.prisma` (chỉ mô tả, không migration). Thêm test `apps/web/lib/db-schema-drift.test.ts`: chạy mọi migration trên PGlite rồi so từng bảng/cột với schema. Đã kiểm chứng test **bắt đúng 4 chỗ lệch** khi chạy với schema cũ |
| `crawler/README.md` lỗi thời (chưa nói trình duyệt thật, L6) | Người mới hiểu sai | Ghi chú ở mục 7; sửa trong PR 1 |
| Không so được `schema.prisma` với database thật bằng `prisma migrate diff` (khóa ngoại sang schema `auth` của Supabase, lỗi P4002) | — | Test chống lệch ở trên thay thế |

## 3. Bảng kiểm kê (spec §3)

Cột "Bằng chứng" trỏ tới file/hàm thật. "Hàm DB" là bản mới nhất (nhiều hàm đã `CREATE OR REPLACE`
qua nhiều migration).

| Năng lực spec yêu cầu | Đã có | Bằng chứng | Khoảng trống | Đề xuất | Ảnh hưởng migration | Test |
|---|---|---|---|---|---|---|
| Lấy trang lịch sự, chỉ URL đăng ký, robots, giới hạn | ✅ | `crawl.ts` `runCrawl`, `fetch.ts` `fetchLimited`, `crawler_due_targets()` (`20261015090000`) | — | Giữ | — | `crawl.test.ts` |
| Vẽ trang bằng trình duyệt | ✅ mặc định | `render.ts` `playwrightRenderer` (`networkidle`, chặn ảnh/phông) | Không `waitForSelector`, không mở accordion | Thêm `wait_for_selector` theo URL/nguồn (giới hạn thời gian) | Thêm cột vào `crawl_targets` | fake renderer |
| Sitemap | ⚠️ | `sitemap.ts` `sitemapUrls`: **không** theo sitemap index | SU dùng sitemap index (`/rest-api/sitemap` trong robots.txt) | Theo index **1 cấp**, lọc theo tiền tố, có giới hạn | Không | `sitemap.test.ts` |
| Văn bản đọc được | ✅ | `extract.ts` `extractPage` → `document_texts.text`, mã băm `sha256-text-v1` | — | Giữ nguyên (mốc ở mục 5) | — | `extract.baseline.test.ts` |
| **Nội dung có cấu trúc** (tiêu đề, cặp nhãn–giá trị, bảng, link, JSON-LD) | ❌ | `extract.ts` làm phẳng; mốc cho thấy `Tuition feeFirst…`, `1Sample Foundations10` | Toàn bộ | **PR 1:** `extractStructure()` song song với văn bản; lưu `document_structures` (JSON có phiên bản) | Bảng mới, chỉ thêm | fixture 3 kiểu |
| Danh mục trường chuẩn (§5 field contract) | ✅ phần lớn | `fact_types` (L3a) + `value_kind`, `applies_to`, khoảng hợp lệ; 12 loại đang dùng được cho trang chương trình (gồm cả loại cấp quốc gia) | Thiếu loại: mã CT, kỳ nhập học, ngày bắt đầu, tiêu chí xét tuyển, giấy tờ, phí nộp hồ sơ, học bổng, nghề nghiệp | **Dùng `fact_types` làm field registry**, không tạo bảng song song; thêm loại qua `/admin/metrics` | Không (dữ liệu) | — |
| `rawValue` / `normalizedValue` | ✅ | `facts.value` (nguyên văn) + `value_number/currency/period/date` (L4: tùy chọn, có kiểm câu trích) | Không có đơn vị chuẩn hóa ngoài tiền/kỳ; không có `boolean` | Thêm kiểu `boolean` / `duration_months` khi cần | Cột/CHECK nhỏ | `compare/database.test.ts` |
| Trạng thái `verified/derived/inferred/missing/conflicting` | ⚠️ khác tên | `facts.status` = proposed/reviewed/rejected/conflicted; "thiếu" = không có thông tin (checklist `programme-slots.ts`, `/facts/map`) | Chưa có `derived` (công thức), chưa tách `inferred` | Ánh xạ: verified = reviewed; conflicting = conflicted; missing = ô trống (không lưu dòng); **thêm `derived`** (công thức + đầu vào đã duyệt) ở PR 3 | Cột `facts.derivation` (JSON) | PGlite |
| `method` + `ruleId/ruleVersion` | ⚠️ | `facts.origin` = manual/ai; `extraction_items.candidate` (JSON) | Không có nguồn gốc "rule" | Thêm `origin='rule'` + `rule_id`, `rule_version` | Cột, chỉ thêm | PGlite |
| Bằng chứng | ✅ một / thông tin | `evidence` (`UNIQUE fact_id`), `evidence_history` (L7a) | Spec muốn `evidence[]` nhiều tài liệu | **Giữ 1:1**: thông tin từ 2 tài liệu = 2 thông tin, gom ở tầng hiển thị/xung đột. Đổi 1:n là thay đổi lớn, không cần cho mục tiêu | Không | — |
| Gắn chương trình theo URL | ✅ | `document_entity()`, `editor_document_entity()` (L3c/L5) | **Một** `official_url`/chương trình → trang HT2027 không gắn được | **L7b** (đã đề xuất): nhiều trang theo kỳ + `facts.intake` | Bảng `programme_pages` + cột | PGlite |
| Thông tin theo kỳ (intake) | ❌ | `reference_period` chỉ cho số liệu thống kê | Toàn bộ | L7b, **trước PR 3** | Như trên | — |
| Rule engine (§6) | ❌ | Chỉ có `content_selector` theo URL | Toàn bộ | **PR 2:** luật dạng dữ liệu TypeScript có kiểu, nằm trong repo (review qua PR), handler cho phép trước; chưa có UI | Không ở PR 2 | fixture |
| Chuẩn hóa (năm→tháng, tiền, tín chỉ, ngày) | ⚠️ | `extraction_norm()` (so khớp), `structured_value_fits()`; AI không được tự đổi đơn vị | Chưa có hàm chuẩn hóa xác định | PR 2: hàm thuần có test; năm→tháng là phép tính xác định nên đánh dấu `derived` | Không | unit |
| AI chỉ cho trường chưa giải được (§9) | ⚠️ | `extractor/src/run.ts`, prompt `extract-v5`, `extractor_fact_types()` | AI đọc cả trang, không biết trường nào đã có | PR 4: gửi danh sách loại còn thiếu (checklist) + đoạn liên quan | Không | `run.test.ts` |
| Chống bịa, kiểm câu trích | ✅ | `extractor_propose()` nhóm 1, `propose_fact()` (L5 Q4), `structured_value_in_excerpt()` | — | Luật (PR 2–3) đi qua **cùng** các kiểm tra này | — | có |
| Trùng / xung đột | ✅ | `fact_duplicate_of()` qua mọi phiên bản (L7a), `review_fact('conflicted')`, `resolve_source_change('superseded')` | Xung đột **giữa các tài liệu khác nhau** (trang CT vs trang học phí chung) chưa được phát hiện tự động | PR 4: cùng chương trình + cùng loại + cùng kỳ mà giá trị khác → đánh dấu chờ duyệt | Không | PGlite |
| PDF | ❌ | `PAGE_TYPES` chỉ HTML; PDF → `skipped_type` | Toàn bộ | PR 5: tải PDF có giới hạn, trích chữ theo trang, bằng chứng có số trang; PDF scan → cần duyệt | Cột `document_texts.format`, số trang | fixture |
| Admin xem trước / thử luật | ❌ | `/admin/crawler`, `/admin/extraction`, `/facts/map` (ghép tay) | — | PR 5; màn hình ghép (L5) là nơi tự nhiên để "lưu thành luật" | — | — |

## 4. Quyết định thiết kế đề xuất (tương thích với kiến trúc hiện có)

1. **Không tạo kho sự thật song song.** `fact_types` là danh mục trường; `facts` + `evidence` là kết
   quả; luật chỉ là **một đường vào mới** (`origin='rule'`) đi qua cùng `extractor_propose()` / duyệt.
2. **Luật ở dạng dữ liệu có kiểu trong repo trước** (`extractor/src/rules/sites/*.ts`), review qua PR,
   có fixture. Chỉ đưa vào database và có UI khi đã ổn định. Spec cho phép, và cách này tránh "admin chạy
   mã tùy ý" (§6).
3. **L7b (trang theo kỳ) trước PR 3.** Không có khái niệm kỳ thì không tách được giá trị 2026 với 2027
   (spec §5: "Do not overwrite Autumn 2027 deadlines with Autumn 2026 values").
4. **Giữ bằng chứng 1:1.** Hai tài liệu nói cùng một điều là hai thông tin có liên kết, không phải một
   thông tin hai bằng chứng. Ít thay đổi, khớp luồng duyệt hiện có.
5. **Fixture tổng hợp trong repo; trang thật chỉ trong database.** Repo public, AGENTS.md §8.

## 5. Mốc trích chữ (PR 0)

`crawler/test/fixtures/` có 3 trang tổng hợp (khung nhãn–giá trị kiểu SU, bảng, `<dl>`).
`crawler/src/extract.baseline.test.ts` ghim văn bản và mã băm hiện tại (snapshot), và ghi rõ các hạn
chế đang có:
- nhãn dính giá trị: `Tuition feeFirst instalment…`, `Duration2 years`;
- ô bảng dính nhau: `1Sample Foundations10`;
- danh sách lồng dính nhau: `(180 ECTS)including`;
- mất link PDF và dữ liệu JSON.

PR 1 phải giữ nguyên văn bản và mã băm này, hoặc đổi tên phương pháp băm một cách tường minh.

## 6. Kế hoạch tối thiểu đã điều chỉnh

| PR | Nội dung | Migration |
|---|---|---|
| **1** | `extractStructure()` (tiêu đề, khối, cặp nhãn–giá trị, bảng, `<dl>`, link tuyệt đối, JSON-LD) song song văn bản; lưu `document_structures` (`format_version`); crawler ghi qua `crawler_record()`; sửa README crawler | `document_structures` + tham số mới cho `crawler_record` |
| **L7b** | Nhiều trang chính thức theo kỳ cho một chương trình; `facts.intake`; gắn tự động trang HT2027 | `programme_pages`, `facts.intake` |
| **2** | Kiểu luật, bộ khớp theo độ cụ thể (toàn cục → trang web → ngoại lệ), hàm chuẩn hóa thuần; chứng minh cùng một trường lấy được từ 3 fixture khác cấu trúc | Không |
| **3** | Luật chạy trong extractor trước AI, đề xuất qua `extractor_propose()` với `origin='rule'`, `rule_id/version`; trạng thái `derived` | Cột `facts.rule_id/rule_version/derivation`, `origin` thêm `rule` |
| **4** | AI chỉ cho loại còn thiếu; phát hiện xung đột giữa tài liệu theo chương trình + loại + kỳ | Có thể không |
| **5a/5b** | PDF (giới hạn, theo trang); UI xem trước/thử/kích hoạt luật | Cột cho PDF; bảng luật nếu chuyển vào DB |

## 7. Câu hỏi cần chủ dự án quyết

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Làm **L7b (trang theo kỳ)** ngay sau PR 1, trước PR 2–3? | Có |
| Q2 | Luật lưu **trong repo** (TypeScript, review qua PR) ở PR 2–4; DB + UI ở PR 5? | Có |
| Q3 | Giữ **bằng chứng 1 thông tin – 1 tài liệu** thay vì `evidence[]`? | Có |
| Q4 | **Trường thứ hai** để thử độ tổng quát (spec §1): bạn chọn trường và **đăng ký nguồn + URL thật** (mình không đoán URL). Gợi ý: một trường Thụy Điển khác giao diện, ví dụ KTH hoặc Uppsala | Bạn chọn |
| Q5 | Làm theo **nhánh + PR** như spec §14? Máy này chưa có `gh`; mình đẩy nhánh, bạn tạo PR trên GitHub (hoặc cài `gh` để mình tạo) | Có, nhánh `extraction/pr-0-audit` |

## 8. Hạn chế của PR 0

- Không chạy test "live" (cần kết nối thật) và không chạy migration nào.
- Không kiểm từng chính sách RLS của mọi bảng. Chỉ kiểm các bảng/hàm liên quan tới trích xuất.
- Fixture là tổng hợp. Độ đúng trên trang thật sẽ đo ở PR 2–3 bằng các phiên bản đã lưu trong database.
