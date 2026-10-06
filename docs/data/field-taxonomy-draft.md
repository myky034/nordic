# Danh mục ngành và hướng nghề của Nordic — BẢN NHÁP 0.3

> **Trạng thái (2026-10-03):** chủ dự án định hướng hệ thống **mở cho mọi ngành và mọi nghề**
> (PROJECT_SPEC.md, Decision Log "2026-10-03 — Open taxonomy"). File này vì vậy chỉ là
> **ví dụ mẫu đầu tiên** cho định dạng một mục, không phải danh sách giới hạn:
>
> - **Ngành học** sẽ dùng trọn bộ ISCED-F 2013, nhập từ tài liệu chính thức của UNESCO (không
>   liệt kê tay ở đây). Nhóm 1 bên dưới (CNTT) minh họa cách một lĩnh vực ISCED được dùng, kèm
>   nhóm con.
> - **Hướng nghề** (PO/PM, Business Analysis, sau này Data Analyst, UX…) là chiều thứ hai do
>   Nordic định nghĩa, không giới hạn số lượng, quản lý trên trang quản trị. Nhóm 2 và 3 bên
>   dưới là hai hướng nghề đầu tiên.
>
> Chủ dự án cần đọc lần cuối các mục bên dưới trước khi dùng. Chỗ ghi **[cần xác minh]** phải
> kiểm tra trên nguồn chính thức. Không mục nào là dữ liệu về một trường hay chương trình có thật.

## Phạm vi chung (chủ dự án quyết, 2026-10-03)

- **Bậc học:** chỉ **thạc sĩ trở lên**: `master` (Thạc sĩ) và `phd` (Tiến sĩ). Chương trình
  có bậc `bachelor`, `other` hoặc `unknown` (nguồn không nêu) **không** được phân loại vào các
  nhóm dưới đây. Nếu người duyệt xác minh được bậc học trên trang chính thức, phải đề xuất lại
  chương trình với bậc đúng trước (Slice 5: không sửa tại chỗ).
- **Từ khóa:** chỉ **tiếng Anh**. Không dùng từ khóa tiếng địa phương.
- Một chương trình có thể thuộc nhiều nhóm (ví dụ CNTT và PO/PM).

## Cách dùng file này

Mỗi nhóm ngành là một **định nghĩa**, không phải một cái tên để so khớp. Khi phân loại một
chương trình, người duyệt:

1. đọc trang chính thức của chương trình (trang của trường, Section 7 của spec);
2. so với **tiêu chí tính** và **tiêu chí loại**;
3. ghi lại **trích đoạn** trên trang đã dùng để quyết định.

Từ khóa chỉ để **tìm chương trình ứng viên**; tên nghe giống không đủ để xếp vào nhóm.
Mỗi nhóm có **phiên bản**: sửa tiêu chí thì tăng phiên bản, và chương trình đã phân loại theo
phiên bản cũ được đưa vào danh sách duyệt lại.

---

## Ví dụ ngành học — Công nghệ thông tin (CNTT, nhóm ISCED 06) · phiên bản 0.2

**Định nghĩa.** Chương trình mà nội dung chính là khoa học máy tính, phát triển phần mềm,
hệ thống thông tin, dữ liệu hoặc hạ tầng CNTT.

**Tiêu chí tính** (đủ một điều, có trích đoạn trên trang chương trình):
- Trang nêu một lĩnh vực CNTT là **lĩnh vực chính** (main field, major, focus) của chương trình.
- **Phần lớn học phần bắt buộc** được liệt kê thuộc lĩnh vực CNTT.

**Tiêu chí loại:**
- CNTT chỉ là **công cụ** cho lĩnh vực khác (marketing số, thiết kế đồ họa, kinh tế lượng…),
  trừ khi trang nêu CNTT là lĩnh vực chính.
- Chỉ có **vài môn CNTT tự chọn** trong chương trình thuộc lĩnh vực khác.

**Nhóm con:** ~~6 nhóm con do Nordic đặt~~ — **bỏ** (chủ dự án, 2026-10-06). Ngành học chỉ dùng
các cấp của ISCED-F 2013 (cấp chi tiết của nhóm 06 đã chia nhỏ lĩnh vực CNTT). Nếu cần lọc theo
"An ninh mạng", "Khoa học dữ liệu"… thì chủ dự án tạo chúng thành **hướng nghề** trên giao diện.

**Mã ISCED-F 2013 liên quan [cần đối chiếu tài liệu ISCED-F 2013 chính thức của UNESCO]:**
nhóm **06 — Công nghệ thông tin và truyền thông** (các mã chi tiết như 0611, 0612, 0613,
0619, và 0688 cho chương trình liên ngành có CNTT).

---

## Hướng nghề 1 — Quản lý sản phẩm / dự án CNTT (PO/PM) · phiên bản 0.2

> **Nhóm do Nordic định nghĩa** theo vai trò nghề nghiệp (Product Owner, Product Manager,
> Project Manager), **không phải ngành học chính thức**. Giao diện phải ghi rõ như vậy
> (AGENTS.md §15).

**Định nghĩa.** Chương trình đào tạo quản lý dự án, quản lý sản phẩm hoặc quản lý công nghệ
**trong lĩnh vực CNTT**.

**Tiêu chí tính** (cần **cả hai** điều, mỗi điều có trích đoạn):
1. Trang nêu **quản lý dự án, quản lý sản phẩm hoặc quản lý công nghệ / đổi mới** là mục tiêu
   chính hoặc có trong **học phần bắt buộc**.
2. Trang nêu rõ **định hướng CNTT / phần mềm / sản phẩm số** (trong mô tả, học phần hoặc đầu ra
   nghề nghiệp).

**Tiêu chí loại:**
- Quản lý dự án **ngoài lĩnh vực CNTT** (xây dựng, sự kiện, y tế, kỹ thuật cơ khí…). *(Chủ dự
  án quyết, 2026-10-03.)*
- **MBA / quản trị kinh doanh tổng quát** không nêu định hướng CNTT.
- Quản lý dự án chỉ là **một môn tự chọn**.

**Từ khóa tìm ứng viên:** project management, IT project management, product management,
digital product management, IT management, technology management, management of technology,
innovation management, digital transformation, agile, scrum.

**Mã ISCED-F 2013 liên quan [cần đối chiếu]:** **0413 — Quản lý và hành chính**, kèm một mã
nhóm 06. Không có mã ISCED riêng cho PO/PM, nên nhóm này luôn dựa vào tiêu chí ở trên.

---

## Hướng nghề 2 — Phân tích nghiệp vụ (Business Analysis) · phiên bản 0.2 *(mới, cần chủ dự án duyệt)*

> **Nhóm do Nordic định nghĩa** theo vai trò nghề nghiệp (Business Analyst), **không phải
> ngành học chính thức**. Để thống nhất với nhóm PO/PM, bản nháp giới hạn ở **phân tích nghiệp
> vụ trong bối cảnh CNTT / chuyển đổi số**. Nếu chủ dự án muốn tính cả phân tích kinh doanh
> thuần (không có CNTT), sửa tiêu chí 2.

**Định nghĩa.** Chương trình đào tạo phân tích yêu cầu và quy trình nghiệp vụ, phân tích
kinh doanh dựa trên dữ liệu, làm cầu nối giữa nghiệp vụ và hệ thống CNTT.

**Tiêu chí tính** (cần **cả hai** điều, mỗi điều có trích đoạn):
1. Trang nêu **phân tích nghiệp vụ, phân tích yêu cầu, phân tích quy trình nghiệp vụ hoặc
   phân tích kinh doanh (business analytics)** là mục tiêu chính hoặc có trong **học phần bắt
   buộc**.
2. Trang nêu rõ **bối cảnh CNTT / hệ thống thông tin / dữ liệu / chuyển đổi số**.

**Tiêu chí loại:**
- Phân tích tài chính, kế toán, kinh tế học thuần túy.
- **MBA / quản trị kinh doanh tổng quát** chỉ có một môn phân tích.
- Chương trình mà phân tích dữ liệu là trọng tâm kỹ thuật (thống kê, học máy) và không nói
  về nghiệp vụ: xếp vào **CNTT → Khoa học dữ liệu / AI**, không vào nhóm này.

**Từ khóa tìm ứng viên:** business analysis, business analytics, requirements engineering,
requirements analysis, business process management, business informatics, information
systems analysis, digital business, enterprise systems.

**Mã ISCED-F 2013 liên quan [cần đối chiếu]:** thường **0413 — Quản lý và hành chính** và/hoặc
một mã nhóm 06 (hệ thống thông tin). Không có mã riêng cho Business Analysis.

**Chồng lấn với các nhóm khác** (được phép, mỗi nhóm cần trích đoạn riêng):
- Với **CNTT → Hệ thống thông tin**: chương trình hệ thống thông tin có trọng tâm phân tích
  nghiệp vụ có thể thuộc cả hai nhóm.
- Với **PO/PM**: chương trình vừa dạy quản lý sản phẩm vừa dạy phân tích yêu cầu có thể thuộc
  cả hai nhóm.

---

## Ví dụ cách áp dụng (tên giả, chỉ để minh họa)

| Chương trình (giả định) | Bậc | Trang chương trình nêu | Kết quả |
|---|---|---|---|
| "MSc Software Systems" | Thạc sĩ | Học phần bắt buộc: kiến trúc phần mềm, kiểm thử, hệ phân tán | CNTT → Kỹ thuật phần mềm (+ Mạng và hạ tầng nếu có trích đoạn) |
| "MSc Management of Digital Products" | Thạc sĩ | Mục tiêu: quản lý sản phẩm số; bắt buộc: product management, agile | PO/PM |
| "MSc Business Informatics" | Thạc sĩ | Bắt buộc: requirements engineering, business process management | Business Analysis + CNTT → Hệ thống thông tin |
| "MSc Construction Project Management" | Thạc sĩ | Quản lý dự án xây dựng | Không thuộc PO/PM (ngoài CNTT) |
| "BSc Computer Science" | Cử nhân | Khoa học máy tính | Ngoài phạm vi (dưới bậc thạc sĩ) |

---

## Câu trả lời của chủ dự án cho bản 0.1 (2026-10-03)

1. Thêm nhóm **Business Analysis** → nhóm 3 ở trên (bản nháp, cần duyệt).
2. PO/PM **không** tính dự án ngoài CNTT → đã đưa vào tiêu chí loại.
3. **Có** nhóm con cho CNTT ngay từ đầu → bảng nhóm con ở nhóm 1.
4. Chỉ **thạc sĩ trở lên** → mục Phạm vi chung.
5. Chỉ **từ khóa tiếng Anh** → đã bỏ từ khóa tiếng địa phương.

## Còn cần chủ dự án xác nhận

- ~~**Nhóm con CNTT**~~ — đã quyết 2026-10-06: dùng cấp chi tiết ISCED, bỏ 6 nhóm con. Ghi chú cũ: khi nhập trọn ISCED-F 2013, cấp *chi tiết* của ISCED đã chia nhỏ lĩnh vực
  CNTT. Cần quyết: dùng cấp chi tiết của ISCED thay cho 6 nhóm con ở trên, hay giữ 6 nhóm con
  này như **hướng nghề** (ví dụ "An ninh mạng", "Khoa học dữ liệu"). Không nên có hai danh sách
  song song cho cùng một ý.

- Nội dung nhóm 3 (Business Analysis), nhất là giới hạn "trong bối cảnh CNTT".
- Danh sách 6 nhóm con CNTT và mục "CNTT khác".
- Ai đối chiếu mã ISCED-F 2013 với tài liệu chính thức (có thể làm khi bắt đầu giai đoạn 1).
