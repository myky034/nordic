# Rà soát trải nghiệm và nội dung — góc nhìn BA (2026-10-13)

> Bối cảnh: chủ dự án (đóng vai người dùng cuối) thấy web khó dùng, không rõ để làm gì và không đủ
> thông tin để tham khảo. Tài liệu này phân tích nguyên nhân và liệt kê việc cần làm, cải thiện, bỏ.
> Chủ dự án **đã đồng ý hướng đi** ngày 2026-10-13 (Decision Log cùng ngày).
> Task tương ứng: Linear, project Nordic, milestone "UX & nội dung · Đợt 2026-10".

## 1. Chẩn đoán

### Dữ liệu khách nhìn thấy (đếm với quyền khách, 2026-10-13)

| | Thụy Điển | Đan Mạch, Phần Lan, Na Uy, Hà Lan |
|---|---|---|
| Trường | 12 | 0 |
| Chương trình | 1 | 0 |
| Học phí / hạn nộp gắn với chương trình | 0 | 0 |
| Quy định nhập cư | 3 | 0 |
| Thông tin công khai | 7 | 1 (Phần Lan) |
| Chỉ số so sánh | 0 (trang So sánh trống) | |

### Nguyên nhân gốc

1. **Hứa rộng, giao rỗng.** Trang chủ mời chọn 5 nước; 4 nước không có dữ liệu. Câu hỏi chính của
   persona P1 ("thạc sĩ CNTT ở Thụy Điển tốn bao nhiêu, cần gì") chưa có câu trả lời.
2. **Thông điệp nói về phương pháp, không nói về lợi ích.** "Mỗi thông tin đều có nguồn" là lý do
   để tin, không phải lý do để vào.
3. **Cấu trúc theo mô hình dữ liệu, không theo hành trình.** Menu (Thông tin, Nguồn, Tài liệu,
   Bằng chứng, Quy định, Nghề) phản chiếu các bảng của database. Người dùng nghĩ theo các bước:
   chọn trường → đủ điều kiện → chi phí → visa → làm thêm → ở lại.
4. **Cơ chế kiểm chứng lộ quá nhiều với khách.** Nguyên tắc nên là "câu trả lời trước, bằng chứng
   khi bấm vào".
5. **Nội dung nguồn ở dạng tiếng Anh thô.** Thông tin lưu dạng đối tượng – thuộc tính – giá trị theo
   chữ của nguồn. Nút VI/EN chỉ dịch giao diện.

**Điểm nghẽn:** từ nguồn tới trang công khai cần nhiều bước duyệt, và chỉ có một người duyệt.

## 2. Cần làm

| # | Việc | Mức |
|---|---|---|
| L1 | Phủ sâu hành trình "Thạc sĩ CNTT tại Thụy Điển". Mục tiêu: 15–20 chương trình có học phí, hạn nộp, điều kiện tiếng Anh; giấy phép cư trú du học (hồ sơ, lệ phí, thời gian xử lý, chứng minh tài chính); làm thêm; giấy phép sau tốt nghiệp; chi phí sinh hoạt | Urgent |
| L2 | Trang hướng dẫn theo hành trình ("Du học thạc sĩ ở Thụy Điển: từng bước"); mỗi bước lấy thông tin đã duyệt, bước thiếu dữ liệu dẫn tới trang chính thức | High |
| L3 | Danh mục "loại thông tin" có nhãn Việt/Anh, dạng có cấu trúc (học phí/năm, hạn nộp, IELTS tối thiểu, lệ phí giấy phép, thời gian xử lý…). Giá trị nguồn giữ nguyên. **Thay đổi schema: kế hoạch riêng, duyệt trước khi code** | High |
| L4 | "Trang chính thức cần biết" theo từng nước: link nguồn T1 đã xác minh, viết bằng lời thường | High |
| L5 | Trang chủ nói lợi ích và nói thật về độ phủ; vào thẳng bằng câu hỏi | High |
| L6 | Trạng thái trống luôn có lối ra (link chính thức, "sắp có") | High |
| L7 | Kiểm thử với 5 người dùng theo 3 persona | Medium |

## 3. Cần cải thiện

| # | Việc |
|---|---|
| C1 | Menu theo mục tiêu: Du học · Visa & cư trú · Việc làm · Chi phí · So sánh. "Thông tin, Nguồn, Tài liệu" chuyển xuống chân trang, mục "Về dữ liệu" |
| C2 | Thẻ chương trình hiện học phí, hạn nộp, ngôn ngữ, bậc, điều kiện tiếng Anh (cần L3) |
| C3 | Trình bày "câu trả lời trước, nguồn một dòng, chi tiết khi bấm" |
| C4 | Lời thường thay thuật ngữ nội bộ (tier, T1, đề xuất, đối chiếu), có giải thích khi cần |
| C5 | Nhãn độ phủ cho từng nước (Đầy đủ / Một phần / Sắp có) |
| C6 | Gộp "Dự án nghiên cứu" và "Mục đã lưu" thành "Danh sách của tôi" |
| C7 | Dễ đọc cho phụ huynh: cỡ chữ, tương phản, câu ngắn trên điện thoại |
| C8 | Tăng tốc có dữ liệu: chỉ tiêu theo tuần, dùng crawler + AI đề xuất, cân nhắc thêm người duyệt |

## 4. Cần bỏ, ẩn, gộp

| # | Việc |
|---|---|
| B1 | Ẩn trang So sánh tới khi có ít nhất 2 nước × 3 chỉ số |
| B2 | Bỏ 4 nước chưa có dữ liệu khỏi lối vào chính (giữ trang, gắn "Sắp có") |
| B3 | Bỏ "Thông tin", "Tài liệu", "Nguồn" khỏi menu chính (giữ trang) |
| B4 | Ẩn chi tiết kỹ thuật trên trang công khai: mã tier, phiên bản tài liệu, mã băm |
| B5 | Đưa khẩu hiệu "Mỗi thông tin đều có nguồn" xuống thành dòng phụ |
| B6 | Tắt `/dev/preview` trên production |
| B7 | Gộp "Nghề nghiệp" vào "Việc làm"; lương và nhu cầu trước, mã phân loại sau |
| B8 | Hoãn quiz, xếp hạng, trợ lý AI, Slice 12c/12d tới khi có dữ liệu L1 |

## 5. Giữ nguyên

Nguồn, ngày xác minh, người duyệt, không xếp hạng, không dự đoán, cảnh báo pháp lý. Các thay đổi trên
chỉ đổi cách trình bày, không nới quy tắc nào của AGENTS.md.

## 6. Thứ tự

1. Tuần 1–2: L1 (chủ dự án); B1–B7, C1, C4, L6 (phát triển).
2. Tuần 2–3: L3 (kế hoạch → duyệt → làm), C2, C3, Slice 11c.
3. Tuần 3–4: L2, L4, L5.
4. Tuần 5: L7, điều chỉnh. Sau đó Slice 12a.

## 7. Thước đo

Mỗi người kiểm thử tự làm, không có hướng dẫn:
- Tìm học phí và hạn nộp của 3 chương trình thạc sĩ CNTT ở Thụy Điển trong 5 phút.
- Biết cần giấy tờ gì và bao nhiêu tiền cho giấy phép cư trú du học.
- Ước được chi phí một năm và biết con số lấy từ đâu.

## 8. Quyết định

- Đã đồng ý (2026-10-13): hướng đi của tài liệu này. Lối vào chính tạm thu hẹp về Thụy Điển + thạc
  sĩ CNTT. L3 có kế hoạch riêng trước khi code.
- Năng lực duyệt (chủ dự án, 2026-10-13): một người duyệt, khoảng **50–100 tài liệu mỗi tuần**; chưa thêm người. Hành trình Thụy Điển (khoảng 20 trang chương trình + các trang giấy phép, làm thêm, chi phí) vừa trong 1–2 tuần duyệt. Crawler và AI chuẩn bị đề xuất, người duyệt chỉ quyết định.
