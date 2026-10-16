# L7b V3: SQL đề xuất (CHƯA ÁP DỤNG)

> **Cập nhật 2026-10-16:**
> - **01 đã áp dụng**, nhưng bằng bản cuối `packages/db/prisma/migrations/20261016100000_withdraw_fact/migration.sql`
>   (PR #7, KHLOE-166), **không** phải bằng file `01_…` ở đây.
> - Bản cuối khác bản này ở hai điểm:
>   - cắt cả tab và xuống dòng khỏi ghi chú;
>   - giữ nguyên `reviewed_at` khi rút.
> - Forward-fix thật nằm ở `packages/db/prisma/recovery/`. Hai file `01_…` ở đây chỉ còn là lịch sử thiết kế.
> - 02 và 03 vẫn chỉ là đề xuất, chưa áp dụng.

Chỉ để review. Thư mục này **cố ý nằm ngoài** `packages/db/prisma/migrations`, nên `prisma migrate deploy` không bao
giờ thấy các file ở đây.

| Thứ tự | File | Forward-fix |
|---|---|---|
| 1 | `01_l7b0_withdraw_fact.sql` | `recovery/01_l7b0_withdraw_fact.forward-fix.sql` |
| 2 | `02_l7b1a_reference_tables.sql` | `recovery/02_l7b1a_reference_tables.forward-fix.sql` |
| 3 | `03_l7b1c_fact_scope.sql` (cần 02) | `recovery/03_l7b1c_fact_scope.forward-fix.sql` (gỡ trước 02) |

**Đã kiểm:** PGlite 17.5 trong bộ nhớ, sau 25 migration hiện có, 121/121 ca. Chi tiết ở
`docs/architecture/l7b-v3-final-gate.md` §3.

**Khi được duyệt:** mỗi file được chép vào `packages/db/prisma/migrations/<timestamp>_<tên>/migration.sql` trong PR
riêng, kèm `schema.prisma`, test PGlite trong repo, và cổng production (`pg_dump`, duyệt rõ, kiểm sau).
