# PR 1 — Kết quả nghiệm thu trên trang thật

> **Trạng thái: CHƯA HOÀN THÀNH.** Stockholm University đạt toàn bộ điều kiện. KTH **chưa kiểm**,
> vì chưa có URL chương trình do chủ dự án cung cấp (Decision Log 2026-10-15, Q4). Lệnh
> `real-check` báo **FAIL** cho 2 mục KTH (không bỏ qua), và PR 1 không được coi là xong cho tới khi
> các mục đó đạt.
>
> Cách chạy lại:
> 1. `npm run snapshot -w @nordic/crawler -- <id> <url>`: lưu HTML đã vẽ, chỉ trên máy; git bỏ qua.
> 2. `npm run real-check -w @nordic/crawler -- --md`.
>
> Snapshot chụp ngày 2026-10-15 bằng trình duyệt của crawler (`src/render.ts`), sau khi kiểm
> robots.txt.

## Kết quả (`npm run real-check -w @nordic/crawler -- --md`, 2026-10-15)


> @nordic/crawler@0.0.0 real-check
> tsx scripts/real-check.ts --md

| Page | University | Check | Result | Detail |
|---|---|---|---|---|
| su-sprom-ht2027 | Stockholm University | snapshot | ✅ pass | captured 2026-10-15T09:48:56.428Z, sha256 d120f64437bc838f… |
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
| su-sprom-ht2027 | Stockholm University | no script state "firstInstallment" | ✅ pass |  |
| su-sprom-ht2027 | Stockholm University | no script state "totalCost" | ✅ pass |  |
| su-sprom-ht2027 | Stockholm University | no script state "registerInitialState" | ✅ pass |  |
| su-sprom-ht2027 | Stockholm University | at least 8 pairs | ✅ pass | 14 pairs |
| su-sprom-ht2027 | Stockholm University | deterministic | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | snapshot | ✅ pass | captured 2026-10-15T09:49:04.178Z, sha256 12c0fceb19ca8a6c… |
| su-sprom-ht2026 | Stockholm University | pair "Tuition fee" | ✅ pass | label_value, p12, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Selection" | ✅ pass | label_value, p11, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Eligibility" | ✅ pass | label_value, p10, section [Autumn 2026 \| Period 1 \| Day-time, 50% \| Only distance courses without required physical meetings \| For international students] |
| su-sprom-ht2026 | Stockholm University | pair "Tuition fee" value ~ /\d+ SEK/ | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | blocks under "Year 1" | ✅ pass | 4 blocks |
| su-sprom-ht2026 | Stockholm University | no script state "firstInstallment" | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | no script state "totalCost" | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | no script state "registerInitialState" | ✅ pass |  |
| su-sprom-ht2026 | Stockholm University | at least 8 pairs | ✅ pass | 15 pairs |
| su-sprom-ht2026 | Stockholm University | deterministic | ✅ pass |  |
| kth-programme-1 | KTH Royal Institute of Technology | url | ❌ FAIL | URL to be provided by the project owner (Decision Log 2026-10-15, Q4) |
| kth-programme-2 | KTH Royal Institute of Technology | url | ❌ FAIL | URL to be provided by the project owner (Decision Log 2026-10-15, Q4) |

- su-sprom-ht2027: 18 headings, 72 blocks, 14 pairs, 0 tables, 23 links, 0 structured-data adapters, truncated=false
- su-sprom-ht2026: 18 headings, 73 blocks, 15 pairs, 0 tables, 24 links, 0 structured-data adapters, truncated=false

**27 passed, 2 failed.**

## Nhận xét trên trang SU

- **Khung bên phải** (học phí, tiêu chí, điều kiện, cấp độ, ngôn ngữ, ngành) ra đúng **cặp nhãn–giá
  trị**. Ví dụ `Tuition fee → Applies to citizens from outside EU, EEA or Switzerland. First instalment:
  … SEK. The complete course: … SEK.` (giá trị đầy đủ nằm trong snapshot cục bộ).
- `section` của các cặp trong khung bên phải là tiêu đề bộ chọn kỳ (`Autumn 2027 | Period 1 | …`).
  Đây sẽ là manh mối hữu ích cho việc nhận diện **kỳ tuyển sinh** ở L7b. PR 1 chưa dùng.
- Cấu trúc chương trình nằm ở **khối** dưới "Year 1" / "Year 2" (trang SU dùng danh sách link, không
  dùng bảng nên `tables = 0`).
- Link PDF "Application Summary Sheet" có `fileType: "pdf"`.
- Dữ liệu JSON trạng thái của trang (`firstInstallment`, `totalCost`, `registerInitialState`) **không**
  có trong cấu trúc, đúng quyết định chỉ đọc DOM đã vẽ và JSON-LD.
- Trang SU không có JSON-LD (`structuredData = []`).

## Lỗi phát hiện nhờ trang thật (đã sửa trong PR 1, trước khi chốt)

1. Nhãn `span` đứng cạnh khối `p` bị bỏ mất, khiến cặp **học phí** không có. Đã sửa: các đoạn chữ
   inline giữa các khối thành khối riêng; cặp nhãn–giá trị cho phép link theo sau.
2. Chữ trong `p` / `li` dính nhau (`Beginning/EndPlease view…`). Đã sửa: thêm khoảng trắng ở ranh giới
   phần tử, không thêm trước dấu câu.
3. Cặp nhận nhầm: `Programme code: SPROM → Application code: …`, `Application opens 16 October 2026 → …`.
   Đã sửa: nhãn không chứa chữ số và không tự chứa "Nhãn: giá trị".
4. Hai mục danh sách liền nhau, hai lựa chọn kỳ bị coi là cặp. Đã sửa: loại trừ danh sách, điều khiển
   biểu mẫu, link.

## KTH (chờ)

Cần 2 URL trang chương trình chính thức của KTH. Sau đó:
1. `npm run snapshot` cho từng trang;
2. viết điều kiện vào `crawler/test/real/expectations.json` sau khi xem cấu trúc;
3. chạy `real-check`, cập nhật tài liệu này.
