# Nghiệm thu PR 1.5 với dữ liệu thật: Stockholm University và KTH

> **Sẵn sàng thực hiện:** migration đã chạy, PR 1 và PR 1.5 đã deploy, crawler đã chạy (2026-10-15 14:15 UTC)
> (`docs/architecture/extraction-merge-sequence.md`). Trang chỉ đọc; bài này không ghi gì ngoài các
> bước chuẩn bị bạn tự làm qua giao diện admin.
> Mốc so sánh: `crawler/test/real/expectations.json` (kỳ vọng lấy từ nội dung thật ngày 2026-10-15,
> `real-check` 80/80).

## 0. Chuẩn bị (bạn làm; trạng thái kiểm chỉ đọc ngày 2026-10-15)

| # | Việc | Trạng thái hiện tại |
|---|---|---|
| P1 | SU HT2026 đã đăng ký crawl | **Có**. Từ 14:15 UTC ngày 2026-10-15, phiên bản mới nhất đã có snapshot (18 tiêu đề, 73 khối, 15 cặp, 24 link); phiên bản cũ hơn vẫn chưa có, nên dùng để kiểm S1 |
| P2 | SU HT2027 (`…/sprom?semester=HT2027&eventcode=43003`) | **Chưa đăng ký.** Tùy chọn; đăng ký ở `/admin/crawler` nếu muốn kiểm trang có 2 năm học |
| P3 | KTH trong Source Registry | **Chưa có nguồn KTH.** Bạn quyết tên nguồn, URL gốc, tier và chính sách crawl ở `/admin/sources` (Claude không tự điền thông tin nguồn) |
| P4 | Hai URL KTH | Chưa đăng ký. Sau P3, đăng ký: `https://www.kth.se/en/studies/master/industrial-management` và `https://www.kth.se/en/studies/master/interactive-media-technology` |
| P5 | Tài khoản thử quyền | Vai trò Editor và Member hiện **không có ai**. Cần một tài khoản thử gán **Editor** và một tài khoản **không có vai trò** (hoặc Member). Tùy chọn: một vai trò thử chỉ có `crawler.manage` |
| P6 | Chạy crawler | Sau P1–P4: chạy workflow crawler một lần |

## 1. Lối vào và ba trạng thái

| ID | Thao tác | Kỳ vọng |
|---|---|---|
| E1 | `/admin/crawler` → tab URL → mở URL SU HT2026 | Inspector có "Xem cấu trúc" trỏ tới `/admin/crawler/documents/<id>` |
| E2 | Mở một URL vừa đăng ký nhưng chưa crawl (ví dụ KTH trước P6) | Hiện "Chưa crawl thành công lần nào", không có link |
| E3 | Tab Lần chạy → mở lần chạy sau P6 → bấm một dòng | Mở đúng trang cấu trúc của tài liệu đó |
| E4 | `/documents/<id>` của SU, bằng Administrator | Có link "Xem cấu trúc" |
| S1 | Mở **phiên bản cũ** của SU (tạo trước PR 1) qua "Các phiên bản của trang" | "Phiên bản này chưa có cấu trúc"; Administrator thấy mục "Lần crawl gần nhất" |
| S2 | Mở một tài liệu nhập tay (nếu có) | "Tài liệu này không do crawler lấy" |
| S3 | Mở phiên bản mới nhất của SU sau P6 | Có cấu trúc; cảnh báo "NỘI DUNG THÔ"; mục Snapshot hiện thời điểm chụp, `html-structure-v1`, hash, mã lần chạy, nhãn "Mới nhất" |

## 2. Xem cấu trúc (so với `expectations.json`)

| ID | Trang | Kỳ vọng |
|---|---|---|
| C1 | SU HT2026, tab Tổng quan | Tiêu đề trang `SPROM - Stockholms universitet`, ngôn ngữ `en`, có tiêu đề "One Year Master’s Programme in IT Project Management" |
| C2 | SU HT2026, tab Cặp | ≥ 8 cặp; có `Tuition fee` (giá trị khớp `\d+ SEK`), `Selection`, `Eligibility`; có mục "Year 1" |
| C3 | SU HT2026, lọc `tuition`, rồi chọn mục | Chỉ còn các dòng khớp; "Bỏ lọc" trả về đầy đủ |
| C4 | SU HT2026, bấm cặp `Tuition fee` | Inspector hiện `ref`, `domPath`, mục, `labelPath`/`valuePath`, JSON của phần tử |
| C5 | SU, tab JSON-LD / Link | Không lộ dữ liệu nội bộ của trang (`firstInstallment`, `totalCost`, `registerInitialState` không xuất hiện ở bất kỳ tab nào); link tuyệt đối, có cột cùng origin / ngoài |
| C6 | KTH Industrial Management, Tổng quan | Tiêu đề `MSc Industrial Management \| KTH \| Sweden`, ngôn ngữ `en-GB`, canonical chứa `/studies/master/industrial-management/`, có tiêu đề "Application deadlines for studies starting August 2027" |
| C7 | KTH Interactive Media Technology, Tổng quan | Tương tự với `MSc Interactive Media Technology` |
| C8 | KTH, tab Khối | Có khối giới thiệu chương trình trong mục "… at KTH" như kỳ vọng `blockIncludes` |
| C9 | Mọi trang | Khung "Thông tin chương trình đã chuẩn hóa (facts)" nằm riêng, nền khác; dữ liệu thô không lẫn vào |

Nếu số lượng khác lúc chụp (SU 15 cặp / 24 link; KTH IM 21 tiêu đề / 30 link; KTH IMT 27 tiêu đề / 54
link) mà các mục trên vẫn đạt, thì đó là trang đã đổi, không phải lỗi. Ghi lại để đối chiếu với
`npm run snapshot` mới.

## 3. Lịch sử snapshot

| ID | Thao tác | Kỳ vọng |
|---|---|---|
| H1 | Mở SU sau P6 | "Lịch sử snapshot (n)" khớp số dòng thật; dòng mới nhất có "Mới nhất" và "đang xem" |
| H2 | Chạy crawler lần hai khi trang không đổi | **Không** thêm snapshot (trùng nội dung); lần chạy ghi `unchanged` |
| H3 | Khi có ≥ 2 snapshot: bấm snapshot cũ | URL có `?snapshot=`; nhãn "Mới nhất" vẫn ở bản mới nhất |
| H4 | Sửa tay `?snapshot=` thành một UUID không tồn tại | 404 |

Snapshot mới chỉ có khi cấu trúc trang thật sự đổi. Nếu chưa có snapshot thứ hai, ghi **"chưa áp dụng"**
cho H3 và làm lại sau lần crawl có thay đổi. **Không** tạo dữ liệu giả trên database dùng chung.

## 4. So sánh

| ID | Thao tác | Kỳ vọng |
|---|---|---|
| D1 | Có ≥ 2 snapshot hoặc ≥ 2 phiên bản có snapshot: "So sánh với" → chọn một bản | Tab So sánh; nhóm thêm / bỏ / đổi giá trị theo nội dung; ghi chú "không theo ref/domPath" |
| D2 | Chọn so sánh hai bản cùng nội dung (nếu có, ví dụ A → B → A) | "Không có khác biệt về nội dung" |
| D3 | Sửa tay `?compare=` thành snapshot của trang **khác** (ví dụ id snapshot KTH khi đang ở SU) | Không so sánh; hiện "Chọn một snapshot…" |

D1 và D2 cũng phụ thuộc vào thay đổi thật, như H3; nếu chưa có thì ghi "chưa áp dụng".

## 5. Phân quyền (dùng tài khoản ở P5)

| ID | Tài khoản | Kỳ vọng |
|---|---|---|
| R1 | Administrator | Thấy tất cả, kể cả "Lần crawl gần nhất" |
| R2 | Editor (`documents.ingest`) | Mở được trang và xem cấu trúc; **không** thấy thông tin lần crawl (hiện "cần quyền quản lý crawler") |
| R3 | Không vai trò / Member | Trang "Bạn chưa có quyền xem dữ liệu cấu trúc" (`NoAccess`); `/documents/<id>` không có link "Xem cấu trúc" |
| R4 | Chỉ `crawler.manage` (tùy chọn) | Mở được trang, thấy lần crawl, nhưng báo "Bạn chưa có quyền xem dữ liệu cấu trúc" thay cho dữ liệu |
| R5 | Chưa đăng nhập | Bị chuyển tới đăng nhập, như các trang admin khác |

## 6. Ghi kết quả

Với mỗi ID: Đạt / Không đạt / Chưa áp dụng, kèm ảnh chụp (lưu **ngoài repo** nếu ảnh có nội dung trang
bên thứ ba; repo công khai). Gửi bảng kết quả; Claude đối chiếu và mở issue cho mục không đạt.
