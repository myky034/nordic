# AI-drafted proposal batch — 2026-09-26

A one-off batch of **proposals** drafted by the AI assistant from real, public
pages of already-registered sources, so the UI can be reviewed with real data.
Nothing was published automatically: every row below was created with status
`proposed` and must be reviewed by a person holding `facts.review`
(AGENTS.md 1.3).

## Provenance

- **Created by:** the dedicated account "AI draft"
  (`10eba847-edff-44ba-8cf4-5849fa64de12`, role "AI Draft": `facts.propose`,
  `education.manage`, `immigration.manage`, `labour.manage`; no `facts.review`).
  The writer refused to run if that account could review.
- **Writes** went through the same RPCs as the UI (`propose_university`,
  `propose_immigration_rule`, `propose_occupation`, `propose_fact`), acting as
  that account, so RLS and permission checks applied. A dry run (whole batch
  rolled back) preceded the real run.
- **Documents** (5) were imported with `scripts/ingest-document.mjs`
  (ingestion method `manual`); `content_hash` is SHA-256 of the fetched HTML.
- **Fetching:** registered sources only; robots.txt checked first; one request
  at a time with a few seconds between requests; start from the registered URL
  and follow links found on those pages (no guessed URLs). `migri.fi` and
  `udi.no` answered 403 even for robots.txt and were skipped.
- **Excerpts** were checked automatically to be verbatim (whitespace-normalised)
  in the fetched page text. SCB figure excerpts are the page's own text nodes in
  order (heading, column headers, row cells).

## Contents (Sweden only)

| Kind | Count | Source document |
|---|---|---|
| Universities | 12 | Study in Sweden — Universities in Sweden (official URL = the university link supplied by the source) |
| Immigration rules | 3 | Migrationsverket — study (higher education), work, look for work |
| Rule requirements (facts) | 8 | Same Migrationsverket pages (maintenance requirement 2026/2025, admission, tuition, insurance, salary threshold, 1 June 2026 rules, post-study eligibility) |
| Occupations | 8 | SCB — Occupations with highest average monthly salary 2025 (SSYK codes, classification `national`) |
| Occupation figures (facts) | 8 | Same SCB table; reference period `2025`; unit recorded as "per month (currency not stated in the source table)" |

## Known caveats for reviewers

- The SCB table does not state a currency; the unit says so instead of assuming SEK.
- University descriptions come from data embedded in the Study in Sweden page;
  open the page in a browser to confirm the text is shown for that university.
- Registered sources are still `needs_verification`: immigration rules and
  occupation figures stay hidden publicly until the Migrationsverket / SCB
  sources are verified in the Source Registry, even after review.
- To correct a row, reject it and create a new proposal; rows are not edited.

## Kết quả duyệt (ghi ngày 2026-09-30)

Người duyệt: chủ dự án, theo
[checklist](2026-09-26-ai-draft-batch-review-checklist.md). Các quyết định được ghi
từ 2026-09-28 đến 2026-09-30 (UTC). Số liệu dưới đây lấy bằng truy vấn chỉ đọc
(`BEGIN READ ONLY`), tính trên các bản ghi do tài khoản "AI draft" tạo; cột
"Công khai" là số bản ghi mà vai trò `anon` (người chưa đăng nhập) đọc được.

| Loại | Đã duyệt | Từ chối | Công khai |
|---|---|---|---|
| Trường đại học | 11 | 1 | 11 |
| Quy định nhập cư | 3 | 0 | 3 |
| Nghề | 8 | 0 | 8 |
| Thông tin (tổng) | 8 | 10 | 8 |
| · gắn quy định nhập cư | 4 | 4 | |
| · gắn nghề (số liệu lương) | 3 | 5 | |
| · không gắn (từ trích xuất AI trên EURES) | 1 | 1 | |

Ghi chú:

- Tài khoản "AI draft" cũng là tài khoản đứng tên đề xuất của trích xuất AI
  (Slice 10a), nên có thêm 2 thông tin `origin = 'ai'` từ tài liệu EURES ngoài 16
  thông tin của lô này.
- Nguồn đã xác minh trước khi các mục trên được công khai: Migrationsverket (T1,
  2026-09-30), Statistics Sweden (SCB) (T1, 2026-09-30), Study in Sweden (T1,
  2026-09-29).
- Lý do từ chối ghi trong lịch sử: 1 trường ("link không đúng"); 1 thông tin AI
  ("không thấy tin gì liên quan để kiểm chứng"); 9 thông tin nhập theo lô với ghi chú
  "trùng trang" / "trùng facts" / "trùng trang gốc".

### Cần xác nhận

- **9 thông tin ghi "trùng"**: truy vấn không tìm thấy thông tin nào khác có cùng đối
  tượng và thuộc tính. Chúng là các thông tin khác nhau (lương của 5 nghề khác nhau;
  điều kiện nhập học, mức tài chính 2025 và 2026, mức lương tối thiểu cho giấy phép lao
  động) có chung trang nguồn với các thông tin đã duyệt. Nhiều thông tin từ cùng một
  trang là bình thường. Nếu lý do từ chối là nhầm lẫn, quyết định không sửa được
  (lịch sử chỉ thêm, không ghi đè): cần tạo đề xuất mới cho các thông tin đó.
- **Tier của Study in Sweden** là T1; bảng tier trong User Guide (mục 1.3) lấy "cổng
  thông tin du học" làm ví dụ cho T2. Nếu T1 là đúng, Authority notes của nguồn nên
  ghi căn cứ.
- **EURES** đang `verified` nhưng chưa có tier (hiển thị "Chưa phân loại").

### Rút kinh nghiệm

- Lỗi của AI trong lô này ít (1/2 đề xuất AI bị từ chối), chưa đủ để kết luận cần
  chỉnh prompt của Slice 10a.
- Giao diện duyệt nên cho thấy các thông tin khác lấy từ cùng trang, để người duyệt
  phân biệt "cùng trang" với "trùng thông tin".
