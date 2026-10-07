# Kế hoạch giai đoạn 1 — Ngành học và hướng nghề cho chương trình (BẢN ĐỀ XUẤT, sửa 2026-10-03)

> **Trạng thái (2026-10-07):** chủ dự án **đã duyệt** và chọn làm thành 3 phần. **11a xong** (bảng danh mục,
> CSV ISCED-F chờ đối chiếu, script nhập, trang quản trị Hướng nghề). Còn **11b** (phân loại chương
> trình + duyệt) và **11c** (bộ lọc công khai, nhãn, Kế hoạch châu Âu). Chi tiết: Decision Log 2026-10-07.
> Định hướng: PROJECT_SPEC.md, Decision Log "2026-10-03 — Open taxonomy: every field of study
> and every career path". Ví dụ định dạng mục: `docs/data/field-taxonomy-draft.md` (bản 0.3).
>
> Bản đầu của kế hoạch (cùng ngày) chỉ nhắm CNTT và PO/PM. Bản này thay thế: hệ thống **mở cho
> mọi ngành và mọi nghề**.

## Mục tiêu

Người dùng lọc theo **bất kỳ ngành học** (ví dụ Kỹ thuật phần mềm, Y tá, Kinh tế) hoặc **bất kỳ
hướng nghề** (ví dụ PO/PM, Business Analyst, Data Analyst) và thấy các chương trình, trường có
chương trình phù hợp — chỉ với phân loại đã được đối chiếu bằng chứng và duyệt.

## Hai chiều phân loại

| | Ngành học | Hướng nghề |
|---|---|---|
| Nguồn gốc | **ISCED-F 2013** (UNESCO), chuẩn chính thức | **Nordic định nghĩa**, ghi rõ là nhóm của Nordic (AGENTS.md §15) |
| Phạm vi | Toàn bộ cây: lĩnh vực rộng → hẹp → chi tiết | Không giới hạn số lượng |
| Ai thêm/sửa | Nhập một lần từ tài liệu chính thức đã đối chiếu; chỉ đổi khi UNESCO đổi | Admin trên trang quản trị (quyền đề xuất mới `taxonomy.manage`) |
| Mỗi mục có | mã, tên, tên tiếng Việt, cấp | định nghĩa, tiêu chí tính, tiêu chí loại, từ khóa tiếng Anh, phiên bản; sau này có thể nối với nghề (ISCO) |

Một chương trình có thể thuộc nhiều ngành và nhiều hướng nghề; mỗi lần gán đều có trích đoạn
bằng chứng và được duyệt.

## Điều kiện trước khi bắt đầu code

1. Có bản **ISCED-F 2013 chính thức** (tài liệu UNESCO) để nhập; người nhập ghi lại nguồn và ngày
   lấy. Mã nào chưa đối chiếu được thì không nhập. Tên tiếng Việt là bản dịch của Nordic, ghi rõ.
2. ~~Nhóm con CNTT~~ — **đã quyết (2026-10-06):** chỉ dùng cấp của ISCED; chủ đề như an ninh mạng
   hay khoa học dữ liệu được tạo thành hướng nghề trên giao diện. Hướng nghề do chủ dự án tự tạo.
   Người duyệt: chủ dự án, khi có thời gian; bắt đầu với **Thụy Điển**.
3. ~~Ai được quản lý hướng nghề~~ — **đã trả lời (2026-10-03):** người có quyền mới
   `taxonomy.manage`; vai trò quản trị viên đầy đủ được cấp sẵn qua migration, admin cấp thêm
   cho vai trò khác ở trang phân quyền. **Không seed hướng nghề nào**: chủ dự án tự tạo và chỉnh
   mọi hướng nghề trên trang quản trị.
4. ~~Chủ dự án duyệt kế hoạch này~~ — **đã duyệt 2026-10-07.** Thêm: tên và định nghĩa hướng nghề
   bắt buộc cả tiếng Việt lẫn tiếng Anh; ISCED-F do Claude chép từ PDF chính thức vào
   `docs/data/isced-f-2013.csv`, chủ dự án đối chiếu từng dòng (`docs/data/isced-f-2013.md`).

## Phạm vi giai đoạn 1

**Có:**
- bảng danh mục cho cả hai chiều; nhập ISCED-F 2013 đã đối chiếu;
- trang quản trị **Hướng nghề** (thêm, sửa = phiên bản mới, ngừng dùng);
- biên tập viên phân loại tay chương trình đã có, người duyệt duyệt;
- bộ lọc **Ngành** và **Hướng nghề** ở `/programmes` và `/universities`; nhãn trên trang
  chương trình;
- "ngành / hướng nghề quan tâm" trong Kế hoạch châu Âu và lối tắt.

**Giai đoạn 2:** bảng quy đổi theo nguồn + AI gợi ý phân loại (luôn có người duyệt). Cần thiết
để phủ được nhiều chương trình; nên làm ngay sau giai đoạn 1.

**Giai đoạn 3:** tự phát hiện chương trình mới từ danh mục chính thức đã đăng ký (crawler + AI
đề xuất chương trình); cần quyết định riêng vì phải nới giới hạn của Slice 9/10a.

## ERD đề xuất (chuẩn hóa, có khóa ngoại, AGENTS.md §4)

```
study_fields                         -- ISCED-F 2013, chỉ đọc với ứng dụng
  id uuid PK
  code text UNIQUE                   -- mã ISCED-F (2 / 3 / 4 chữ số)
  level smallint CHECK (1 | 2 | 3)   -- rộng | hẹp | chi tiết
  parent_id uuid NULL FK -> study_fields.id
  name_en text                       -- tên theo tài liệu UNESCO
  name_vi text                       -- bản dịch của Nordic
  source_document text, retrieved_on date   -- tài liệu đã dùng để nhập

career_paths                         -- hướng nghề do Nordic định nghĩa
  id uuid PK
  key text UNIQUE
  name_vi text, definition text, include_rule text, exclude_rule text
  keywords text[]                    -- chỉ tiếng Anh
  version int, active boolean, updated_by uuid, updated_at

career_path_versions                 -- lịch sử định nghĩa (không ghi đè, AGENTS.md §4.3)
  career_path_id FK, version, definition, include_rule, exclude_rule, keywords, changed_by, changed_at

programme_classifications            -- một chương trình ↔ một ngành HOẶC một hướng nghề
  id uuid PK
  programme_id uuid FK -> programmes.id
  study_field_id uuid NULL FK -> study_fields.id
  career_path_id uuid NULL FK -> career_paths.id
  career_path_version int NULL       -- phiên bản tiêu chí lúc gán
  CHECK (đúng một trong study_field_id / career_path_id)
  document_id uuid FK -> documents.id, evidence_excerpt text (≤ 500)
  origin text CHECK (manual | crosswalk | ai)    -- giai đoạn 1 chỉ có manual
  status text CHECK (proposed | reviewed | rejected)
  created_by, created_at, reviewed_at

classification_reviews               -- lịch sử duyệt, chỉ thêm
  id, classification_id FK, actor_id, decision, note, created_at

user_plan_interests                  -- riêng tư, như user_plan_countries
  user_id FK -> user_plans, study_field_id NULL FK, career_path_id NULL FK
```

`programmes.field` giữ nguyên chữ của nguồn. Cột `origin` đã có sẵn chỗ cho giai đoạn 2 (bảng quy
đổi, AI) để không phải đổi bảng.

## Quy tắc trong database (hàm SECURITY DEFINER, theo mẫu `propose_programme` / `review_education`)

- `propose_classification(...)` — cần `education.manage`. Từ chối khi: chương trình không phải
  `master` / `phd`; trích đoạn rỗng hoặc > 500 ký tự; tài liệu không thuộc nguồn của trường;
  đã có phân loại chưa bị từ chối cho cùng mục; hướng nghề đã ngừng dùng.
- `review_classification(...)` — cần `facts.review`, ghi chú bắt buộc.
- `save_career_path(...)` — cần `taxonomy.manage`; sửa tiêu chí tạo phiên bản mới; phân loại theo
  phiên bản cũ vào danh sách "cần duyệt lại".
- Không sửa tại chỗ: sai thì từ chối và đề xuất lại (Slice 5).

## RLS đề xuất

| Bảng | Ai đọc | Ai ghi |
|---|---|---|
| `study_fields`, `career_paths` (đang dùng) | mọi người | ISCED: chỉ migration; hướng nghề: qua `save_career_path` |
| `career_path_versions` | biên tập viên | qua `save_career_path` |
| `programme_classifications` | công khai: chỉ `reviewed` **và** chương trình đang công khai; biên tập viên: tất cả | qua hai hàm phân loại/duyệt |
| `classification_reviews` | `education.manage`, `facts.review` | qua hàm duyệt |
| `user_plan_interests` | chỉ chủ sở hữu | chỉ chủ sở hữu |

Không nới RLS hiện có; không dùng service role.

## Giao diện

- **Bộ lọc ở `/programmes` và `/universities`:** ô **Ngành** dạng cây có tìm kiếm (gõ "software"
  hay "phần mềm" đều ra), ô **Hướng nghề**. Ghi chú: "Chỉ gồm chương trình đã được phân loại và
  duyệt." Trường khớp khi có ít nhất một chương trình đã duyệt thuộc ngành/hướng nghề đó.
- **Trang chương trình:** nhãn ngành (ví dụ "0613 · Phát triển phần mềm và ứng dụng") và hướng
  nghề ("PO/PM — hướng nghề của Nordic"); bấm để xem định nghĩa và trích đoạn.
- **Quản trị → Hướng nghề:** bảng + khung chi tiết (cùng mẫu với trang Chỉ số so sánh).
- **Biên tập (Trường & chương trình):** khung "Phân loại" cho chương trình thạc sĩ/tiến sĩ đã
  duyệt, hiện định nghĩa và tiêu chí ngay cạnh; hàng chờ duyệt dạng split view.
- **Kế hoạch châu Âu:** chọn ngành / hướng nghề quan tâm; lối tắt "Chương trình <ngành> ở <nước>"
  — ghi là bộ lọc theo lựa chọn của bạn, không phải khuyến nghị.

## Kiểm thử (AGENTS.md §17)

- PGlite: các điều kiện từ chối của hàm; CHECK "đúng một chiều"; phiên bản hướng nghề và danh
  sách cần duyệt lại; RLS công khai/biên tập/chủ sở hữu.
- Domain: cây ngành và tìm kiếm trong cây; nhãn "hướng nghề của Nordic"; đọc bộ lọc.
- Trang: bộ lọc hai chiều, nhãn trên trang chương trình, trang quản trị chỉ hiện với
  `taxonomy.manage`.

## Ước lượng

Lớn hơn bản đầu: khoảng một slice rưỡi (cỡ Slice 5 + một trang quản trị). 1 migration (6 bảng,
3–4 hàm, RLS, quyền mới, nhập ISCED-F đã đối chiếu), trang quản trị hướng nghề, khung phân loại +
hàng chờ duyệt, bộ lọc và nhãn công khai, Kế hoạch châu Âu, tài liệu học
`docs/learning/slice-11-taxonomy.md`.
