# Kế hoạch L3 — Loại thông tin có nhãn Việt/Anh (ĐÃ DUYỆT, 2026-10-13)

> **Trạng thái:** chủ dự án **đã duyệt** (2026-10-13) theo đúng các đề xuất D1–D6 ở mục 9. **L3a xong**
> (`docs/learning/slice-l3a-fact-types.md`), **L3b xong** (trang chương trình), **L3c xong** (2026-10-14, phương án A —
> `docs/learning/slice-l3c-ai-fact-types.md`).
> Task: Linear KHLOE-146. Bối cảnh: rà soát UX 2026-10-13 (`docs/product/ux-review.md`, mục L3)
> và Decision Log cùng ngày ("Fact types with Vietnamese/English labels … a separate plan goes to
> the owner before any code").

## 1. Vấn đề cần giải quyết

Hiện mỗi thông tin được lưu dạng **chữ tự do**:

| Cột | Ví dụ thực tế |
|---|---|
| `topic` | `tuition` |
| `subject` | `MSc Computer Science` |
| `predicate` | `fee per year` |
| `value` | `SEK 145 000` |
| `unit` | `SEK` |

Hậu quả:
1. **Người dùng Việt đọc tiếng Anh thô.** Nút VI/EN chỉ dịch khung giao diện; tiêu đề của thông
   tin là chữ của nguồn ("fee per year"). Từ 06/10 đã bỏ ý tưởng cột tiêu đề tiếng Việt, nên chưa có
   lời giải.
2. **Không lọc, không so sánh, không tính được.**
   - "Học phí tối đa 150 000 SEK" hay "IELTS ≥ 6.5" không lọc được vì giá trị là chữ.
   - Thẻ chương trình không biết đâu là học phí, đâu là hạn nộp.
   - Slice 12a (đối chiếu điều kiện, ngân sách) không có số để tính.
3. **Cùng một ý, mỗi người viết một kiểu** ("tuition", "fee per year", "annual tuition fee") nên
   không gom được.

## 2. Mục tiêu

- Mỗi thông tin **có thể** gắn với một **loại thông tin** do Nordic định nghĩa (học phí/năm, hạn
  nộp, IELTS tối thiểu…). Loại có **tên Việt và Anh**, nên trang hiện tiêu đề theo ngôn ngữ người xem.
- Thông tin có loại thì có thêm **giá trị có cấu trúc** (số, tiền tệ, ngày) để lọc, so sánh, tính.
- **Chữ của nguồn giữ nguyên.** Giá trị nguyên văn và câu trích không bị dịch hay sửa
  (AGENTS.md §1, §8).

## 3. Thiết kế đề xuất

### 3.1 Một danh mục duy nhất: mở rộng "Chỉ số so sánh" thành "Loại thông tin"

Bảng `comparison_metrics` (Slice 7) đã là một danh mục định nghĩa: mã cố định, nhóm, đơn vị gợi ý,
mỗi thông tin trỏ tới bằng `facts.metric_id`. Nếu tạo thêm bảng "loại thông tin" riêng, Nordic sẽ
có **hai danh mục cho cùng một ý**, trái với AGENTS.md §4.

**Đề xuất:** đổi tên và mở rộng thành **`fact_types`** (Loại thông tin).
- "Chỉ số so sánh" chỉ còn là những loại có cờ `comparable = true`.
- Đổi tên lúc này an toàn: bảng hiện có **0 dòng**, và trong 36 thông tin (kể cả bản nháp) chưa
  thông tin nào gắn `metric_id` (kiểm tra toàn bộ database, 2026-10-13).

Cột của `fact_types`:

| Cột | Ý nghĩa | Đổi được sau khi tạo? |
|---|---|---|
| `key` | mã, ví dụ `tuition_fee` | Không |
| `value_kind` | `money` · `number` · `date` · `text` | Không (đổi kiểu sẽ làm sai các giá trị đã nhập) |
| `applies_to` | loại đối tượng: `programme` · `university` · `immigration_rule` · `occupation` · `country` | Không |
| `category` | nhóm đã có (tuition, living_cost, immigration, labour_market…) | Không |
| `label_vi`, `label_en` | tên hiển thị, **bắt buộc cả hai** | Có |
| `definition_vi`, `definition_en` | đo chính xác điều gì (như định nghĩa chỉ số hiện nay) | Có |
| `unit_hint` | đơn vị gợi ý (SEK, điểm, tuần…) | Có |
| `min_value`, `max_value` | khoảng hợp lệ cho `number`, ví dụ IELTS 0–9 | Có |
| `comparable` | hiện trong bảng so sánh quốc gia | Có |
| `active` | ngừng dùng thì không nhận giá trị mới; giá trị cũ giữ nguyên | Có |

Mọi lần lưu được ghi vào nhật ký (`access_audit`), giống chỉ số hiện nay.

### 3.2 Giá trị có cấu trúc trên thông tin

`facts` thêm:

| Cột | Dùng khi |
|---|---|
| `fact_type_id` | thay `metric_id` (đổi tên cột, cùng khóa ngoại) |
| `value_number` (numeric) | `money`, `number` |
| `value_currency` (mã ISO 4217, ví dụ SEK) | `money` |
| `value_period` (`year` · `semester` · `month` · `week` · `total` · `one_off`) | `money` (học phí/năm, phí một lần) |
| `value_date` (date) | `date` (hạn nộp cố định) |

Quy tắc, kiểm tra trong `propose_fact()` (database), không chỉ trên giao diện:
- **`value` (chữ nguyên văn) vẫn bắt buộc.** Giá trị có cấu trúc chỉ là cách đọc lại con số đó.
- Có loại thì phải có đúng các cột theo `value_kind`:
  - `money`: số + tiền tệ + kỳ;
  - `number`: số, nằm trong `min_value`–`max_value`;
  - `date`: ngày;
  - `text`: không cần cột nào.
- **Con số phải có trong câu trích.** Đây là quy tắc AI extraction đang dùng (Slice 10a), áp
  dụng thêm cho người nhập tay để chặn gõ nhầm.
- Loại phải `active` và khớp đối tượng: loại `programme` chỉ gắn với thông tin của một chương trình.
- **Không quy đổi tự động.** Không đổi SEK sang EUR, không đổi học kỳ sang năm. Quy đổi tiền tệ
  là quyết định riêng (US-102).

Thông tin vẫn bất biến như Slice 4: sai thì từ chối và đề xuất lại, không sửa tại chỗ.

### 3.3 Hiển thị cho người xem

Ví dụ thông tin có loại `tuition_fee`:

```
Học phí / năm                        145 000 SEK / năm
Nguồn ghi: "SEK 145 000"  ·  Nguồn: <trường>  ·  kiểm tra ngày 12/10/2026
```

- Tiêu đề lấy từ `label_vi` hoặc `label_en` theo ngôn ngữ đang chọn.
- Số được định dạng theo ngôn ngữ (145 000 ↔ 145,000); dòng "Nguồn ghi" giữ nguyên chữ của nguồn.
- **Thông tin chưa có loại hiển thị như hiện nay.** Không gì bị ẩn hay đổi.

### 3.4 Biên tập và duyệt

- **Form đề xuất thông tin:** chọn loại (lọc theo đối tượng đang nhập), rồi form hiện đúng các ô
  cấu trúc. Vẫn có thể nhập thông tin không có loại.
- **Người duyệt:** checklist thêm một dòng "giá trị có cấu trúc khớp với câu trích".
- **Quản trị:** trang `/admin/metrics` thành **"Loại thông tin"**, dùng lại quyền `metrics.manage`
  (đổi tên hiển thị thành "Quản lý loại thông tin"). Có cột "Dùng để so sánh".

### 3.5 Trích xuất bằng AI

- Danh sách loại đang dùng được đưa vào yêu cầu gửi cho AI. AI đề xuất loại + giá trị có cấu trúc.
- Kiểm tra tự động hiện có giữ nguyên (câu trích nguyên văn, con số có trong câu trích), thêm kiểm
  tra theo `value_kind`.
- AI không chắc loại thì để trống loại, như hiện nay. Người duyệt vẫn quyết định mọi thứ.

### 3.6 Những gì L3 mở khóa (làm ở task khác)

- Thẻ chương trình có học phí, hạn nộp, IELTS (C2, KHLOE-147).
- Lọc theo học phí tối đa và IELTS (KHLOE-127).
- Đối chiếu điều kiện đầu vào và ngân sách (Slice 12a, KHLOE-114).
- Bảng so sánh có dữ liệu thật (B1 tự mở lại khi đủ ngưỡng).

## 4. Bảo mật, RLS, toàn vẹn

- **Đọc:** `fact_types` công khai như chỉ số hiện nay (định nghĩa, không phải dữ liệu).
- **Ghi:** chỉ qua hàm `SECURITY DEFINER` có kiểm quyền và ghi nhật ký.
- **RLS:** chính sách của `facts` không đổi; cột mới theo đúng quy tắc hiển thị cũ.
- **Không có dữ liệu được tạo sẵn:** migration không chèn loại thông tin nào (giống quyết định về
  chỉ số và hướng nghề). Danh sách ở mục 6 chỉ là bản nháp định nghĩa.

## 5. Kiểm thử

- **PGlite (database):**
  - đổi tên bảng/cột không mất ràng buộc;
  - `propose_fact` từ chối khi thiếu hoặc sai cột cấu trúc, số ngoài khoảng, số không có trong câu
    trích, loại ngừng dùng hoặc sai đối tượng;
  - mã và `value_kind` không đổi được;
  - quyền và RLS.
- **Domain:** định dạng giá trị theo ngôn ngữ; chọn tiêu đề Việt/Anh; đọc ô form.
- **Trang:** thông tin có loại hiện tiêu đề Việt/Anh + "Nguồn ghi"; thông tin không loại hiện như
  cũ; form đổi ô theo loại; trang so sánh chỉ lấy loại `comparable`.

## 6. Bản nháp loại thông tin cho hành trình Thụy Điển (chỉ là định nghĩa)

Chủ dự án tạo trên giao diện, hoặc yêu cầu Claude nhập giúp như với hướng nghề. Không có giá trị
nào ở đây.

| key | Tên VI | value_kind | applies_to | Ghi chú |
|---|---|---|---|---|
| `tuition_fee` | Học phí | money (kỳ: năm/học kỳ/toàn khóa) | programme | comparable |
| `application_fee` | Phí nộp hồ sơ | money (một lần) | country | |
| `application_deadline` | Hạn nộp hồ sơ | date | programme | dùng cùng `deadline_type` đã có |
| `programme_duration` | Thời lượng chương trình | number (tháng) | programme | |
| `teaching_language` | Ngôn ngữ giảng dạy | text | programme | |
| `min_ielts_overall` | IELTS tối thiểu (overall) | number 0–9 | programme | |
| `min_toefl_ibt` | TOEFL iBT tối thiểu | number 0–120 | programme | |
| `prior_degree_requirement` | Yêu cầu bằng trước | text | programme | |
| `residence_permit_fee` | Lệ phí giấy phép cư trú | money (một lần) | immigration_rule | comparable |
| `permit_processing_time` | Thời gian xử lý hồ sơ | number (tuần) | immigration_rule | |
| `maintenance_requirement` | Mức chứng minh tài chính | money (tháng) | immigration_rule | comparable |
| `work_during_studies` | Làm thêm khi học | text | immigration_rule | |
| `post_study_permit_duration` | Giấy phép sau tốt nghiệp | number (tháng) | immigration_rule | |
| `median_salary` | Lương trung vị | money (tháng) | occupation | comparable |

## 7. Chia phần và ước lượng

| Phần | Nội dung | Ước lượng |
|---|---|---|
| **L3a** | migration (đổi tên, cột mới, ràng buộc, `propose_fact`, hàm lưu loại); trang quản trị "Loại thông tin"; form đề xuất có ô cấu trúc; test | khoảng 1 slice |
| **L3b** | hiển thị công khai (tiêu đề Việt/Anh, "Nguồn ghi", định dạng số); trang so sánh dùng `comparable` | nhỏ |
| **L3c** | đưa loại vào AI extraction và kiểm tra theo `value_kind` | nhỏ |

Thứ tự: L3a → L3b → (bạn nhập dữ liệu Thụy Điển có loại) → C2 và lọc → L3c khi muốn tăng tốc
nhập liệu.

## 8. Không làm trong L3

- Quy đổi tiền tệ (chờ quyết định nguồn tỷ giá, US-102).
- Tự gán loại cho thông tin cũ: 36 thông tin hiện có (8 đang công khai) giữ nguyên; muốn có loại thì đề xuất lại.
- Dịch giá trị hay câu trích của nguồn.

## 9. Quyết định cần chủ dự án

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 | Mở rộng "Chỉ số so sánh" thành "Loại thông tin" (một danh mục), hay tạo bảng riêng? | **Mở rộng** — tránh hai danh mục; hiện 0 dòng nên đổi tên an toàn |
| D2 | Quyền quản lý loại thông tin | **Dùng lại `metrics.manage`**, đổi tên hiển thị |
| D3 | Áp quy tắc "con số phải có trong câu trích" cho người nhập tay | **Có** — chặn gõ nhầm, giống AI |
| D4 | Thông tin cũ không có loại | **Giữ nguyên**, không tự gán |
| D5 | Danh sách loại ở mục 6 | Bạn sửa/duyệt; sau đó bạn tạo trên UI hoặc nhờ Claude nhập |
| D6 | Thứ tự L3a → L3b → L3c như mục 7 | **Có** |
