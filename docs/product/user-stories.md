# User stories — Nordic (bản viết lại 0.2, 2026-10-13)

> Viết lại từ bản 0.1 (13/10/2026) do chủ dự án cung cấp, cho khớp với phạm vi và nguyên tắc của
> Nordic: AGENTS.md, PROJECT_SPEC.md và Decision Log.
> Mỗi story có **trạng thái so với hệ thống hiện tại** và, nếu đụng nguyên tắc dự án, mục
> **Cần quyết định**. Bản này chưa được duyệt; chưa story nào được thêm vào phạm vi chỉ vì có mặt ở đây.
>
> Task tổng quát tương ứng nằm trên Linear (project Nordic, milestone "Backlog sản phẩm · User stories v0.2").

## 0. Những điểm đã điều chỉnh so với bản 0.1

| Điểm trong bản 0.1 | Điều chỉnh | Lý do |
|---|---|---|
| "châu Âu hoặc Úc" | Chỉ châu Âu: 5 nước đang có (Thụy Điển, Đan Mạch, Phần Lan, Na Uy, Hà Lan), bắt đầu với Thụy Điển | Phạm vi của PROJECT_SPEC; mở rộng nước khác là quyết định riêng |
| "Gợi ý quốc gia phù hợp" | "Các nước khớp với lựa chọn của bạn", phương pháp công khai | AGENTS.md §11, §15: không "nước tốt nhất", không điểm tin cậy ngầm |
| "Ước lượng an toàn / vừa sức / tham vọng" (US-205) | Thay bằng đối chiếu từng điều kiện đầu vào (Slice 12a) | Quyết định 2026-10-07: không dự đoán khả năng trúng tuyển |
| Ranking QS / THE / ARWU (US-202) | Chỉ làm nếu điều khoản của bên xếp hạng cho phép | Dữ liệu có bản quyền; AGENTS.md §8 |
| Nội dung tài trợ / đối tác (US-802) | Hiện không có nội dung trả phí; nếu sau này có thì gắn nhãn rõ | AGENTS.md §2: không tự thêm mô hình kiếm tiền |
| Mọi số liệu | Có nguồn, ngày lấy, ngày xác minh, hiệu lực; thiếu thì ghi "chưa rõ" | AGENTS.md §1, §12, §20, §23 |

**Ký hiệu trạng thái:** ✅ Đã có · 🟡 Một phần · 🆕 Mới · ⚖️ Cần quyết định · ⛔ Không làm.
**Ưu tiên (MoSCoW):** M = Must · S = Should · C = Could · W = Won't.

## 1. Personas

- **P1 – Minh, 22 tuổi, sinh viên năm cuối.**
  - Muốn học thạc sĩ CNTT ở châu Âu rồi ở lại làm việc. Ngân sách hạn chế, cần học bổng hoặc làm thêm.
  - Nỗi đau: thông tin rải rác, cũ, khó so sánh giữa các nước.
- **P2 – Lan, 28 tuổi, đã đi làm 5 năm.**
  - Muốn chuyển ngành và định cư cùng chồng.
  - Quan tâm visa phụ thuộc, thuế, chi phí cho 2 người, việc làm cho vợ/chồng.
- **P3 – Bác Hùng, 50 tuổi, phụ huynh.**
  - Quan tâm an toàn, tổng chi phí, cơ hội ở lại.
  - Không rành tiếng Anh, sợ bị "vẽ" thông tin hoặc lừa đảo.

## 2. Epics

| # | Epic | Liên quan trong Nordic |
|---|---|---|
| E1 | Khám phá & so sánh quốc gia | Trang quốc gia, `/compare` (Slice 7) |
| E2 | Tìm trường & chương trình | Slice 5, 11b, 11c |
| E3 | Visa & pháp lý | Slice 6 (quy định nhập cư, chỉ nguồn T1) |
| E4 | Tài chính | Thông tin có nguồn (Slice 4), Slice 12a |
| E5 | Cuộc sống ở nước sở tại | Chưa có |
| E6 | Sau tốt nghiệp | Slice 6b (lao động), một phần Slice 6 |
| E7 | Cá nhân hoá & lộ trình | Slice 8, Slice 12 |
| E8 | Độ tin cậy & cộng đồng | Nền tảng của toàn hệ thống (Slice 2–4) |

## 3. User stories

### E1 – Khám phá & so sánh quốc gia

**US-101 (M) ⚖️ Chọn nước theo lựa chọn của mình**
Là sinh viên chưa biết chọn nước nào, tôi muốn trả lời vài câu ngắn (ngân sách, ngành, ngôn ngữ học, muốn ở lại hay về), để thấy những nước khớp với lựa chọn của mình kèm lý do.
- AC1: Tối đa 8 câu, xong dưới 2 phút, dùng được trên điện thoại.
- AC2: Mỗi nước trong kết quả nêu **tiêu chí nào khớp, tiêu chí nào không, và dữ liệu nào còn thiếu**. Mỗi ý có nguồn.
- AC3: Ghi rõ "kết quả lọc theo lựa chọn của bạn, không phải khuyến nghị"; không xếp hạng, không chấm điểm.
- AC4: Sửa câu trả lời mà không mất kết quả cũ. Nếu đã đăng nhập, câu trả lời lưu vào Kế hoạch châu Âu.
- Cần quyết định: quy tắc khớp cụ thể là gì (công khai trên trang); có lưu khi chưa đăng nhập không.

**US-102 (M) 🟡 So sánh 2–3 nước song song**
Là người dùng, tôi muốn so sánh 2–3 nước theo cùng tiêu chí (học phí, sinh hoạt phí, visa, quyền làm thêm, đường định cư, thuế), để quyết định nhanh.
- Đã có: `/compare` theo chỉ số do quản trị viên định nghĩa, mỗi ô có nguồn và ngày.
- AC1: Chọn 2–3 nước; bộ tiêu chí cố định cho du học.
- AC2: Quy đổi tiền tệ (mặc định VND, đổi được USD/EUR), **ghi nguồn và ngày của tỷ giá**; số gốc luôn hiện bên cạnh.
- AC3: Chia sẻ được bằng link (lựa chọn nằm trong URL).
- Cần quyết định: nguồn tỷ giá (ví dụ ngân hàng trung ương), tần suất cập nhật.

**US-103 (S) 🆕 Chi tiêu mẫu một tháng ở từng thành phố**
Là người dùng, tôi muốn xem chi tiêu mẫu một tháng ở từng thành phố, để hình dung cuộc sống.
- AC: Từng khoản có nguồn (ví dụ mức sinh hoạt phí cơ quan di trú yêu cầu, số liệu thống kê). Khoản không có nguồn chính thức thì ghi là ước tính của người dùng hoặc trải nghiệm (T4).

### E2 – Tìm trường & chương trình

**US-201 (M) 🟡 Lọc chương trình theo nhiều tiêu chí**
Là người dùng, tôi muốn lọc theo nước, ngành, bậc học, học phí tối đa, yêu cầu IELTS/GPA, để thu hẹp danh sách.
- Đã có: danh sách chương trình. Bộ lọc ngành / hướng nghề nằm trong Slice 11c.
- AC1: Kết hợp nhiều tiêu chí; kết quả cập nhật khi đổi lựa chọn.
- AC2: Hiện số kết quả.
- AC3: Khi 0 kết quả: cho biết tiêu chí nào đang loại nhiều nhất.
- AC4: Chương trình **thiếu dữ liệu** cho một tiêu chí thì ghi "chưa rõ", không bị coi là đạt hay không đạt.
- Phụ thuộc: điều kiện đầu vào ở dạng có cấu trúc (Slice 12a).

**US-202 (M) ⚖️ Xếp hạng trường có nguồn**
Là người dùng, tôi muốn xem xếp hạng kèm tên bảng xếp hạng, năm và lĩnh vực, để hiểu mỗi bảng đo gì.
- AC1: Ưu tiên xếp hạng theo ngành, không chỉ xếp hạng tổng.
- AC2: Mỗi bảng có giải thích ngắn: đo gì, hạn chế gì.
- AC3: Không dùng xếp hạng để tự sắp xếp hay "gợi ý" trường.
- Cần quyết định: điều khoản sử dụng của QS / THE / ARWU (có được lưu và hiển thị không). Nếu không được: chỉ để link tới trang của bên xếp hạng.

**US-203 (M) 🟡 Trang chương trình đầy đủ**
Là người dùng, tôi muốn trang chương trình có học phí, hạn nộp, điều kiện đầu vào, học bổng, tình hình việc làm, để khỏi mở nhiều tab.
- Đã có: trang trường/chương trình; học phí và hạn nộp dưới dạng thông tin có nguồn.
- AC: Mỗi mục có nguồn và ngày xác minh; mục chưa có dữ liệu ghi "chưa có thông tin".

**US-204 (S) ⚖️ Tỷ lệ chấp nhận của sinh viên Việt Nam**
- Chỉ làm nếu có nguồn công bố chính thức (trường hoặc cơ quan thống kê). Không tự ước tính.

**US-205 ⛔ Ước lượng "an toàn / vừa sức / tham vọng"**
- Không làm: quyết định 2026-10-07 là không dự đoán trúng tuyển. Thay bằng US-205b.
- **US-205b (S):** đối chiếu hồ sơ với từng điều kiện đầu vào (đạt / chưa đạt / chưa rõ), thuộc Slice 12a.

### E3 – Visa & pháp lý

**US-301 (M) 🟡 Visa du học từng nước**
Là người dùng, tôi muốn xem các loại visa du học: điều kiện, hồ sơ, lệ phí, thời gian xử lý, để chuẩn bị đúng.
- Đã có: quy định nhập cư từ nguồn T1, có ngày xác minh và cảnh báo pháp lý.
- AC1: Checklist hồ sơ **in / tải PDF được**, mỗi mục có link tới trang cơ quan di trú.
- AC2: Ngày xác minh gần nhất hiển thị nổi bật; quá hạn rà soát thì cảnh báo "có thể đã cũ".
- AC3: Câu "thông tin tham khảo, không phải tư vấn pháp lý" luôn hiện.

**US-302 (M) 🟡 Làm thêm và quyền lợi lao động**
Là người dùng, tôi muốn biết quy định làm thêm khi học (giờ/tuần, điều kiện) và quyền lợi lao động cơ bản, để không bị bóc lột.
- AC: Chỉ từ nguồn nhà nước (T1). Lương tối thiểu chỉ ghi khi nước đó có quy định chính thức; không thì nói rõ là không có.

**US-303 (S) 🆕 Visa cho người đi cùng (vợ/chồng/con)**
- AC: Ai được đi cùng, vợ/chồng có được làm việc không, con đi học thế nào. Chỉ nguồn T1.

**US-304 (S) 🆕 Lý do hay bị từ chối visa**
- AC: Chỉ ghi lý do mà cơ quan di trú công bố. Kinh nghiệm cá nhân phải gắn nhãn "trải nghiệm", tách riêng.

**US-305 (C) ⚖️ Báo khi chính sách thay đổi**
- Đã có nền: crawler phát hiện trang nguồn đổi, biên tập viên duyệt lại.
- Cần quyết định: gửi thông báo cho người dùng (email/web) là hạ tầng mới; cần người dùng đồng ý nhận.

### E4 – Tài chính

**US-401 (M) 🟡 Tính tổng chi phí du học**
Là người dùng, tôi muốn tính tổng chi phí (học phí, sinh hoạt, bảo hiểm, visa, vé máy bay, chứng minh tài chính) theo thành phố, để biết cần bao nhiêu tiền.
- Liên quan: Slice 12a (ngân sách).
- AC1: Từng khoản chỉnh được; khoản do người dùng tự nhập ghi rõ là của họ.
- AC2: Kết quả theo tháng và theo năm.
- AC3: Mỗi con số mặc định có nguồn. Mức "tiết kiệm / trung bình / thoải mái" chỉ có khi có nguồn cho từng mức.

**US-402 (M) 🟡 Mức lương theo ngành và nước**
- Đã có: số liệu lao động có kỳ và nguồn (Slice 6b).
- AC1: Hiện khoảng (thấp – trung vị – cao) **đúng như nguồn công bố**.
- AC2: Lương sau thuế chỉ là phép tính minh bạch từ biểu thuế chính thức; quy đổi VND ghi ngày tỷ giá.
- AC3: Không tính "thời gian hoàn vốn" như một dự đoán.

**US-403 (M) ⚖️ Hiểu thuế và tính lương gross → net**
- AC: Biểu thuế từ cơ quan thuế (T1), năm áp dụng, cảnh báo không phải tư vấn thuế.
- Cần quyết định: mức độ chi tiết (chỉ thuế thu nhập cơ bản, hay cả thuế địa phương, bảo hiểm xã hội).

**US-404 (S) 🟡 Tìm học bổng**
- Đã có: học bổng có thể nhập là thông tin gắn với trường.
- Cần: dữ liệu có cấu trúc (giá trị, hạn nộp, đối tượng) và bộ lọc.

**US-405 (C) ⚖️ Chứng minh tài chính và chuyển tiền**
- Chỉ phần chứng minh tài chính theo quy định chính thức. Lời khuyên chuyển tiền / tỷ giá là tư vấn tài chính, nên không làm.

### E5 – Cuộc sống ở nước sở tại

**US-501 (S) 🆕 Nhà ở** — loại hình, giá thuê (nguồn thống kê), cách tìm, cảnh báo lừa đảo thuê nhà.
**US-502 (S) 🆕 Y tế và bảo hiểm cho sinh viên quốc tế** — chỉ nguồn chính thức.
**US-503 (S) 🆕 Văn hoá, khí hậu, an toàn** — số liệu an toàn từ cơ quan thống kê. Không gắn nhãn "thân thiện / không thân thiện" nếu không có phương pháp.
**US-504 (S) ⚖️ Cộng đồng người Việt** — thông tin cộng đồng là nguồn T4: gắn nhãn, không xác nhận thay.
**US-505 (C) ⚖️ Câu chuyện du học sinh** — luôn gắn nhãn "trải nghiệm"; không trình bày như chính sách.

### E6 – Sau tốt nghiệp

**US-601 (M) 🟡 Lộ trình sau tốt nghiệp**
Là người dùng, tôi muốn biết lộ trình: visa tìm việc sau học → giấy phép lao động → thường trú / quốc tịch, để lên kế hoạch dài hạn.
- AC1: Sơ đồ theo thời gian (năm 0 → năm N). Mỗi bước là một quy định đã duyệt (T1).
- AC2: Điều kiện (mức lương tối thiểu, ngành thiếu hụt…) kèm ngày xác minh.

**US-602 (S) 🟡 Ngành đang thiếu nhân lực** — chỉ từ danh sách chính thức (cơ quan việc làm, EURES), có kỳ số liệu.
**US-603 (C) ⚖️ Mua nhà khi là người nước ngoài** — chỉ thông tin chung, có nguồn và cảnh báo.
**US-604 (C) ⚖️ Tiết kiệm / đầu tư, thuế nhiều nước** — chỉ thông tin chung; dễ bị coi là tư vấn.
**US-605 ⛔ Tư vấn đầu tư cá nhân hoá** — không làm (giữ như bản 0.1).

### E7 – Cá nhân hoá & lộ trình

**US-701 (M) 🟡 Shortlist**
- Đã có: "☆ Lưu" và dự án trong Không gian của tôi (cần đăng nhập).
- Cần quyết định: cho lưu khi chưa đăng nhập (chỉ trên trình duyệt), rồi chuyển vào tài khoản khi đăng ký.

**US-702 (S) 🟡 Checklist và mốc thời gian cá nhân** — thuộc Slice 12b. Hạn nộp lấy từ chương trình trong shortlist; mốc không có nguồn là mốc tự đặt.
**US-703 (S) ⚖️ Nhắc hạn qua email / thông báo** — hạ tầng mới, cần người dùng đồng ý (cùng quyết định với US-305).
**US-704 (C) 🆕 Hỏi đáp với trợ lý AI có trích nguồn**
- AC1: Chỉ trả lời từ dữ liệu đã duyệt của Nordic; thiếu thì nói "chưa có thông tin".
- AC2: Mỗi câu có nguồn và ngày; gắn nhãn "AI tổng hợp".
- Ghi chú: cần tìm kiếm ngữ nghĩa (pgvector, đã dự kiến trong kiến trúc) và có chi phí API.

### E8 – Độ tin cậy & cộng đồng

**US-801 (M) ✅ Nguồn và ngày cập nhật cho mọi số liệu** — đã là quy tắc của hệ thống: nguồn, URL, ngày lấy / xác minh, hiệu lực.
**US-802 (M) ⚖️ Phân biệt nội dung khách quan và tài trợ** — hiện không có nội dung trả phí. Nếu sau này có, phải gắn nhãn rõ và tách khỏi dữ liệu đã duyệt.
**US-803 (S) 🆕 Báo thông tin sai bằng một cú bấm** — báo cáo vào hàng chờ của biên tập viên; không tự sửa dữ liệu.
**US-804 (C) ⚖️ Review có xác minh từ du học sinh** — nguồn T4: cách xác minh và kiểm duyệt cần quyết định riêng.

## 4. Yêu cầu phi chức năng

| Nhóm | Yêu cầu | Trạng thái / ghi chú |
|---|---|---|
| Ngôn ngữ | Tiếng Việt chính, tiếng Anh phụ | ✅ nút chuyển VI/EN; nội dung nguồn giữ nguyên |
| Mobile-first | Dùng tốt trên điện thoại; tải trang < 3 giây trên 4G | 🟡 cần đo và đặt ngưỡng |
| SEO | Trang công khai lên Google, URL rõ theo nước / trường | ⚖️ hiện chọn ngôn ngữ bằng cookie nên Google chỉ thấy bản tiếng Việt (quyết định 2026-10-06) |
| Độ chính xác dữ liệu | Mỗi loại dữ liệu có người phụ trách và chu kỳ rà soát (visa hàng quý, xếp hạng hằng năm) | 🟡 có ngày xác minh; chưa có chu kỳ rà soát và cảnh báo quá hạn |
| Bảo mật & riêng tư | Hồ sơ cá nhân là dữ liệu nhạy cảm; cho xoá tài khoản; tuân thủ luật bảo vệ dữ liệu cá nhân của Việt Nam | 🟡 RLS chủ sở hữu, xoá dữ liệu workspace đã có; văn bản luật áp dụng cần xác minh |
| Dễ dùng cho người lớn tuổi | Chữ đủ lớn, tương phản tốt | 🟡 cần kiểm tra |
| Tiền tệ | Quy đổi có nguồn và ngày tỷ giá | 🆕 (cùng US-102) |

## 5. Rủi ro người dùng gặp và cách Nordic xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Dữ liệu lỗi thời | Ngày xác minh nổi bật; crawler báo trang nguồn đổi; cần thêm chu kỳ rà soát |
| Hiểu nhầm là tư vấn pháp lý / thuế | Cảnh báo cố định; chỉ nguồn T1 cho visa, luật, thuế |
| Thiên vị thương mại | Không có nội dung trả phí; nếu có thì gắn nhãn (US-802) |
| Quá tải thông tin | Luồng dẫn dắt theo mục tiêu (trang chủ), quiz (US-101), Kế hoạch châu Âu |
| Hồ sơ không điển hình | Đối chiếu từng điều kiện thay cho một điểm số chung |
| Xếp hạng gây hiểu lầm | Giải thích bảng xếp hạng đo gì; không dùng để gợi ý |
| Lừa đảo (bảo đảm visa, môi giới nhà) | Không bao giờ dùng chữ "bảo đảm"; mục cảnh báo lừa đảo có nguồn chính thức |

## 6. Đề xuất phạm vi đợt tới (để chủ dự án quyết)

Ưu tiên những story dùng được dữ liệu và hạ tầng đang có, cho **Thụy Điển và 1–2 ngành (CNTT, PO/PM)**:
1. Bộ lọc chương trình (US-201) cùng Slice 11c.
2. Trang chương trình đầy đủ (US-203) + đối chiếu điều kiện và ngân sách (US-205b, US-401 = Slice 12a).
3. Visa và làm thêm cho Thụy Điển (US-301, US-302), checklist in được.
4. So sánh 2–3 nước có quy đổi tiền tệ (US-102), sau khi chốt nguồn tỷ giá.
5. Lộ trình sau tốt nghiệp cho Thụy Điển (US-601).

## 7. Câu hỏi mở — trạng thái

| Câu hỏi (bản 0.1) | Trạng thái |
|---|---|
| Đối tượng chính là sinh viên hay người đi làm? | Mở. Hiện phục vụ cả hai; quiz và kế hoạch cho phép chọn vai trò |
| Dữ liệu lấy từ đâu? | Đã có câu trả lời: Source Registry + biên tập viên + crawler + AI đề xuất, luôn có người duyệt |
| Mô hình kiếm tiền? | Chưa có, và không tự thêm (AGENTS.md §2). Mở |
| Ai cập nhật visa / luật? | Biên tập viên có quyền nhập cư + người duyệt; crawler báo thay đổi. Cần chu kỳ rà soát |
| Cần tài khoản từ đầu? | Trang công khai không cần; khu cá nhân cần. Lưu khi chưa đăng nhập: mở (US-701) |
