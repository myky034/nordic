# Checklist duyệt lô đề xuất AI — 2026-09-26 (Thụy Điển)

Checklist này đi kèm với [2026-09-26-ai-draft-batch.md](2026-09-26-ai-draft-batch.md).
Người duyệt phải có quyền `facts.review`, và **không được** dùng tài khoản "AI draft".
Phần A đến C dùng lại được cho các lô sau; phần D dành riêng cho lô này.

Nguyên tắc chung (AGENTS.md 1.1, 1.3, 1.4):

- AI chỉ đề xuất, còn **bạn** là người quyết định. Nếu không chắc chắn thì đừng bấm
  "Duyệt".
- Bản ghi đã tạo thì **không sửa được**. Nếu có chỗ sai, bấm "Từ chối", ghi lý do, rồi
  tạo đề xuất mới với nội dung đúng.
- Không đoán và không tự điền cho đủ. Nếu nguồn không nêu, để trống, và bản ghi có trường
  bị điền theo kiểu đoán thì từ chối.
- Mỗi quyết định đều cần ghi chú ngắn ở ô "Ghi chú kiểm tra", ví dụ "Đối chiếu trang
  ngày 2026-09-30, khớp nguyên văn".
- Dưới mỗi mục, workspace cho biết mục đó **có công khai sau khi duyệt không**, và nếu
  không thì vì sao (thường là nguồn chưa xác minh).

---

## A. Chuẩn bị (làm một lần)

- [ ] Đăng nhập bằng tài khoản có `facts.review`, không phải tài khoản "AI draft".
- [ ] Mở song song trang nguồn gốc trên trình duyệt để đối chiếu. Các URL nằm trong trang
      `/documents/[id]` của từng tài liệu.
- [ ] Kiểm tra `retrieved_at` của 5 tài liệu trong lô. Nếu trang gốc đã thay đổi so với
      lúc tải về, ghi chú lại và đối chiếu với **nội dung hiện tại**.

## B. Xác minh nguồn — làm TRƯỚC khi duyệt quy định visa và số liệu lương

Vì sao phải làm trước: quy định visa chỉ hiện công khai khi tài liệu bằng chứng thuộc nguồn
**T1 và `verified`**. Số liệu nghề nghiệp và điều kiện visa còn cần nguồn của chính fact
đó cũng phải `verified`. Nếu duyệt trước mà chưa xác minh nguồn, bản ghi vẫn bị ẩn. Đây là
thiết kế đúng, không phải lỗi.

Vào `/admin/sources` và làm các bước sau cho **Migrationsverket** và **SCB**:

- [ ] Tự xác lập thẩm quyền của nguồn, không dựa vào tên hay giao diện trang: tên miền có
      đúng là của cơ quan nhà nước đó không, trang "About" hoặc trang liên hệ có ghi cơ quan
      chủ quản không, có trang chính phủ nào khác dẫn tới tên miền này không.
- [ ] Nếu đủ căn cứ là cơ quan nhà nước thì chọn Source tier `T1`. Nếu chưa chắc thì
      **giữ `needs_verification`**.
- [ ] Ghi vào **Authority notes** (bắt buộc khi chọn `verified`) cách bạn đã xác minh, ví
      dụ: "Domain X được liệt kê trên trang Y của chính phủ Thụy Điển, kiểm tra
      2026-09-30".
- [ ] Đổi trạng thái sang `verified` và lưu. Hệ thống tự ghi ngày `last_verified_at`.
- [ ] Nguồn **Study in Sweden** (dùng cho 12 trường): trường đại học chỉ cần được duyệt là
      hiện công khai, không phụ thuộc trạng thái nguồn. Dù vậy, vẫn nên xác minh và phân
      tier đúng để trang nguồn hiển thị trung thực.

## C. Kiểm tra chung cho MỌI bản ghi

- [ ] **Trích đoạn có thật và khớp nguyên văn** trên trang gốc (dùng Ctrl/Cmd+F). Chênh lệch
      khoảng trắng thì chấp nhận được, nhưng chữ hoặc số khác là không được.
- [ ] **Trích đoạn chứng minh đúng điều được nêu**, không chỉ "có liên quan". Ví dụ: trích
      đoạn nêu mức tài chính cho *sinh viên* thì không dùng làm bằng chứng cho *người đi làm*.
- [ ] **Giá trị khớp với trích đoạn**: đúng số, đúng đơn vị, đúng điều kiện đi kèm như "per
      month", "at least", "from 1 June 2026".
- [ ] **Không có thông tin mà nguồn không nêu**, ví dụ đơn vị tiền tệ, quốc gia hay ngày
      tháng do AI tự thêm vào.
- [ ] **Ngày hiệu lực** (Từ ngày / Đến ngày) chỉ được điền khi nguồn nêu rõ.
- [ ] **Còn hiệu lực**: nếu trang có quy định mới thay thế, hãy ghi chú, và cân nhắc từ chối
      bản ghi đã lỗi thời.
- [ ] **Mâu thuẫn**: nếu có một fact khác đã duyệt nói điều trái ngược, **đừng tự chọn bên
      nào đúng**. Duyệt fact này trước, rồi mở "Đánh dấu mâu thuẫn với thông tin khác" và
      chọn fact đối chiếu (AGENTS.md 1.4).
- [ ] Fact do AI tạo (`origin = 'ai'`): mức tin cậy chỉ là "mô hình tự đánh giá", **không
      được dùng làm căn cứ** để duyệt.

## D. Theo từng loại trong lô này

Mỗi loại có một trang duyệt riêng, và phải duyệt **bản ghi gốc trước, fact gắn với nó
sau**.

### D1. 12 trường đại học — `/education/workspace`

- [ ] Tên chính thức khớp với cách trang nguồn ghi.
- [ ] **Website chính thức** là link mà chính trang Study in Sweden đưa ra. Mở thử để chắc
      rằng link dẫn đúng tới trường đó.
- [ ] ⚠️ Mô tả được lấy từ dữ liệu nhúng trong trang. **Mở trang trên trình duyệt** để xác
      nhận đoạn văn bản thật sự hiển thị cho đúng trường đó. Nếu không thấy, từ chối.
- [ ] Bấm "Duyệt" hoặc "Từ chối".

### D2. 3 quy định nhập cư — `/immigration/workspace`

- [ ] Đã làm xong bước B cho Migrationsverket.
- [ ] Tên chính thức và loại quy định đúng (study / work / look for work, tương ứng với
      các loại `student_residence_permit`, `work_permit`… trên form).
- [ ] "Trang chính thức của quy định" thuộc cùng tên miền với nguồn T1.
- [ ] Bấm "Duyệt" hoặc "Từ chối". Nếu dòng lưu ý báo "kể cả khi duyệt, mục này vẫn chưa
      hiển thị công khai", quay lại bước B.

### D3. 8 điều kiện visa (fact) — `/facts/workspace`, làm SAU D2

Áp dụng toàn bộ phần C, cộng thêm các điểm sau:

- [ ] ⚠️ **Mức tài chính 2026 và 2025**: hai fact phải có kỳ hoặc ngày áp dụng khác nhau.
      Nếu nguồn chỉ còn nêu một mức, xem lại xem mức còn lại có lỗi thời không.
- [ ] ⚠️ **Quy định từ 1/6/2026**: ngày đó phải có trong trích đoạn. Ghi rõ quy định áp dụng
      cho hồ sơ nộp từ ngày nào.
- [ ] ⚠️ **Ngưỡng lương (salary threshold)**: ghi đúng cách nguồn diễn đạt, chẳng hạn % lương
      trung vị hay số tiền cụ thể. Không tự quy đổi.
- [ ] Các điều kiện về nhập học, học phí, bảo hiểm và quyền ở lại sau khi học: kiểm tra
      điều kiện đi kèm, chẳng hạn "only if", "for citizens outside EU/EEA".
- [ ] Nếu nghi ngờ nội dung mang tính tư vấn pháp lý hơn là mô tả quy định thì từ chối.

### D4. 8 nghề nghiệp — `/labour/workspace`

- [ ] Tên nghề khớp với bảng SCB.
- [ ] **Mã SSYK** khớp đúng với mã trên bảng. Hệ phân loại để `national`, vì chỉ ghi khi
      nguồn nêu.
- [ ] Phạm vi là Thụy Điển.
- [ ] Bấm "Duyệt" hoặc "Từ chối".

### D5. 8 số liệu lương (fact) — `/facts/workspace`, làm SAU D4

- [ ] Đã làm xong bước B cho SCB.
- [ ] Con số khớp đúng với ô tương ứng (đúng hàng nghề, đúng cột) trên bảng.
- [ ] Kỳ số liệu là `2025`, đúng như tiêu đề bảng.
- [ ] ⚠️ **Đơn vị tiền tệ**: bảng không ghi, nên đơn vị phải giữ nguyên câu "per month
      (currency not stated in the source table)". **Không** chấp nhận bản ghi đã tự thêm
      "SEK".
- [ ] Không có từ ngữ mang tính dự báo hay lời khuyên nghề nghiệp.

## E. Sau khi duyệt xong

- [ ] Mở các trang công khai `/universities`, `/immigration`, `/occupations`, `/facts` ở
      **cửa sổ ẩn danh** (chưa đăng nhập) và xác nhận:
  - chỉ bản ghi đã duyệt mới hiện;
  - mỗi bản ghi hiện tên nguồn, URL, ngày lấy hoặc xác minh (AGENTS.md 23);
  - fact do AI tạo vẫn hiện nhãn nguồn gốc AI;
  - trang nhập cư luôn có dòng "không phải tư vấn di trú".
- [ ] Thử tìm kiếm ở `/search` với vài từ như "Uppsala", "work permit", "malmo".
- [ ] Ghi kết quả vào cuối [2026-09-26-ai-draft-batch.md](2026-09-26-ai-draft-batch.md):
      ngày duyệt, số bản ghi đã duyệt / từ chối / đánh dấu mâu thuẫn theo từng loại, các
      nguồn đã xác minh, và lỗi giao diện gặp phải (nếu có).
- [ ] Nếu một loại lỗi của AI lặp lại nhiều lần, ví dụ trích đoạn không khớp hay tự thêm
      đơn vị, ghi lại để sau này chỉnh prompt của Slice 10a.
