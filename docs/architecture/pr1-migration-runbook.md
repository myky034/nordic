# Runbook — migration PR 1 `20261016090000_document_structures`

> Theo review ngày 2026-10-15: không xóa tay dòng trong `_prisma_migrations`; khôi phục theo cách Prisma
> quản lý migration; kiểm tra sao lưu trước khi chạy. **Mọi bước có ghi đều cần chủ dự án phê duyệt rõ
> ràng.** Database của Nordic dùng chung cho dev và production (giữ nguyên theo quyết định 2026-10-15),
> nên chạy migration ở bất kỳ đâu cũng là chạy lên production.

## 0. Migration làm gì

**Chỉ thêm:**
- bảng `document_structures` (+ index, ràng buộc, RLS policy);
- view `document_structures_latest` (`security_invoker`);
- hàm `crawler_record_structure(uuid,uuid,text,jsonb,timestamptz)`, chỉ cấp cho `nordic_crawler_ops`.

**Không đổi:** bảng, cột, hàm, policy hay dữ liệu đang có. Toàn bộ nằm trong **một giao dịch**
(`BEGIN … COMMIT`): lỗi ở bất kỳ câu nào thì không có gì được áp dụng. Điều này đã có test:
`apps/web/lib/crawler/structure-recovery.database.test.ts`.

## 1. Kiểm trước (chỉ đọc, Claude chạy được)

Đã kiểm ngày 2026-10-15:

| Kiểm | Kết quả |
|---|---|
| Migration đang chờ | **chỉ** `20261016090000_document_structures` |
| Migration lỗi / đã rollback trong `_prisma_migrations` | không có |
| Phiên bản PostgreSQL | 17.6 (view `security_invoker` cần ≥ 15) |
| Vai trò `nordic_crawler_ops` | có |
| `sha256`, `hashtextextended` | có |
| Bảng `document_structures` | chưa tồn tại |

Chạy lại ngay trước khi thực hiện, vì trạng thái có thể đổi.

## 2. Sao lưu (bạn kiểm; cần xác nhận trước khi chạy)

Claude **không** xác minh được sao lưu:
- không có quyền vào bảng điều khiển Supabase;
- máy này không có `pg_dump`, `pg_restore`, `psql`.

Bạn kiểm:
1. **Supabase Dashboard → Project → Database → Backups:** có bản sao lưu gần nhất (ghi lại thời điểm) và
   gói hiện tại có cho khôi phục không (bản daily / PITR tùy gói). Nếu gói **không** có sao lưu, làm thêm
   bước 2.
2. **Bản dump logic tự giữ** (khuyên làm dù có sao lưu tự động), trên máy của bạn:
   ```bash
   brew install libpq   # cung cấp pg_dump / pg_restore
   "$(brew --prefix libpq)/bin/pg_dump" "$DIRECT_URL" --format=custom --no-owner --file=nordic-before-pr1-$(date +%Y%m%d-%H%M).dump
   "$(brew --prefix libpq)/bin/pg_restore" --list nordic-before-pr1-*.dump | head   # kiểm file đọc được
   ```
   Lưu file **ngoài repo**, mã hóa hoặc ở nơi an toàn: file chứa dữ liệu người dùng.
3. **Khôi phục toàn bộ** (từ bản sao lưu Supabase hoặc dump) là **biện pháp cuối cùng**: nó ghi đè mọi
   thay đổi sau thời điểm sao lưu. Migration này chỉ thêm, nên tình huống bình thường dùng mục 5, không
   cần khôi phục toàn bộ.

> **Gói Supabase Free (ghi nhận 2026-10-15):** không có bản sao lưu để khôi phục. Bản `pg_dump` ở bước 2 là
> **bắt buộc** trước mỗi migration, không chỉ là khuyến nghị. Migration PR 1 đã chạy lúc 14:02 UTC mà
> không có bản sao lưu (chỉ thêm đối tượng mới, đã kiểm sau migration);
> xem `docs/architecture/extraction-merge-sequence.md`.

## 3. Thứ tự thực hiện (sau khi bạn phê duyệt từng bước)

1. Merge PR 0 (`extraction/pr-0-audit` → `main`).
2. Kiểm trước (mục 1) + xác nhận sao lưu (mục 2).
3. **Chạy migration** từ thư mục gốc repo, trên nhánh có file migration (`extraction/pr-1-structured-content`):
   ```bash
   npm run db:migrate:deploy
   ```
   Mong đợi: `Applying migration 20261016090000_document_structures` → "All migrations have been successfully applied."
4. Kiểm sau (mục 4).
5. Merge PR 1. Crawler trên GitHub dùng code từ `main`, nên merge **sau** migration.
6. Chạy crawler một lần; kiểm có snapshot mới và log `"operation":"structure"`.

## 4. Kiểm sau (chỉ đọc)

```sql
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '20261016090000_document_structures';
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.document_structures'::regclass;            -- true
SELECT to_regclass('public.document_structures_latest') IS NOT NULL;                               -- true
SELECT has_function_privilege('nordic_crawler_ops', 'public.crawler_record_structure(uuid,uuid,text,jsonb,timestamptz)', 'EXECUTE'); -- true
SELECT has_function_privilege('authenticated',      'public.crawler_record_structure(uuid,uuid,text,jsonb,timestamptz)', 'EXECUTE'); -- false
SELECT has_table_privilege('anon', 'public.document_structures', 'SELECT');                        -- false
```

## 5. Khi có sự cố

**A. Migration thất bại khi chạy** (Prisma báo lỗi, dòng trong `_prisma_migrations` có `finished_at` rỗng):
1. Vì là một giao dịch, **không có gì được áp dụng**. Đã có test.
2. Đọc lỗi, sửa nguyên nhân. Nếu nguyên nhân nằm trong file migration thì sửa file; file chưa được áp
   dụng ở đâu, nên sửa là an toàn.
3. Đánh dấu bằng **lệnh của Prisma** (không xóa tay):
   ```bash
   npx prisma migrate resolve --rolled-back 20261016090000_document_structures --schema packages/db/prisma/schema.prisma
   ```
   (hoặc chạy trong `packages/db`: `npx prisma migrate resolve --rolled-back 20261016090000_document_structures`).
4. Chạy lại `npm run db:migrate:deploy`.

**B. Migration đã chạy thành công nhưng cần gỡ PR 1** (forward-fix, giữ lịch sử migration trung thực):
1. Revert việc merge PR 1 trên `main`, để crawler thôi gọi hàm mới.
2. Tạo migration mới `packages/db/prisma/migrations/<timestamp>_remove_document_structures/migration.sql`
   với nội dung của `packages/db/prisma/recovery/20261016090000_document_structures.forward-fix.sql`.
   File này chỉ xóa view, hàm, bảng của PR 1, và đã có test chứng minh dữ liệu cũ không bị đụng.
3. Review, rồi `npm run db:migrate:deploy` (cần phê duyệt).
4. Mất: chỉ các snapshot cấu trúc. Chúng tạo lại được bằng cách crawl lại khi đưa tính năng trở lại.

**C. Migration chạy xong, crawler báo `structure_failed`:** văn bản vẫn được lưu; xem log lần chạy. Lỗi
dữ liệu (ví dụ snapshot > 1 MB) thì sửa ở crawler; không cần gỡ migration.

## 6. Không làm

- Không xóa hay sửa tay dòng trong `_prisma_migrations`.
- Không dùng `prisma migrate reset` hay `db push` trên database này.
- Không dùng khóa service role để thử.
