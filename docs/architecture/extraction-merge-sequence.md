# Trình tự merge PR 0 → PR 1 → PR 1.5 (chuẩn bị và thực hiện ngày 2026-10-15)

> Đã duyệt: PR 0, PR 1 (kèm các biện pháp an toàn cho migration), PR 1.5 tại `f533587`.
> Hạ tầng và database dùng chung **giữ nguyên**. Mọi bước có ghi (merge, migration, chạy crawler) đều do
> chủ dự án làm hoặc phê duyệt rõ ràng; Claude chỉ chạy các bước kiểm chỉ đọc.
> Runbook migration: `docs/architecture/pr1-migration-runbook.md`.

## Trạng thái lúc chuẩn bị (đã kiểm, chỉ đọc)

| Mục | Giá trị |
|---|---|
| `main` | `eb649da` (L7a) |
| `extraction/pr-0-audit` | `5d50f5e` (1 commit trên `main`) |
| `extraction/pr-1-structured-content` | `c18222c` (4 commit trên PR 0) |
| `extraction/pr-1.5-structure-preview` | `f533587` (4 commit trên PR 1) |
| Các nhánh | xếp chồng thẳng hàng: `main` → PR 0 → PR 1 → PR 1.5, không lệch |
| PR trên GitHub | **chưa có**: máy này không có `gh`, cần tạo bằng link bên dưới |
| `prisma migrate status` | chỉ chờ `20261016090000_document_structures`; không có migration lỗi |
| Tự động chạy migration khi merge/deploy | **không có**: build Vercel chỉ chạy `next build`, workflow không có `migrate` |
| Crawler theo lịch | `.github/workflows/crawler.yml`: thứ Hai 03:17 UTC, chạy code trên `main` |
| Merge vào `main` | Vercel **tự deploy production** (Git integration hiện có) |

## Bước 0: tạo PR (bạn làm)

Tạo PR theo thứ tự, **base là `main`** cho cả ba:

1. PR 0: https://github.com/myky034/nordic/compare/main...extraction/pr-0-audit?expand=1
2. PR 1: https://github.com/myky034/nordic/compare/main...extraction/pr-1-structured-content?expand=1
3. PR 1.5: https://github.com/myky034/nordic/compare/main...extraction/pr-1.5-structure-preview?expand=1

- Trước khi PR 0 được merge, PR 1 hiện cả commit của PR 0; trước khi PR 1 được merge, PR 1.5 hiện cả
  commit của PR 1. Sau mỗi lần merge, GitHub tự thu gọn.
- **Merge bằng "Create a merge commit"**, không dùng *Squash* hay *Rebase*. Các nhánh dùng chung commit;
  squash hoặc rebase tạo commit mới cho PR trước, khiến PR sau lặp lại thay đổi hoặc bị xung đột.
- Kiểm deployment Preview của Vercel cho `f533587` có xanh (bản `dd9725b` lỗi `cheerio`, đã sửa ở `e529cb4`).

## Bước 1: merge PR 0

- Nội dung: tài liệu audit, sửa lệch `schema.prisma`, test lệch schema, fixture và baseline. Không đổi
  hành vi lúc chạy, không có migration.
- Sau merge: Vercel deploy production; kiểm deployment xanh.

## Bước 2: migration PR 1, rồi merge PR 1 (có cổng phê duyệt)

| # | Việc | Ai | Ghi chú |
|---|---|---|---|
| 2.1 | Chạy lại phần kiểm trước (runbook §1) | Claude, chỉ đọc | Ngay trước khi chạy, vì trạng thái có thể đổi |
| 2.2 | Xác nhận sao lưu (runbook §2) | **Bạn** | Thời điểm bản sao lưu Supabase gần nhất và khả năng khôi phục của gói hiện tại; khuyên tạo thêm `pg_dump` và kiểm bằng `pg_restore --list` |
| 2.3 | **Phê duyệt rõ ràng** cho việc chạy migration | **Bạn** | Gửi kết quả 2.2 cùng lời duyệt |
| 2.4 | `npm run db:migrate:deploy` | Bạn (hoặc Claude nếu bạn yêu cầu rõ) | Chạy từ thư mục gốc, trên nhánh `extraction/pr-1-structured-content` |
| 2.5 | Kiểm sau (runbook §4) | Claude, chỉ đọc | RLS bật, view có, quyền hàm đúng, `anon` không đọc được |
| 2.6 | Merge PR 1 | **Bạn** | **Sau** 2.4–2.5: crawler trên `main` sẽ gọi hàm mới |
| 2.7 | Chạy crawler một lần (Actions → crawler → Run workflow) | **Bạn** | Hoặc đợi lịch thứ Hai. Kiểm log có `"operation":"structure"`, không có `structure_failed` |

- Sự cố: làm theo runbook §5. Không xóa tay dòng trong `_prisma_migrations`; dùng
  `prisma migrate resolve --rolled-back`, hoặc forward-fix bằng một migration mới.
- **Không** merge PR 1 trước khi migration chạy xong. Nếu lỡ, lần crawl kế tiếp lưu văn bản bình thường
  nhưng mỗi trang báo `structure_failed` và lần chạy thành `partial`; không mất dữ liệu.

## Bước 3: merge PR 1.5

- Chỉ sau bước 2.4 (trang mới đọc `document_structures`; thiếu bảng thì trang báo lỗi).
- Không có migration. Sau merge: Vercel deploy production; kiểm deployment xanh.
- Sau đó làm bài nghiệm thu dữ liệu thật: `docs/architecture/pr1.5-real-data-acceptance.md`.

## Sau khi xong

- Linear: KHLOE-161 và KHLOE-163 → Done (Claude cập nhật khi bạn báo đã merge).
- KHLOE-162 (A → B → A) vẫn ở Backlog. L7b và PR 2 chưa bắt đầu.

## Kết quả thực hiện (2026-10-15, giờ UTC)

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 13:57 | Merge PR #1 (PR 0) | Merge commit `5ac0820`. Test chạy lại trên `5d50f5e` đạt; cây code giống bản Preview; Vercel production xanh |
| 14:02 | Chủ dự án chạy `db:migrate:deploy` | `20261016090000_document_structures` được áp dụng. **Không có bản sao lưu:** gói Supabase Free không có backup để khôi phục. Migration chỉ thêm đối tượng mới, nên không có dữ liệu nào bị ảnh hưởng |
| 14:04 | Crawler (code PR 0) | 0 snapshot (đúng dự kiến). SU lỗi `redirect count exceeded` phía su.se, lúc có lúc không |
| — | Kiểm sau migration (§4) | Đạt: RLS bật, view có, chỉ `nordic_crawler_ops` gọi được hàm, `anon` không đọc được. Checksum file migration khớp bản đã áp dụng |
| 14:14 | Merge PR #2 (PR 1) | Merge commit `92328fc` (chủ dự án merge). Test chạy lại trên `c18222c` đạt |
| 14:15 | Merge PR #3 (PR 1.5) | Merge commit `dff3454` (chủ dự án merge). Cây code giống `f533587`; Vercel production xanh |
| 14:15 | Crawler (code PR 1) | `succeeded`, 3 URL `unchanged`, 3 snapshot đầu tiên. SU: 18 tiêu đề, 73 khối, 15 cặp, 24 link, khớp `real-check` |

**Bài học về sao lưu:** gói Free không có bản sao lưu để khôi phục, nên từ nay trước mỗi migration phải tạo
`pg_dump` và kiểm bằng `pg_restore --list` (runbook PR 1 §2, bước 2). Đó là cách sao lưu duy nhất với gói
hiện tại.

**Về quyền:** Claude Code chặn việc merge vào `main` (vì sẽ deploy production) kể cả khi được nhờ trong khung
chat, nên chủ dự án tự merge PR #2 và #3.
