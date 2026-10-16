# Review tương thích nhiều trường: Programme / Intake / Fact / Evidence + Rule Engine

> **Chỉ là review kiến trúc.** Không sửa code, migration hay dữ liệu; không đăng ký nguồn; không crawl.
> Ngày: 2026-10-16. Cơ sở: `main` @ `e0c4e61` (PR 2a #5 và PR 2b #6 đã merge). L7b chưa có migration.
>
> Ký hiệu nguồn bằng chứng:
> - **[Trang chính thức]**: đã đọc trực tiếp trang của trường hoặc cổng tuyển sinh ngày 2026-10-16 (danh sách ở mục 8).
>   Chỉ ghi **cấu trúc**, không chép nội dung.
> - **[Snapshot cục bộ]**: 4 bản lưu SU / KTH ngày 2026-10-15 (`crawler/test/real/snapshots`, git bỏ qua).
> - **[Đã kiểm code]**: thấy trong repo hoặc database (đọc chỉ-đọc).
> - **[Giả định]**: tình huống có thể xảy ra nhưng **chưa** thấy trên trang nào đã đọc.
>
> Ký hiệu khuyến nghị: **[Đề xuất]**, **[Cần xác nhận]** như các bản review trước.

---

## 1. Hiện trạng liên quan (Phase 1)

| Thành phần | Hiện trạng | Bằng chứng |
|---|---|---|
| Hợp đồng luật | `IntakeRef` bắt buộc năm + (mùa hoặc tháng); `RuleCandidate` có `intake`, `applicability`, `suppressed?`; **không có** nhóm người học, vòng tuyển, năm học | [Đã kiểm code] `packages/db/src/rule-output.ts` |
| Nhóm ứng viên trong engine | Khóa nhóm = **loại fact + kỳ**; hai câu khác nhau cùng mức → `ambiguous` | [Đã kiểm code] `extractor/src/rules/engine.ts` `resolve()` |
| Luật | Chỉ `sites/su.ts`, `sites/kth.ts`; **không có luật chung** (global / country) | [Đã kiểm code] `registry.ts` |
| Loại fact thuộc kỳ | `INTAKE_SCOPE`: `application_deadline`, `application_period` (intake); `tuition_fee` (optional) | [Đã kiểm code] `fact-types.ts` |
| `fact_types.applies_to` | **Một** giá trị; `application_deadline` = programme, `application_fee` = country | [Đã kiểm code] DB 2026-10-16 |
| Kỳ thu học phí | `value_period` ∈ year / semester / month / week / total / one_off | [Đã kiểm code] CHECK migration `20261013090000_fact_types` |
| L7b (chưa migration) | `programme_intakes` (năm + mùa/tháng, `variant` cần `source_code`), `programme_pages` (**bắt buộc** `programme_id`), `facts.intake_id` + `intake_applicability` | `docs/architecture/l7b-pr2-architecture-review.md` §4 |
| Gắn trang | `document_entity()` chỉ trả kết quả khi khớp **đúng 1** thực thể | [Đã kiểm code] |
| Chuyển hướng URL | `fetch` đi theo chuyển hướng; **khác origin bị từ chối** (`off_origin`); nội dung lưu dưới URL đã đăng ký, URL đích **không** được ghi | [Đã kiểm code] `crawler/src/fetch.ts` |
| Nguồn đã đăng ký | Cơ quan nhà nước/thống kê 5 nước (SE, DK, NO, FI, NL), các cổng "Study in …", **Studyinfo (Opintopolku)**, chỉ **1 trường** (SU); 13 trường, 1 chương trình, 58 fact | [Đã kiểm code] DB chỉ-đọc |

---

## 2. Giả định riêng của SU / KTH và rủi ro tổng quát hóa

| # | Giả định | Nằm ở đâu | Trường khác thì sao | Mức |
|---|---|---|---|---|
| A1 | Heading của mục **nêu kỳ** (SU "Autumn 2027 \| …", KTH "…starting August 2027") | luật SU/KTH; `intake.ts` | KU, UiO: heading nêu **nhóm người học**, không nêu kỳ; ngày không có năm [Trang chính thức] | **Cao** |
| A2 | Mỗi kỳ chỉ có **một** hạn / một kỳ nộp | engine nhóm theo loại fact + kỳ | UiO, TU Delft, KU: **hạn khác nhau theo nhóm người học**; Thụy Điển: **hai vòng tuyển** [Trang chính thức] → hiện sẽ ra `ambiguous` | **Cao** |
| A3 | Học phí là một câu riêng của chương trình | luật `su.tuition_fee.pair` | Helsinki: "per year (only for non-EU/EEA citizens)"; TU Delft: phí luật định / phí trường theo năm học 2026-2027; KU: **"per 60 ECTS"**, trả từng học kỳ, số tiền nằm sau **menu chọn** [Trang chính thức] | **Cao** |
| A4 | Thông tin nằm trên trang của **chương trình** | `programme_pages` bắt buộc `programme_id`; `document_entity` "đúng 1" | KU, UiO: trang hạn nộp **chung cho cả trường**; Thụy Điển, Phần Lan, Hà Lan: **cổng tuyển sinh quốc gia** [Trang chính thức] | **Cao** |
| A5 | Ngày có năm, hoặc heading cho năm | `IntakeRef.year` bắt buộc | KU, UiO, TU Delft: ngày **không có năm** (như KTH) [Trang chính thức] → `intake_unresolved` cho mọi thứ | **Trung bình** (an toàn nhưng không trích được) |
| A6 | Ngôn ngữ trang: tiếng Anh (+ tên tháng tiếng Thụy Điển) | `normalizers/date.ts`, `duration.ts` | Trang tiếng Đan Mạch / Na Uy / Phần Lan / Hà Lan không đọc được ngày → `normalize_failed` [Giả định cho trang không phải tiếng Anh] | Thấp (an toàn) |
| A7 | Tiền tệ có mã ISO | `money.ts` | Trang Đan Mạch / Na Uy hay ghi "kr." → `currency_ambiguous` [Giả định] | Thấp (an toàn) |
| A8 | URL ổn định | `page_key`, phiên bản trang L7a | KU đã đổi cấu trúc URL (`studies.ku.dk/...` → **301** → `www.ku.dk/studies/masters/...`), **khác origin** → crawler từ chối [Trang chính thức + Đã kiểm code] | **Trung bình** |
| A9 | Cặp nhãn–giá trị kiểu SU | `crawler/src/structure.ts` (heuristic) | Helsinki có khối "Basic information" dạng nhãn–giá trị [Trang chính thức]; chưa kiểm snapshot nên **chưa biết** PR 1 có đọc thành cặp không | Cần kiểm |
| A10 | Kỳ = năm + mùa; biến thể chỉ khi có mã riêng | L7b §3.2 | Helsinki: "only one intake per academic year" + "autumn 2027" → khớp mô hình [Trang chính thức]. Nhiều cơ sở / hình thức học: **[Giả định]**, chưa thấy trên trang đã đọc | Thấp |

---

## 3. Ma trận tương thích (Phase 2 + 3)

"Hỗ trợ" = mô hình (L7b đề xuất + engine hiện tại) biểu diễn **đúng mà không suy diễn**. Một kết quả `unresolved` an toàn
nhưng không trích được thì ghi là "Một phần".

| # | Tình huống | Bằng chứng | Hỗ trợ? | Thực thể / luật | Bằng chứng cần có | Khoảng trống / rủi ro | Cần đổi schema? |
|---|---|---|---|---|---|---|---|
| 1 | Một chương trình, một kỳ, một trang | Helsinki ("studies starting in autumn 2027") [Trang chính thức] | **Có** (sau L7b-1a/1b) | `programmes`, `programme_intakes`, `programme_pages` | Câu nêu mùa + năm | Không | Theo L7b |
| 2 | Một chương trình, nhiều kỳ, một trang | KTH (một URL cho mọi năm) [Snapshot]; KU tháng 9 / tháng 2 [Trang chính thức] | **Một phần** | Engine nhóm theo kỳ (M2); kỳ từ heading | Heading nêu kỳ **và năm** | KU không có năm → `intake_unresolved` | Có (xem P3) |
| 3 | Nhiều trang, mỗi trang một kỳ | SU HT2026 / HT2027 [Snapshot] | **Có** (sau L7b-1b) | `programme_pages` role=intake | Bản ghi trang đã duyệt + heading | Trang nhắc kỳ khác đã có test | Theo L7b |
| 4 | Trang chương trình + trang tuyển sinh / học phí riêng | TU Delft ("Finances" riêng), KTH ("Fees") [Trang chính thức, Snapshot] | **Một phần** | `programme_pages` role=fees/admissions | Trang phải được đăng ký và duyệt | Trang phí thường **chung cho nhiều chương trình** → `document_entity` không trả gì | **Có** (P4) |
| 5 | Kỳ chỉ có năm | — | **Không** (cố ý) | `IntakeRef` / CHECK bắt buộc mùa hoặc tháng | — | **[Giả định]**, chưa thấy trên trang nào; giữ `intake_unresolved` là an toàn | Không |
| 6 | Năm học, không có ngày bắt đầu | TU Delft: phí "2026-2027" [Trang chính thức] | **Không** | Không có trường năm học; `valid_from/until` sẽ phải suy ngày | Câu nêu năm học | Thiếu nhãn năm học | **Có** (P1) |
| 7 | Nhiều vòng tuyển cho một kỳ | Thụy Điển: vòng 1 / vòng 2 [Trang chính thức] | **Không** | Không có trường vòng tuyển → hai hạn cùng kỳ = `ambiguous` | Nhãn vòng do nguồn ghi | Hạn vòng 2 dành cho EU/EEA, tức là kết hợp cả nhóm người học | **Có** (P1) |
| 8 | Học phí (và **hạn**) khác theo nhóm người học | Helsinki, TU Delft, KU (học phí); UiO, TU Delft, KU (hạn) [Trang chính thức]; SU [Snapshot] | **Không** | D13 mới tính cho học phí, danh sách nhóm cố định | Câu nêu nhóm | Nhóm **khác nhau theo nước**: "Nordic citizens", "Dutch students", "EU/EFTA", "EU/EEA/Switzerland"; TU Delft còn chia theo **bằng trước đó** (BSc Hà Lan / HBO / nước ngoài) | **Có** (P1) |
| 9 | Hình thức học, cơ sở, thời lượng khác nhau | SU "Day-time, 50%, distance" [Snapshot] | **Một phần** | Thuộc tính = fact; biến thể chỉ khi có `source_code` | Mã nộp hồ sơ riêng | Nhiều cơ sở / hình thức trong một kỳ: **[Giả định]**, chưa kiểm | Không (theo L7b) |
| 10 | Quy định tuyển sinh chung của trường | KU, UiO: trang hạn chung cho mọi chương trình thạc sĩ [Trang chính thức] | **Không** | `application_deadline.applies_to = programme`; `document_entity` cần đúng 1 | Trang chính thức của trường | Không lưu được ở cấp trường; sao chép sang từng chương trình sẽ trùng | **Có** (P2, P4) |
| 11 | Cổng tuyển sinh quốc gia | universityadmissions.se, Studyinfo.fi, Studielink [Trang chính thức] | **Không** | Nguồn có (Studyinfo đã đăng ký) nhưng không có thực thể "vòng tuyển quốc gia" | Trang cổng chính thức | Ngày quốc gia áp dụng cho mọi trường của nước đó | **Có** (P2, P5) |
| 12 | Cùng URL, thông tin đổi theo năm | KTH [Snapshot]; KU đổi URL (301 khác origin) [Trang chính thức] | **Một phần** | Phiên bản trang (L7a), snapshot, kỳ theo heading | Heading có năm | Đổi URL khác origin → crawl thất bại; URL đích không được ghi | Có (P6, nhỏ) |

**Chưa kiểm được trên trang thật:** #5, #9 (nhiều cơ sở / hình thức), cổng Søknadsweb (Na Uy) và optagelse.dk (Đan Mạch),
trang chương trình trên Studyinfo, trang "Finances" của TU Delft, và cách PR 1 đọc khối "Basic information" của
Helsinki. Những mục này cần snapshot cục bộ trước khi viết luật.

---

## 4. Mô hình dữ liệu: đề xuất tối thiểu tổng quát hóa được (Phase 4)

### P1. Thuộc tính phạm vi (qualifiers) trên fact **[Đề xuất]**

Thay vì D13 chỉ cho học phí, dùng **một bộ nhỏ cột tùy chọn** trên `facts`, mỗi cột có cả nhãn nguyên văn:

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `applicant_group` | Danh sách đóng, thô: `all`, `eu_eea_ch`, `non_eu_eea_ch`, `national`, `nordic`, `other` | UiO "outside EU/EEA and Switzerland" → `non_eu_eea_ch` |
| `applicant_group_label` | Nhãn **nguyên văn** của nguồn (bắt buộc khi có `applicant_group`) | "Applicants residing in Norway and Nordic citizens" |
| `admission_round_label` | Vòng tuyển, nguyên văn | "First admissions round" |
| `academic_year` | `YYYY-YYYY` **chỉ khi nguồn ghi** | "2026-2027" |

- Đây là các cột **quan hệ**, không phải JSON (AGENTS.md §4.4). `NULL` = nguồn không nói, **không** có nghĩa là "mọi người".
- Mã thô `other` dùng cho nhóm không vừa danh sách, ví dụ "Dutch students", hay nhóm theo bằng cấp trước đó của TU Delft.
  Nhãn nguyên văn luôn được giữ để không mất thông tin.
- `fact_duplicate_of()`, nhóm ứng viên của engine và `/compare` đều phải tính các cột này. `/compare` không gộp các nhóm
  khác nhau.

### P2. Fact cấp trường và cấp quốc gia cho loại fact tuyển sinh **[Đề xuất]**

- `fact_types.applies_to` chuyển từ một giá trị sang **tập cho phép**, ví dụ `application_deadline`: {programme, university, country}.
- Trang chương trình hiển thị cả fact cấp trường và cấp quốc gia **kèm nhãn nguồn**: "Áp dụng chung cho chương trình
  thạc sĩ của trường" / "Theo cổng tuyển sinh quốc gia". Đây là **hiển thị kế thừa**, không sao chép dữ liệu.
- Fact cấp chương trình (nếu có) được hiển thị trước. Hai cấp nói khác nhau thì hiện cả hai và đánh dấu xung đột
  (PR 4), không chọn hộ.

### P3. Ngày lặp lại hằng năm, không có năm **[Cần xác nhận]**

KU, UiO, TU Delft và KTH đều ghi "15 January" mà không có năm. Hai lựa chọn:
- **(a) Giữ như hiện tại:** chỉ lưu chữ, không gắn kỳ. An toàn, nhưng trang sẽ chỉ hiện chữ.
- **(b) Thêm `date_pattern` dạng `--MM-DD`** (ISO 8601 cho ngày lặp lại) cùng nhãn kỳ chưa giải được (ví dụ "study
  start in September"). Cách này không suy năm, nhưng lưu được "ngày trong năm".

Khuyến nghị: (a) cho tới khi có nhu cầu so sánh theo ngày.

### P4. Trang dùng chung → `official_pages` **[Đề xuất, đổi L7b trước migration]**

Đổi `programme_pages` thành `official_pages`:
- `university_id` **bắt buộc**; `programme_id` **tùy chọn**; `intake_id` tùy chọn;
- vai trò: programme / intake / fees / admissions / curriculum.

Hệ quả:
- trang dùng chung của trường (KU dates, UiO admission) gắn với **trường**;
- fact trích từ đó là fact cấp trường (P2);
- `document_entity()` trả về "trường" cho các trang này, thay vì rỗng.

### P5. Cổng tuyển sinh quốc gia **[Cần xác nhận]**

- Cổng là một **nguồn** (đã có: Study in Sweden, Studyinfo). Trang ngày tuyển của cổng → fact **cấp quốc gia** (P2) với
  `admission_round_label` (P1).
- Trang chương trình trên cổng (ví dụ Studyinfo) → `official_pages` với nguồn là cổng. Cần nới quy tắc "cùng origin với
  nguồn" thành "cùng origin với **nguồn của trang**", vốn đã đúng vì nguồn của trang là cổng.

### P6. Đổi URL **[Đề xuất, nhỏ]**

- Khi chuyển hướng cùng origin: ghi **URL đích** vào bản ghi lần chạy, để người vận hành thấy trang đã chuyển.
- Khi chuyển hướng khác origin: giữ việc từ chối (an toàn), nhưng báo rõ URL đích trong nhật ký, để chủ dự án đăng ký
  nguồn hoặc URL mới.
- Việc gắn trang mới với chương trình đi qua duyệt (`official_pages`), không tự động.

### P7. Học phí theo tín chỉ **[Cần xác nhận]**

KU ghi phí "for 60 ECTS" và thu từng học kỳ; `value_period` không có kỳ "theo tín chỉ". Hai lựa chọn:
- giữ `unresolved` (hiện tại, an toàn);
- thêm kỳ `per_credits` kèm số tín chỉ.

Khuyến nghị: giữ `unresolved`, vì quy đổi "60 ECTS = 1 năm" là một quy ước (D7).

### Những gì **không** cần đổi

- Định danh chương trình **độc lập với URL** (đã có: tên + bậc học + mã tùy chọn).
- Định danh kỳ **độc lập với URL** (L7b).
- Biến thể theo hình thức / cơ sở / nhịp học: giữ quy tắc D1 (chỉ khi có mã riêng).
- Lịch sử snapshot và nguồn đổi (L7a, PR 1).

---

## 5. Khả năng mở rộng của Rule Engine (Phase 5)

| Khía cạnh | Hiện trạng | Đề xuất |
|---|---|---|
| Luật chung và luật theo site | Chỉ có luật theo site | Thêm **luật cấp quốc gia / toàn cục, priority thấp** cho mẫu phổ biến ("Tuition fee", "Duration", "Language" dạng cặp), vẫn ở chế độ shadow. Luật site ghi đè bằng mức cụ thể (đã hỗ trợ) |
| Loại trang | Theo URL, khai báo từng site | Giữ. Thêm loại trang cho trang dùng chung (`university_admissions`, `fees`) khi P4 có |
| Nhiều mục / nhiều kỳ | Đã có (M2) | Mở rộng khóa nhóm: loại fact + kỳ + **qualifiers** (P1) |
| Nhóm người học / vòng tuyển | **Không có** | Thêm `QualifierSpec` song song `IntakeSpec`: lấy từ heading (anchored, có bằng chứng heading) hoặc từ nhãn; thiếu thì `null`, **không** đoán. Đổi hợp đồng `RuleCandidate` (thêm trường tùy chọn) → cần duyệt |
| Xung đột | `ambiguous`, `suppressed` (M1) | Giữ; sau P1, các hạn khác nhóm hoặc khác vòng **không còn** là xung đột |
| Bằng chứng | Phần tử snapshot / JSON-LD theo path | Thêm bằng chứng của qualifier (heading ref), giống `IntakeRef.evidence` |
| Phiên bản | Theo luật + bộ luật | Thêm danh sách nhóm / vòng vào phụ thuộc của mã bộ luật (M4) |
| Cấu trúc không hỗ trợ | `not_found` / `normalize_failed` | Ghi rõ là không hỗ trợ: nội dung sau menu chọn hay accordion (KU), PDF, ngôn ngữ ngoài Anh/Thụy Điển. Không tương tác trang khi chưa duyệt |
| Kết quả chưa giải được | An toàn | Giữ; thêm loại issue `qualifier_unresolved` nếu P1/QualifierSpec được duyệt |

---

## 6. Việc phải đổi trước khi chạy migration L7b

| # | Thay đổi | Lý do |
|---|---|---|
| L-1 | `programme_pages` → **`official_pages`** (`university_id` bắt buộc, `programme_id` tùy chọn) | Kịch bản 4, 10, 11 (P4, P5) |
| L-2 | Thêm **qualifiers** (P1) vào `facts` **cùng** L7b-1a, hoặc đưa D13 lên trước L7b-3 | `fact_duplicate_of()` theo kỳ ở L7b-3 cần cả qualifiers, nếu không sẽ phải sửa hai lần |
| L-3 | `fact_types.applies_to` thành tập (P2) | Hạn chung của trường / quốc gia |
| L-4 | Giữ nguyên: `programme_intakes` (năm + mùa/tháng, `variant` cần `source_code`), `facts.intake_id` + `intake_applicability`, khóa ngoại kép + CHECK | Đã đúng với các trường đã đọc |
| L-5 | D13 đổi phạm vi: không chỉ học phí mà **mọi loại fact** có thể theo nhóm người học (hạn nộp) | UiO, TU Delft, KU |

## 7. Việc phải đổi trong PR 3

1. `RuleCandidate` thêm qualifiers tùy chọn (`applicantGroup`, `applicantGroupLabel`, `admissionRoundLabel`,
   `academicYear`) kèm bằng chứng. Đây là đổi hợp đồng, cần duyệt.
2. `extractor_propose` nhận qualifiers và kiểm chúng nằm trong câu trích hoặc heading được trỏ tới.
3. Ánh xạ tài liệu → thực thể: trang dùng chung → trường; trang cổng quốc gia → quốc gia (P2, P4, P5).
4. `eligibleForAutoProposal` mở rộng: loại fact mà trang có chia nhóm (nhiều nhóm trong cùng mục) thì cần qualifier,
   thiếu → không tự đề xuất.
5. Shadow mode và tiêu chí S1–S6 giữ nguyên; bộ nghiệm thu thêm các cấu trúc ở mục 8.

## 8. Nghiệm thu cho cấu trúc mới

**Fixture tổng hợp** (không chép trang thật), mỗi cái kèm kết quả mong đợi:

| Fixture | Cấu trúc mô phỏng | Mong đợi |
|---|---|---|
| `admissions-by-group` | Heading theo nhóm người học, dòng "15 January: …" không năm, chia tháng 9 / tháng 2 (kiểu KU / UiO) | Trước P1: `ambiguous` / `intake_unresolved` (ghi lại hành vi hiện tại). Sau P1: mỗi nhóm một ứng viên, không có năm |
| `basic-information-box` | Khối nhãn–giá trị "Scope of studies: 120 ECTS credits, 2 years", câu "studies starting in autumn 2027", "Tuition fee per year (only for non-EU/EEA citizens)" (kiểu Helsinki) | Tín chỉ 120 ECTS, 24 tháng, kỳ autumn 2027, học phí `year` + nhóm `non_eu_eea_ch` (sau P1) |
| `deadlines-by-nationality` | Danh sách "For Non-EU/EFTA nationals: 15 January" (kiểu TU Delft) + trang phí riêng với năm học "2026-2027" | Hạn theo nhóm, `academic_year` (sau P1) |
| `national-rounds` | Hai vòng tuyển có năm, kèm câu "vòng 2 cho EU/EEA" (kiểu Thụy Điển) | Fact cấp quốc gia, hai vòng, không `ambiguous` (sau P1 + P2) |
| `shared-university-page` | Một trang hạn nộp dùng chung cho nhiều chương trình | Gắn với trường, không sao chép sang từng chương trình (P4) |
| `credit-based-fee` | "The tuition fee is for 60 ECTS" | `unresolved` (P7) |
| `interactive-amount` | Số tiền chỉ có sau khi chọn trong menu | `not_found`, không đoán |
| `url-moved` | Chuyển hướng cùng origin / khác origin | Cùng origin: URL đích được ghi; khác origin: `off_origin` kèm URL đích (P6) |

**Trên trang thật:** cần chủ dự án duyệt đăng ký nguồn và URL; sau đó chụp snapshot cục bộ và chạy `rules:check`.

## 9. Quyết định cần chủ dự án duyệt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| X1 | Qualifiers trên fact (P1): cột riêng như trên, danh sách nhóm thô | Có; thay D13 bằng P1 |
| X2 | Fact cấp trường / quốc gia cho loại fact tuyển sinh (P2) + hiển thị kế thừa | Có |
| X3 | `programme_pages` → `official_pages` (P4) **trước** migration L7b | Có |
| X4 | Ngày không năm: chỉ chữ (a) hay `--MM-DD` (b) | (a) |
| X5 | Học phí theo tín chỉ (P7) | Giữ `unresolved` |
| X6 | Cổng quốc gia: fact cấp quốc gia + vòng tuyển (P5) | Có, sau X1 + X2 |
| X7 | Ghi URL đích khi chuyển hướng (P6) | Có (đổi crawler nhỏ, PR riêng) |
| X8 | Trường dùng để nghiệm thu thêm | Gợi ý: KU, UiO, Helsinki, TU Delft (đã đọc trang chính thức). Chủ dự án quyết đăng ký nguồn và URL |
| X9 | Nội dung cần tương tác (menu chọn, accordion) | Không hỗ trợ cho tới khi có duyệt riêng |

## 10. Trang chính thức đã đọc (2026-10-16)

Chỉ đọc để review cấu trúc; chưa đăng ký nguồn nào.

- University of Copenhagen: <https://www.ku.dk/studies/masters/important-dates-and-deadlines-master-of-science-programmes>,
  <https://www.ku.dk/studies/masters/anthropology/tuition-fee-and-payment>; URL cũ
  `https://studies.ku.dk/masters/economics/application-procedure/non-eu-eea-and-switzerland/tuition-fees/` → 301 →
  <https://www.ku.dk/studies/masters/economics>
- University of Oslo: <https://www.uio.no/english/studies/admission/master/>
- University of Helsinki: <https://www.helsinki.fi/en/degree-programmes/mathematics-and-statistics-masters-programme/admissions>
- TU Delft: <https://www.tudelft.nl/en/education/programmes/masters/mot/mot/application-and-admission>
- University Admissions in Sweden: <https://www.universityadmissions.se/en/key-dates-and-deadlines/autumn-semester-dates/>
