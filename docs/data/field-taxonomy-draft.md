# Danh mục ngành của Nordic — BẢN NHÁP

> **Trạng thái:** bản nháp do Claude soạn ngày 2026-10-02 để chủ dự án chỉnh sửa.
> **Chưa được duyệt, chưa dùng trong hệ thống.** Cách làm được ghi ở PROJECT_SPEC.md,
> Decision Log, mục "2026-10-02 — Field-of-study focus for education data".
>
> Mọi chỗ ghi **[cần xác minh]** phải được kiểm tra trên nguồn chính thức trước khi dùng.
> Không mục nào trong file này là dữ liệu về một trường hay chương trình có thật.

## Cách dùng file này

Mỗi nhóm ngành là một **định nghĩa**, không phải một cái tên để so khớp. Khi phân loại một
chương trình, người duyệt:

1. đọc trang chính thức của chương trình (trang của trường, Section 7 của spec);
2. so với **tiêu chí tính** và **tiêu chí loại** bên dưới;
3. ghi lại **trích đoạn** trên trang đã dùng để quyết định.

Từ khóa chỉ để **tìm chương trình ứng viên**. Tên chương trình nghe giống không đủ để xếp vào
nhóm. Một chương trình có thể thuộc nhiều nhóm (ví dụ vừa CNTT vừa PO/PM).

Mỗi nhóm có **phiên bản**. Sửa tiêu chí thì tăng phiên bản; các chương trình đã phân loại
theo phiên bản cũ sẽ được đưa vào danh sách duyệt lại.

---

## Nhóm 1 — Công nghệ thông tin (CNTT) · phiên bản 0.1 (nháp)

**Định nghĩa.** Chương trình mà nội dung chính là khoa học máy tính, phát triển phần mềm,
hệ thống thông tin, dữ liệu hoặc hạ tầng CNTT.

**Nhóm con (tùy chọn, để lọc chi tiết hơn):** Khoa học máy tính · Kỹ thuật phần mềm ·
Hệ thống thông tin · Khoa học dữ liệu / Trí tuệ nhân tạo · An ninh mạng · Mạng và hạ tầng.

**Tiêu chí tính** (đủ một trong các điều sau, có trích đoạn trên trang chương trình):
- Trang chương trình nêu một trong các lĩnh vực trên là **lĩnh vực chính** (main field,
  major, focus) của chương trình.
- **Phần lớn học phần bắt buộc** được liệt kê thuộc các lĩnh vực trên.

**Tiêu chí loại:**
- CNTT chỉ là **công cụ** cho một lĩnh vực khác, ví dụ marketing số, thiết kế đồ họa,
  kinh tế lượng. Những chương trình này không tính, trừ khi trang nêu CNTT là lĩnh vực chính.
- Chỉ có **một vài môn CNTT tự chọn** trong một chương trình thuộc lĩnh vực khác.

**Từ khóa tìm ứng viên:**
- Tiếng Anh: computer science, computing, software engineering, software development,
  information systems, informatics, data science, artificial intelligence, machine
  learning, cyber security, information security, computer networks.
- Tiếng địa phương **[cần xác minh với người bản ngữ hoặc trang của trường]**:
  Thụy Điển *datavetenskap, datateknik, informatik, systemvetenskap*;
  Đan Mạch *datalogi, softwareudvikling*; Na Uy *informatikk*;
  Phần Lan *tietojenkäsittelytiede, tietotekniikka*; Hà Lan *informatica*.
  (Phần lớn chương trình thạc sĩ dạy bằng tiếng Anh, nhưng tên khoa hoặc nhóm trên cổng
  tuyển sinh có thể bằng tiếng địa phương.)

**Mã ISCED-F 2013 liên quan [cần đối chiếu tài liệu ISCED-F 2013 chính thức của UNESCO]:**
nhóm **06 — Công nghệ thông tin và truyền thông**, gồm các mã chi tiết như 0611, 0612,
0613, 0619 và 0688 (chương trình liên ngành có CNTT).

---

## Nhóm 2 — Quản lý sản phẩm / dự án công nghệ (PO/PM) · phiên bản 0.1 (nháp)

> Đây là **nhóm do Nordic định nghĩa** theo vai trò nghề nghiệp (Product Owner, Product
> Manager, Project Manager), **không phải ngành học chính thức**. Trên giao diện phải ghi
> rõ như vậy (AGENTS.md §15).

**Định nghĩa.** Chương trình đào tạo quản lý dự án, quản lý sản phẩm hoặc quản lý công nghệ,
có định hướng rõ vào lĩnh vực công nghệ / CNTT.

**Tiêu chí tính** (cần **cả hai** điều, mỗi điều có trích đoạn):
1. Trang chương trình nêu **quản lý dự án, quản lý sản phẩm hoặc quản lý công nghệ / đổi
   mới** là mục tiêu chính hoặc có trong **học phần bắt buộc**.
2. Chương trình có **định hướng công nghệ / CNTT** được nêu trên trang (trong mô tả, học
   phần hoặc đầu ra nghề nghiệp).

**Tiêu chí loại:**
- Quản lý dự án trong lĩnh vực **không phải công nghệ** (ví dụ xây dựng, sự kiện, y tế) —
  **[chủ dự án quyết]** có loại hay không.
- **MBA / quản trị kinh doanh tổng quát** không nêu định hướng công nghệ.
- Quản lý dự án chỉ là **một môn tự chọn**.

**Từ khóa tìm ứng viên:**
- Tiếng Anh: project management, product management, IT management, technology
  management, management of technology, innovation management, digital transformation,
  engineering management, agile, business analysis.
- Tiếng địa phương **[cần xác minh]**: Thụy Điển *projektledning*; Đan Mạch *projektledelse*;
  Na Uy *prosjektledelse*; Phần Lan *projektinhallinta, projektijohtaminen*;
  Hà Lan *projectmanagement*.

**Mã ISCED-F 2013 liên quan [cần đối chiếu]:** **0413 — Quản lý và hành chính**, thường đi
kèm một mã nhóm 06 khi chương trình có định hướng CNTT. Không có mã ISCED riêng cho PO/PM,
nên nhóm này luôn phải dựa vào tiêu chí ở trên.

---

## Ví dụ cách áp dụng (tên giả, chỉ để minh họa)

| Chương trình (giả định) | Trang chương trình nêu | Kết quả |
|---|---|---|
| "MSc Software Systems" | Học phần bắt buộc: kiến trúc phần mềm, kiểm thử, hệ phân tán | CNTT |
| "MSc Management of Digital Products" | Mục tiêu: quản lý sản phẩm số; học phần bắt buộc: product management, agile | PO/PM (và CNTT nếu phần lớn học phần là CNTT) |
| "MSc Construction Project Management" | Quản lý dự án xây dựng | Không thuộc PO/PM (nếu chủ dự án giữ tiêu chí loại) |
| "MSc Digital Marketing" | Marketing là lĩnh vực chính, có môn phân tích dữ liệu | Không thuộc CNTT |

---

## Câu hỏi chủ dự án cần trả lời

1. Hai nhóm này đã đủ chưa, hay cần thêm nhóm (ví dụ Business Analysis, UX/UI)?
2. PO/PM có tính dự án **ngoài** lĩnh vực công nghệ không?
3. Có cần nhóm con cho CNTT ngay từ đầu, hay để sau?
4. Bậc học: chỉ thạc sĩ, hay cả cử nhân?
5. Từ khóa tiếng địa phương: ai sẽ xác minh (người bản ngữ, hay đối chiếu trên trang của
   các trường khi đăng ký nguồn)?
