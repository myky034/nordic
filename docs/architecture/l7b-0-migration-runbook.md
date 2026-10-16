# Runbook: migration `20261016100000_withdraw_fact` (L7b-0)

> **CHƯA ĐƯỢC PHÉP chạy trên production hay merge.** Mỗi bước có ghi dữ liệu cần chủ dự án duyệt rõ, riêng cho
> migration này. Database dev và production là **một** (quyết định 2026-10-15), nên chạy ở đâu cũng là production.
> Linear: KHLOE-166.

## 1. Migration làm gì

| Thay đổi | Ảnh hưởng |
|---|---|
| `fact_reviews_decision_check`: thêm `'withdrawn'` vào danh sách | Ràng buộc mới **rộng hơn** ràng buộc cũ; mọi dòng hiện có vẫn hợp lệ. Thay ràng buộc khóa `fact_reviews` trong chốc lát (50 dòng ngày 2026-10-16) |
| Hàm `withdraw_fact(p_fact, p_note, p_related)` | SECURITY DEFINER, `search_path=''`; cần `facts.review`; chỉ `authenticated` được EXECUTE |
| Dữ liệu | **Không** dòng nào bị đổi khi chạy migration. Chỉ khi có người gọi hàm thì một fact `reviewed`/`conflicted` mới chuyển sang `rejected`, kèm một dòng `fact_reviews` (`withdrawn`) |

Toàn bộ nằm trong `BEGIN … COMMIT`: lỗi ở bất kỳ câu nào thì không có gì được áp dụng (đã có test).

## 2. Kiểm trước (chỉ đọc)

```sql
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;  -- không có dòng lỗi
SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;              -- 0
SELECT to_regprocedure('public.withdraw_fact(uuid,text,uuid)');                                                 -- NULL
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'fact_reviews_decision_check';             -- 5 giá trị hiện tại
SELECT decision, count(*) FROM fact_reviews GROUP BY 1;                                                         -- ghi lại
SELECT status, count(*) FROM facts GROUP BY 1;                                                                  -- ghi lại
SELECT current_setting('server_version');                                                                       -- 17.x
```
Checksum file: `shasum -a 256 packages/db/prisma/migrations/20261016100000_withdraw_fact/migration.sql` phải khớp mô
tả PR.

## 3. Sao lưu (bắt buộc; chưa làm, cần duyệt riêng)

Gói Supabase Free **không** có bản sao lưu để khôi phục.
1. `pg_dump "$DIRECT_URL" --format=custom --no-owner --file=nordic-before-l7b0-<thời gian>.dump`
2. `pg_restore --list <file> | head` phải đọc được.
3. Lưu **ngoài repo**, ở nơi an toàn (file có dữ liệu người dùng).

## 4. Chạy (chỉ sau khi được duyệt)

Từ thư mục gốc, trên nhánh có migration: `npm run db:migrate:deploy`. Mong đợi:
"Applying migration `20261016100000_withdraw_fact`".

## 5. Kiểm sau (chỉ đọc)

```sql
SELECT finished_at IS NOT NULL, rolled_back_at FROM _prisma_migrations WHERE migration_name = '20261016100000_withdraw_fact';
SELECT prosecdef, proconfig FROM pg_proc WHERE oid = 'public.withdraw_fact(uuid,text,uuid)'::regprocedure;   -- true, {search_path=""}
SELECT has_function_privilege('anon',          'public.withdraw_fact(uuid,text,uuid)', 'EXECUTE');           -- false
SELECT has_function_privilege('authenticated', 'public.withdraw_fact(uuid,text,uuid)', 'EXECUTE');           -- true
SELECT has_function_privilege('nordic_crawler_ops',   'public.withdraw_fact(uuid,text,uuid)', 'EXECUTE');    -- false
SELECT has_function_privilege('nordic_extractor_ops', 'public.withdraw_fact(uuid,text,uuid)', 'EXECUTE');    -- false
SELECT decision, count(*) FROM fact_reviews GROUP BY 1;   -- giống hệt lúc kiểm trước
SELECT status, count(*) FROM facts GROUP BY 1;            -- giống hệt lúc kiểm trước
```
Kiểm thêm `checksum` trong `_prisma_migrations` khớp `shasum` của file.

## 6. Khi có sự cố

**A. Migration lỗi khi chạy:** giao dịch hoàn tác hết. Đánh dấu bằng Prisma, **không xóa tay**:
`npx prisma migrate resolve --rolled-back 20261016100000_withdraw_fact` (trong `packages/db`), sửa nguyên nhân, chạy lại.

**B. Đã chạy xong nhưng cần gỡ (forward-fix):**
- **Điều kiện trước:** có quyết định gỡ của chủ dự án; đã có `pg_dump` mới; giao diện chưa gọi `withdraw_fact` (PR này
  không thêm giao diện).
- **Cách làm:** tạo **migration mới** với nội dung
  `packages/db/prisma/recovery/20261016100000_withdraw_fact.forward-fix.sql`, review, duyệt, `db:migrate:deploy`.
- **Bảo toàn dữ liệu:**
  - fact đã rút vẫn `rejected`;
  - mọi dòng `fact_reviews` `withdrawn` vẫn còn;
  - CHECK **không** bị thu hẹp lại (nếu thu hẹp sẽ phải xóa lịch sử).
- **Phải dừng nếu:**
  - kiểm trước cho thấy có migration khác đang chờ hoặc lỗi;
  - `fact_reviews` có giá trị `decision` ngoài danh sách mong đợi;
  - không có `pg_dump` đọc được;
  - có ai đề nghị xóa dòng `withdrawn` hay sửa `_prisma_migrations` bằng tay.
- **Kiểm sau khi gỡ:**
  - `to_regprocedure('public.withdraw_fact(uuid,text,uuid)') IS NULL`;
  - số dòng `fact_reviews` và trạng thái `facts` giống hệt trước khi gỡ.

**C. Một lần rút sai:** **không** sửa bằng SQL. Fact đã rút có thể được đề xuất lại (cùng câu trích) rồi duyệt lại qua
quy trình thường; lịch sử giữ cả hai.

## 7. Không làm

- Không chạy file forward-fix bằng tay trên database dùng chung.
- Không sửa, xóa dòng trong `_prisma_migrations` hay `fact_reviews`.
- Không dùng `prisma migrate reset` hay `db push`. Không dùng service role.
