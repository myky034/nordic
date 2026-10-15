# Kế hoạch L5 — Màn hình "Ghép thông tin" từ trang đã crawl (giai đoạn 1)

> **Trạng thái:** chủ dự án **đã duyệt** (2026-10-14, "đồng ý tất cả"), Q1–Q6 theo đề xuất ở mục 11.
> **L5a, L5b, L5c đã code** (`docs/learning/slice-l5-mapping-screen.md`); còn chạy migration và thử tay.
> **O3 (tự duyệt khi chỉ có 1 người duyệt): đang chờ quyết định.** Kế hoạch này không thay đổi luật
> hiện tại về chuyện đó (xem mục 8).
> Bối cảnh: các lần chạy AI trên trang Stockholm University (14/10). Mỗi trường có cấu trúc trang
> khác nhau, nên chủ dự án muốn một màn hình trung gian để tự ghép thông tin thay vì dựa hoàn toàn
> vào AI hay một template chung.
> Liên quan: L3 (loại thông tin), L3c (gắn thông tin vào chương trình theo URL), L4 (thông tin linh hoạt).

---

## 1. Vấn đề

| Tình huống hôm nay | Hậu quả |
|---|---|
| AI bỏ sót thông tin có trên trang ("English 6", "mid-October to mid-January") | Phải sửa prompt, tạo loại, chạy lại AI |
| Muốn tự thêm thông tin: phải mở trang gốc, copy câu, sang form "Thêm thông tin", chọn tài liệu, chọn chương trình, điền 6–8 ô | Chậm; dễ chép sai câu trích |
| Không biết trang còn thiếu gì | Phải tự đọc lại từng trang |
| AI tạo đề xuất trùng khi chạy lại ("two years" lần 2) | Thêm việc duyệt vô ích |
| Câu trích **nhập tay** không bị kiểm tra có thật trong trang (chỉ AI bị kiểm tra) | Lỗ hổng nhỏ của luật chống bịa |

## 2. Mục tiêu

1. Mở **một trang đã crawl**, thấy **nội dung trang** cạnh **danh sách thông tin cần có**.
2. **Bôi đen** một đoạn → chọn **loại** → **Lưu**: thành đề xuất, câu trích đúng nguyên văn, tự gắn
   chương trình. Không copy-paste, không điền lại các ô lặp đi lặp lại.
3. Thấy ngay **AI đã lấy từ câu nào** (tô màu) và **duyệt / từ chối / gắn loại tại chỗ**.
4. Không tạo **trùng**; mọi đường vào đều qua **cùng luật chống bịa**.

**Không phải mục tiêu của giai đoạn 1:** lưu thành luật tự động cho cả trường (giai đoạn 2), lấy phần
trang cần JavaScript (Playwright, kế hoạch riêng), ứng dụng di động.

## 3. Màn hình

**Địa chỉ:** `/facts/map/[tài liệu]`. Nằm trong khu biên tập; cần quyền *Đề xuất thông tin* hoặc
*Duyệt đề xuất*.

**Lối vào:**
- trang tài liệu (`/documents/[id]`): nút "Ghép thông tin", chỉ biên tập viên thấy;
- thẻ đề xuất trong `/facts/workspace`: "Mở trang để ghép";
- trang chương trình, cho biên tập viên: "Ghép thông tin từ trang chính thức", nếu đã crawl trang đó.

```
┌─ SPROM – Stockholm University · su.se · lấy ngày 14/10/2026 ─────────────────────────────────┐
│ Trang này là của: One Year Master's Programme in IT Project Management (khớp URL)            │
├──────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ NỘI DUNG TRANG                               │ THÔNG TIN CẦN CÓ (chương trình học)           │
│                                              │ ✅ Thời lượng        two years        đã duyệt │
│ How to apply                                 │ ✅ Bằng cấp trước    A Bachelor…      đã duyệt │
│ …only possible to apply for this programme   │ 🟡 Đợt nộp hồ sơ     mid-October… [Duyệt][✕]  │
│ in the first admission round                 │ 🟡 Tiếng Anh         English 6…   [Duyệt][✕]  │
│ ░(mid-October to mid-January)░  ← AI         │ ⬜ Học phí           chưa có                   │
│                                              │ ⬜ Số tín chỉ        chưa có                   │
│ Eligibility A Bachelor degree with …         │ ⬜ Hình thức học     chưa có                   │
│ ▓60 credits Programme code: SPROM▓ ← bôi đen │ ⬜ Ngôn ngữ giảng dạy chưa có                  │
│  ┌──────────────────────────────────────┐    │                                               │
│  │ Gán vào   [Số tín chỉ ▼]             │    │ Thông tin khác từ trang này (không loại): 1   │
│  │ Giá trị   [60 credits            ]   │    │                                               │
│  │ Con số    [60] (không bắt buộc)      │    │ [Yêu cầu AI trích xuất trang này]             │
│  │ ⚠ Câu trích ngắn: [Mở rộng cả câu]   │    │                                               │
│  │ [Lưu đề xuất]                        │    │                                               │
│  └──────────────────────────────────────┘    │                                               │
└──────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 3.1 Cột trái: nội dung trang

- Văn bản crawler đã lưu (`document_texts`), giữ xuống dòng như trang gốc. Chỉ biên tập viên xem
  được, như hiện nay.
- **Tô màu** những đoạn đã có thông tin: vàng = đang chờ duyệt, xanh = đã duyệt. Vị trí được tìm
  bằng cách so câu trích với văn bản, bỏ qua khác biệt khoảng trắng. Câu trích không tìm thấy (ví dụ
  trang đã đổi) vẫn có trong danh sách bên phải, kèm ghi chú "không tìm thấy trên phiên bản này".
- **Bôi đen** một đoạn thì mở khung ghép ngay cạnh:
  - **Câu trích** = đoạn bôi đen, tối đa 500 ký tự.
  - Đoạn dưới 20 ký tự (như "60 credits") thì có nút **"Mở rộng cả câu/dòng"**, nối thêm dòng kế
    bên để đủ ngữ cảnh.
  - **Giá trị** điền sẵn bằng đoạn bôi đen, sửa được (ví dụ rút gọn).
  - **Con số / tiền tệ / kỳ / ngày** hiện theo kiểu của loại đã chọn, không bắt buộc (L4).
  - Các ô kỹ thuật được **điền sẵn**, mở "Chi tiết" để sửa nếu cần:
    - chủ đề: theo nhóm của loại (giáo dục → education, học phí → tuition, ngôn ngữ → language…);
    - đối tượng: tên chương trình;
    - thuộc tính: tên tiếng Anh của loại;
    - quốc gia: của chương trình.

### 3.2 Cột phải: thông tin cần có

- Với **trang chương trình**, danh sách = các ô "Thông tin chính" của trang chương trình công khai
  (`lib/education/programme-slots.ts`), nên hai nơi luôn khớp nhau. Đề xuất mở rộng các ô (Q2):

  | Ô | Loại lấp ô |
  |---|---|
  | Học phí | `tuition_fee` |
  | Hạn / đợt nộp hồ sơ | `application_deadline`, `application_period` |
  | Thời lượng | `programme_duration`, (`programme_duration_text` cũ) |
  | Số tín chỉ | `programme_credits` |
  | Hình thức học | `study_mode` |
  | Ngôn ngữ giảng dạy | `teaching_language` |
  | Yêu cầu tiếng Anh | `english_requirement`, `min_ielts_overall`, `min_toefl_ibt` |
  | Bằng cấp trước | `prior_degree_requirement` |

  Việc này đồng thời giải quyết câu hỏi còn mở "thêm ô cho tiếng Anh, hình thức học" trên trang
  chương trình công khai.
- Trang của **trường / quy định nhập cư**: danh sách = các loại đang dùng cho đối tượng đó.
- Trang **không khớp đối tượng nào**: chỉ ghép được loại cấp quốc gia hoặc thông tin không loại.
  Màn hình nói rõ lý do ("URL trang không trùng `official_url` của chương trình nào").
- Mỗi dòng: trạng thái (chưa có / chờ duyệt / đã duyệt), giá trị, và nút **Duyệt / Từ chối** cho
  người có quyền duyệt. Hai nút này dùng đúng `review_fact()` như hàng chờ, ghi chú vẫn bắt buộc như
  hiện nay.

## 4. Thay đổi database (L5a)

| # | Thay đổi | Vì sao |
|---|---|---|
| D1 | Hàm chỉ-đọc `editor_document_entity(tài liệu)` cho biên tập viên: trả về loại, id, tên, quốc gia của đối tượng khớp URL | Hàm `document_entity` (L3c) đang khóa, chỉ worker AI dùng; màn hình cần biết trang là của chương trình nào |
| D2 | **Luật trùng chung** `fact_duplicate_of()`, dùng cho cả AI và nhập tay. Coi là trùng một thông tin chưa bị từ chối **trên cùng tài liệu** khi: (a) cùng đối tượng + thuộc tính + giá trị (luật cũ); **hoặc** (b) cùng giá trị và cùng loại (hoặc một bên chưa có loại); **hoặc** (c) cùng loại và câu trích mới nằm trong câu trích cũ (hoặc ngược lại) | Hôm nay AI tạo lại "two years" và nửa câu "A Bachelor degree…". Với (b) và (c), cả hai sẽ được ghi "duplicate", không vào hàng chờ |
| D3 | `propose_fact()` (nhập tay): nếu tài liệu có văn bản crawl thì **câu trích phải có trong văn bản** (cùng cách so như AI). Tài liệu không có văn bản (nhập qua API) thì giữ như cũ | Đóng lỗ hổng: luật chống bịa áp dụng cho mọi đường vào, không riêng AI (AGENTS.md §1) |
| D4 | `propose_fact()` từ chối bản trùng (D2) với mã lỗi mới `facts_duplicate`; màn hình báo trước khi lưu, kèm link tới thông tin đã có | Không tạo hai bản giống nhau bằng tay |

Không thêm bảng mới. Không đổi RLS của bảng nào; chỉ thêm 1 hàm đọc (D1) có kiểm quyền.

## 5. Luồng

```
crawler → document_texts
            │
            ▼
 /facts/map/[tài liệu] ── editor_document_entity() → "trang của chương trình X"
   │ cột trái: văn bản + tô màu các thông tin đã có
   │ cột phải: danh sách cần có (programme-slots)
   │
   ├─ bôi đen → chọn loại → [Lưu] → propose_fact()  (kiểm: câu trích có trong trang, không trùng, loại hợp)
   ├─ [Yêu cầu AI] → request_extraction() → worker → extractor_propose() (luật trùng chung)
   └─ [Duyệt]/[Từ chối] → review_fact()      [Gắn loại] → set_fact_type() (L4)
```

## 6. Chia phần và ước lượng

| Phần | Nội dung | Ước lượng |
|---|---|---|
| **L5a** | Migration D1–D4; test PGlite (trùng theo (a)(b)(c), câu trích nhập tay phải có trong trang, quyền của hàm đọc) | ~½–1 buổi |
| **L5b** | Màn hình `/facts/map/[id]`: cột trái (văn bản, tô màu, bôi đen → khung ghép), cột phải (danh sách, duyệt tại chỗ), lối vào; chuỗi Việt/Anh; test | ~1½ buổi |
| **L5c** | Mở rộng ô "Thông tin chính" (Q2) trên trang công khai; tài liệu học; dọn dẹp | ~½ buổi |

Thứ tự: L5a → L5b → L5c. Bạn chạy migration sau L5a như thường lệ.

## 7. Kiểm thử

1. Bôi đen → lưu: đề xuất có câu trích đúng đoạn bôi đen, gắn đúng chương trình và quốc gia.
2. Câu trích không có trong văn bản trang → từ chối (D3); tài liệu không có văn bản → vẫn nhận.
3. Trùng (a), (b), (c) với AI → `duplicate`; với nhập tay → `facts_duplicate`. Bản bị từ chối
   trước đó không tính là trùng.
4. `editor_document_entity`: biên tập viên đọc được; khách và người không có quyền thì không.
5. Tô màu: câu trích có xuống dòng hay khoảng trắng khác vẫn tìm đúng vị trí; không tìm thấy → ghi chú.
6. Danh sách cần có: "đã duyệt", "chờ duyệt", "chưa có" đúng theo thông tin của chương trình.
7. Trang công khai: các ô mới (tiếng Anh, hình thức học, tín chỉ, đợt nộp) hiện đúng.

## 8. Bảo mật, quyền, điều không đổi

- **Quyền:** ghép cần *Đề xuất thông tin*; duyệt tại chỗ cần *Duyệt đề xuất*. Không thêm quyền mới.
- **O3 (tự duyệt) đang chờ quyết định:** kế hoạch **giữ nguyên** luật hiện tại. Người có cả hai quyền
  vẫn đề xuất rồi tự duyệt được, như ở `/facts/workspace` hôm nay. Màn hình không thêm nút "ghép và
  duyệt luôn": ghép tạo đề xuất, duyệt là một bước bấm riêng, có ghi chú và ghi lịch sử. Khi O3 được
  quyết, luật sẽ áp dụng ở database cho mọi màn hình cùng lúc.
- Văn bản trang chỉ biên tập viên xem (RLS `document_texts_editors`, không đổi).
- Mọi thông tin vẫn ẩn tới khi duyệt; câu trích phải có thật trong trang; con số phải có trong câu
  trích; không quy đổi.
- Không crawl thêm, không gọi dịch vụ ngoài mới.

## 9. Giới hạn đã biết

- Chỉ có những gì crawler lấy được. Phần thu gọn tải bằng JavaScript (motivation letter, tiêu chí
  xét tuyển của SU) vẫn không thấy, cần Playwright (kế hoạch riêng).
- Bôi đen 2 cột chủ yếu dùng trên **máy tính**. Điện thoại: một cột, chạm vào dòng để chọn.
- Trang rất dài (gần 50 000 ký tự) vẫn hiển thị được, nhưng nên dùng ô tìm trong trang (Ctrl/Cmd+F).

## 10. Giai đoạn 2 (chỉ ghi lại, không làm bây giờ)

Mỗi lần ghép có thể lưu thành **luật cho cả trường** (ví dụ "dòng sau 'Programme code:' → mã
chương trình"); các trang cùng nguồn tự có đề xuất theo luật, vẫn qua duyệt. Chỉ lên kế hoạch sau khi
đã dùng giai đoạn 1 với vài trường và thấy mẫu lặp lại.

## 11. Câu hỏi cần bạn quyết

| # | Câu hỏi | Đề xuất của mình |
|---|---|---|
| Q1 | Địa chỉ `/facts/map/[tài liệu]` và 3 lối vào ở mục 3 | **Đồng ý** |
| Q2 | Mở rộng ô "Thông tin chính" thành 8 ô như bảng 3.2 (dùng chung cho màn hình ghép và trang công khai) | **Đồng ý** |
| Q3 | Luật trùng chung (a)(b)(c) cho cả AI và nhập tay; nhập tay trùng thì chặn, kèm link thông tin cũ | **Đồng ý** |
| Q4 | Câu trích nhập tay phải có trong văn bản trang (khi tài liệu có văn bản) | **Đồng ý** |
| Q5 | Điền sẵn chủ đề / đối tượng / thuộc tính / quốc gia, sửa được trong "Chi tiết" | **Đồng ý** |
| Q6 | Duyệt / từ chối ngay trên màn hình ghép (cùng luật với hàng chờ; O3 vẫn chờ) | **Đồng ý** |

Bạn trả lời "đồng ý tất cả" hoặc nêu câu nào muốn khác. Sau đó mình ghi vào Decision Log và bắt đầu
L5a.
