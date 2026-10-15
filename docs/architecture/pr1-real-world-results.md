# PR 1 — Kết quả nghiệm thu trên trang thật

> **Trạng thái: ĐẠT. 80/80 điều kiện, 4 trang của 2 trường (2026-10-15).**
> Chạy lại:
> 1. `npm run snapshot -w @nordic/crawler -- <id> <url>`: lưu HTML đã vẽ, chỉ trên máy; git bỏ qua.
> 2. `npm run real-check -w @nordic/crawler -- --md`.
>
> Thiếu URL hoặc snapshot là **FAIL**, không bỏ qua. Điều kiện "không có trong cấu trúc" mà chuỗi kiểm
> vốn không có trong HTML cũng bị báo **FAIL ("vacuous")**, để không có điều kiện nào đạt mà thật ra
> không kiểm gì.

## Snapshot

robots.txt được kiểm bằng `RobotsTxtFile` của crawler (user agent `NordicResearchBot`) trước khi tải:
- SU: chỉ chặn `?sv.state=`, `.printable`…;
- KTH: chỉ có nhóm `User-agent: *`, không chặn `/en/studies/`.

Các trang được vẽ bằng chính trình duyệt của crawler (`src/render.ts`); mỗi trang tải một lần.

| Id | URL | Chụp lúc (UTC) | sha256 của HTML đã vẽ | Byte |
|---|---|---|---|---|
| kth-industrial-management | https://www.kth.se/en/studies/master/industrial-management | 2026-10-15T10:09:48.080Z | `881890f8c52b25a29c4f6547b2bad94f1e35860f37ab516941a00e6ce91d387f` | 72,060 |
| kth-interactive-media-technology | https://www.kth.se/en/studies/master/interactive-media-technology | 2026-10-15T10:09:59.686Z | `aca4eb112afb3a9c93bb3c27f77caca2e3fc24bcd2c198c9486d5fd217cc225c` | 87,179 |
| su-sprom-ht2026 | https://www.su.se/english/education/course-catalogue/sp/sprom?semester=HT2026&eventcode=43006 | 2026-10-15T09:49:04.178Z | `12c0fceb19ca8a6cb136aacde13dffc963acf7c711a025611bbe9b352f1f0e27` | 135,216 |
| su-sprom-ht2027 | https://www.su.se/english/education/course-catalogue/sp/sprom?semester=HT2027&eventcode=43003 | 2026-10-15T09:48:56.428Z | `d120f64437bc838f467f2a814e30e274598857f3d7d484e2704a07920a271b41` | 134,868 |

URL KTH do chủ dự án cung cấp ngày 2026-10-15; cả hai trả 200 `text/html`, không chuyển hướng.

## Điều kiện được viết thế nào

Điều kiện viết **sau khi đọc cấu trúc thật** của từng trang, và đều là chuỗi ngắn có thật trên trang.
Theo từng mục spec yêu cầu:

| Mục | SU (SPROM) | KTH (Industrial Management, Interactive Media Technology) |
|---|---|---|
| Tên chương trình | `title`, `h1` | `title`, `h1` |
| Thời lượng | khối "…takes two years to complete" | khối "…two-year / two year programme (120 ECTS credits) given in English" |
| Tín chỉ ECTS | khối "60 credits" trong khung kỳ tuyển sinh | cùng khối trên (120 ECTS) |
| Ngôn ngữ | cặp `Language` | cùng khối trên ("given in English") |
| Hạn / mốc tuyển sinh | HT2027: "Application opens 16 October 2026"; mỗi trang có ngày bắt đầu–kết thúc **của kỳ mình** (`30/08/2027 - 03/06/2029` / `31/08/2026 - 04/06/2028`) | Khối dưới "Application deadlines for studies starting August 2027" có **4 dòng riêng** (16 October (2026), 15 January, 1 February, 1 April) |
| Tiêu đề mục | "Programme overview", "How to apply", "Year 1/2" | "Application deadlines…", "… at KTH", "Future and career" |
| Link liên quan | học phí, hướng dẫn nộp hồ sơ, PDF Application Summary Sheet | Entry requirements, Fees and scholarships, Courses, How to apply (cùng origin) |
| Cặp nhãn–giá trị | Tuition fee (khớp `\d+ SEK`), Selection, Eligibility, Level, Language, Subject; ≥ 8 cặp | — (trang KTH không có cấu trúc nhãn–giá trị) |
| Không đọc script | `firstInstallment`, `totalCost`, `registerInitialState` (có trong HTML) | `klaroConfig`, `_mtm`, `widget.js` (có trong HTML) |
| Ổn định | chạy 2 lần, JSON giống hệt | như SU |

## Kết quả (`npm run real-check -w @nordic/crawler -- --md`)


> @nordic/crawler@0.0.0 real-check
> tsx scripts/real-check.ts --md

| Page | University | Check | Result | Detail |
|---|---|---|---|---|
| su-sprom-ht2027 | Stockholm University | snapshot | ✅ pass | captured 2026-10-15T09:48:56.428Z, sha256 d120f64437bc838f… |
| su-sprom-ht2027 | Stockholm University | title "SPROM - Stockholms universitet" | ✅ pass | SPROM - Stockholms universitet |
| su-sprom-ht2027 | Stockholm University | lang en | ✅ pass | en |
| su-sprom-ht2027 | Stockholm University | heading "One Year Master’s Programme in IT Project Management" | ✅ pass | h1, h1 |
| su-sprom-ht2027 | Stockholm University | heading "Programme overview" | ✅ pass | h3, h2 |
| su-sprom-ht2027 | Stockholm University | heading "How to apply" | ✅ pass | h10, h2 |
| su-sprom-ht2027 | Stockholm University | block under "One Year Master’s Programme in IT Project Management" has "takes two years to complete" | ✅ pass | b3 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>article:nth-of-type(1)>div:nth-of-type(3)>div:nth-of-type(1)>div:nth-of-type(5)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(2)>p:nth-of-type(2) |
| su-sprom-ht2027 | Stockholm University | block under "Autumn 2027 | Period 1 | Day-time, 50% | Only distance courses without required physical meetings | For international students" has "60 credits" | ✅ pass | b42 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>aside:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>p:nth-of-type(1) |
| su-sprom-ht2027 | Stockholm University | block under "Autumn 2027 | Period 1 | Day-time, 50% | Only distance courses without required physical meetings | For international students" has "30/08/2027 - 03/06/2029" | ✅ pass | b45 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>aside:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(3)>div:nth-of-type(1)>p:nth-of-type(3) |
| su-sprom-ht2027 | Stockholm University | block under "Autumn 2027 | Period 1 | Day-time, 50% | Only distance courses without required physical meetings | For international students" has "Application opens 16 October 2026" | ✅ pass | b46 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>aside:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(4)>div:nth-of-type(1)>p:nth-of-type(1) |
| su-sprom-ht2027 | Stockholm University | link "More information on tuition fees" -> …/how-to-apply/costs-fees-and-scholarships… | ✅ pass | l18, same origin |
| su-sprom-ht2027 | Stockholm University | link "Read our step-by-step guide on how to apply" -> …/how-to-apply/… | ✅ pass | l9, same origin |
| su-sprom-ht2027 | Stockholm University | pair "Tuition fee" | ✅ pass | label_value, p11, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Selection" | ✅ pass | label_value, p10, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Eligibility" | ✅ pass | label_value, p9, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Level" | ✅ pass | label_value, p7, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Language" | ✅ pass | label_value, p8, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Subject" | ✅ pass | label_value, p12, section [Autumn 2027 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2027 | Stockholm University | pair "Tuition fee" value ~ /\d+ SEK/ | ✅ pass |  |
| su-sprom-ht2027 | Stockholm University | blocks under "Year 1" | ✅ pass | 4 blocks |
| su-sprom-ht2027 | Stockholm University | blocks under "Year 2" | ✅ pass | 4 blocks |
| su-sprom-ht2027 | Stockholm University | pdf link | ✅ pass | l11 |
| su-sprom-ht2027 | Stockholm University | no script state "firstInstallment" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2027 | Stockholm University | no script state "totalCost" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2027 | Stockholm University | no script state "registerInitialState" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2027 | Stockholm University | at least 8 pairs | ✅ pass | 14 pairs |
| su-sprom-ht2027 | Stockholm University | deterministic | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | snapshot | ✅ pass | captured 2026-10-15T09:49:04.178Z, sha256 12c0fceb19ca8a6c… |
| su-sprom-ht2026 | Stockholm University | title "SPROM - Stockholms universitet" | ✅ pass | SPROM - Stockholms universitet |
| su-sprom-ht2026 | Stockholm University | lang en | ✅ pass | en |
| su-sprom-ht2026 | Stockholm University | heading "One Year Master’s Programme in IT Project Management" | ✅ pass | h1, h1 |
| su-sprom-ht2026 | Stockholm University | block under "One Year Master’s Programme in IT Project Management" has "takes two years to complete" | ✅ pass | b4 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>article:nth-of-type(1)>div:nth-of-type(3)>div:nth-of-type(1)>div:nth-of-type(5)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(2)>p:nth-of-type(2) |
| su-sprom-ht2026 | Stockholm University | block under "Autumn 2026 | Period 1 | Day-time, 50% | Only distance courses without required physical meetings | For international students" has "60 credits" | ✅ pass | b43 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>aside:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>p:nth-of-type(1) |
| su-sprom-ht2026 | Stockholm University | block under "Autumn 2026 | Period 1 | Day-time, 50% | Only distance courses without required physical meetings | For international students" has "31/08/2026 - 04/06/2028" | ✅ pass | b46 main>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(1)>aside:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(1)>div:nth-of-type(3)>div:nth-of-type(1)>p:nth-of-type(3) |
| su-sprom-ht2026 | Stockholm University | pair "Tuition fee" | ✅ pass | label_value, p12, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Selection" | ✅ pass | label_value, p11, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Eligibility" | ✅ pass | label_value, p10, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Tuition fee" value ~ /\d+ SEK/ | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | blocks under "Year 1" | ✅ pass | 4 blocks |
| su-sprom-ht2026 | Stockholm University | no script state "firstInstallment" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2026 | Stockholm University | no script state "totalCost" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2026 | Stockholm University | no script state "registerInitialState" | ✅ pass | present in HTML, absent from structure |
| su-sprom-ht2026 | Stockholm University | at least 8 pairs | ✅ pass | 15 pairs |
| su-sprom-ht2026 | Stockholm University | deterministic | ✅ pass |  |
| kth-industrial-management | KTH Royal Institute of Technology | snapshot | ✅ pass | captured 2026-10-15T10:09:48.080Z, sha256 881890f8c52b25a2… |
| kth-industrial-management | KTH Royal Institute of Technology | title "MSc Industrial Management | KTH | Sweden" | ✅ pass | MSc Industrial Management \| KTH \| Sweden |
| kth-industrial-management | KTH Royal Institute of Technology | lang en-GB | ✅ pass | en-GB |
| kth-industrial-management | KTH Royal Institute of Technology | canonical ~ "/studies/master/industrial-management/" | ✅ pass | https://www.kth.se/en/studies/master/industrial-management/msc-industrial-management-1.48816 |
| kth-industrial-management | KTH Royal Institute of Technology | heading "MSc Industrial Management" | ✅ pass | h1, h1 |
| kth-industrial-management | KTH Royal Institute of Technology | heading "Application deadlines for studies starting August 2027" | ✅ pass | h2, h2 |
| kth-industrial-management | KTH Royal Institute of Technology | heading "Industrial Management at KTH" | ✅ pass | h4, h2 |
| kth-industrial-management | KTH Royal Institute of Technology | heading "Future and career" | ✅ pass | h8, h2 |
| kth-industrial-management | KTH Royal Institute of Technology | block under "Industrial Management at KTH" has "This is a two-year programme (120 ECTS credits) given in English" | ✅ pass | b12 main>article:nth-of-type(1)>div:nth-of-type(2)>p:nth-of-type(4) |
| kth-industrial-management | KTH Royal Institute of Technology | block under "Application deadlines for studies starting August 2027" has 4 separate lines | ✅ pass | b2 |
| kth-industrial-management | KTH Royal Institute of Technology | link "Entry requirements" -> …/studies/master/industrial-management/entry-requirements… | ✅ pass | l11, same origin |
| kth-industrial-management | KTH Royal Institute of Technology | link "Fees and scholarships" -> …/studies/master/industrial-management/fees… | ✅ pass | l12, same origin |
| kth-industrial-management | KTH Royal Institute of Technology | link "Courses" -> …/studies/master/industrial-management/courses… | ✅ pass | l10, same origin |
| kth-industrial-management | KTH Royal Institute of Technology | link "How to apply" -> …/studies/master/admissions/how-to-apply… | ✅ pass | l1, same origin |
| kth-industrial-management | KTH Royal Institute of Technology | no script state "klaroConfig" | ✅ pass | present in HTML, absent from structure |
| kth-industrial-management | KTH Royal Institute of Technology | no script state "_mtm" | ✅ pass | present in HTML, absent from structure |
| kth-industrial-management | KTH Royal Institute of Technology | no script state "widget.js" | ✅ pass | present in HTML, absent from structure |
| kth-industrial-management | KTH Royal Institute of Technology | deterministic | ✅ pass |  |
| kth-interactive-media-technology | KTH Royal Institute of Technology | snapshot | ✅ pass | captured 2026-10-15T10:09:59.686Z, sha256 aca4eb112afb3a9c… |
| kth-interactive-media-technology | KTH Royal Institute of Technology | title "MSc Interactive Media Technology | KTH | Sweden" | ✅ pass | MSc Interactive Media Technology \| KTH \| Sweden |
| kth-interactive-media-technology | KTH Royal Institute of Technology | lang en-GB | ✅ pass | en-GB |
| kth-interactive-media-technology | KTH Royal Institute of Technology | canonical ~ "/studies/master/interactive-media-technology/" | ✅ pass | https://www.kth.se/en/studies/master/interactive-media-technology/msc-interactive-media-technology-1.593765 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | heading "MSc Interactive Media Technology" | ✅ pass | h1, h1 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | heading "Application deadlines for studies starting August 2027" | ✅ pass | h2, h2 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | heading "Interactive Media Technology at KTH" | ✅ pass | h4, h2 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | heading "Future and career" | ✅ pass | h9, h2 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | block under "Interactive Media Technology at KTH" has "This is a two year programme (120 ECTS credits) given in English" | ✅ pass | b11 main>article:nth-of-type(1)>div:nth-of-type(2)>p:nth-of-type(6) |
| kth-interactive-media-technology | KTH Royal Institute of Technology | block under "Application deadlines for studies starting August 2027" has 4 separate lines | ✅ pass | b2 |
| kth-interactive-media-technology | KTH Royal Institute of Technology | link "Entry requirements" -> …/studies/master/interactive-media-technology/entry-requirements… | ✅ pass | l35, same origin |
| kth-interactive-media-technology | KTH Royal Institute of Technology | link "Fees and scholarships" -> …/studies/master/interactive-media-technology/fees… | ✅ pass | l36, same origin |
| kth-interactive-media-technology | KTH Royal Institute of Technology | link "Courses" -> …/studies/master/interactive-media-technology/courses… | ✅ pass | l34, same origin |
| kth-interactive-media-technology | KTH Royal Institute of Technology | link "How to apply" -> …/studies/master/admissions/how-to-apply… | ✅ pass | l1, same origin |
| kth-interactive-media-technology | KTH Royal Institute of Technology | no script state "klaroConfig" | ✅ pass | present in HTML, absent from structure |
| kth-interactive-media-technology | KTH Royal Institute of Technology | no script state "_mtm" | ✅ pass | present in HTML, absent from structure |
| kth-interactive-media-technology | KTH Royal Institute of Technology | no script state "widget.js" | ✅ pass | present in HTML, absent from structure |
| kth-interactive-media-technology | KTH Royal Institute of Technology | deterministic | ✅ pass |  |

- su-sprom-ht2027: 18 headings, 72 blocks, 14 pairs, 0 tables, 23 links, 0 structured-data adapters, truncated=false
- su-sprom-ht2026: 18 headings, 73 blocks, 15 pairs, 0 tables, 24 links, 0 structured-data adapters, truncated=false
- kth-industrial-management: 21 headings, 66 blocks, 0 pairs, 0 tables, 30 links, 0 structured-data adapters, truncated=false
- kth-interactive-media-technology: 27 headings, 95 blocks, 0 pairs, 0 tables, 54 links, 0 structured-data adapters, truncated=false

**80 passed, 0 failed.**

## Lỗi phát hiện nhờ trang thật (đã sửa trong PR 1 trước khi chốt)

**Từ SU:**
1. Nhãn `span` cạnh khối `p` bị bỏ mất, nên cặp **học phí** không có. Đã sửa: các đoạn chữ inline giữa
   các khối thành khối riêng; cặp nhãn–giá trị cho phép link theo sau.
2. Chữ trong `p` / `li` dính nhau. Đã sửa: khoảng trắng ở ranh giới phần tử, không thêm trước dấu câu.
3. Cặp nhận nhầm (`Programme code: SPROM → Application code: …`, `Application opens 16 October 2026 → …`).
   Đã sửa: nhãn không có chữ số, không tự chứa "Nhãn: giá trị".
4. Mục danh sách, lựa chọn kỳ bị coi là cặp. Đã sửa: loại trừ danh sách, điều khiển, link.

**Từ KTH:**

5. Các dòng `<br>` của lịch tuyển sinh bị gộp làm một. Đã sửa: `<br>` giữ thành dòng riêng.
   - Khi sửa, test ổn định bắt được một lỗi phụ: xuống dòng **trong mã nguồn** cũng tạo dòng. Đã sửa:
     chỉ `<br>` và `<pre>` tạo dòng.
   - Đã thêm test cho cả hai.
6. Điều kiện `__NEXT_DATA__` cho KTH là vô nghĩa (trang không có), và `30/08/2027` trên trang HT2026
   cũng vậy. Đã thay bằng chuỗi có thật trong HTML, và `real-check` giờ tự báo FAIL nếu gặp điều kiện
   vô nghĩa.

## Hạn chế còn lại (không chặn PR 1, ghi cho các bước sau)

- **KTH không có cặp nhãn–giá trị.** Thời lượng, ECTS, ngôn ngữ nằm trong câu văn; mốc tuyển sinh là
  dòng `<strong>Ngày:</strong> sự kiện`. PR 1 giữ đúng các dòng, việc tách "ngày → sự kiện" và đọc "two
  years / 120 ECTS" là **luật ở PR 2**.
- **Trang chương trình KTH không có học phí.** Học phí nằm ở trang "Fees and scholarships" riêng (link đã
  có trong cấu trúc). Cần nhiều tài liệu cho một chương trình: L7b / PR 4.
- **Kỳ tuyển sinh:**
  - SU dùng **cùng `canonical`** (không có tham số kỳ) cho HT2026 và HT2027, nên L7b không được dùng
    `canonical` làm định danh kỳ; phải dùng URL đăng ký;
  - tiêu đề khung bên phải của SU (`Autumn 2027 | Period 1 | …`) là manh mối kỳ tốt;
  - KTH ghi kỳ trong tiêu đề mục ("…starting August 2027").
- **Chữ của hộp đồng ý cookie** ("You have previously denied the display of content of the type
  'External media'…") lọt vào khối trên trang KTH Interactive Media Technology. Đó là chữ hiển thị thật,
  không phải script; có thể loại bằng `content_selector` hoặc luật ở PR 2.
- Snapshot chỉ là ảnh chụp ngày 2026-10-15. Trang đổi thì phải chụp lại và xem lại điều kiện; đây là
  kiểm tra thủ công, không chạy trong CI.
