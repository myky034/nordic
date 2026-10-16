# L7b-0: Rút lại một fact đã duyệt, có ghi vết (2026-10-16)

> Linear KHLOE-166. Thiết kế: L7b V3 final gate, quyết định D9 / D9a. Nhánh: `extraction/l7b-0-withdraw-fact`.
> **Migration chưa chạy trên database dùng chung.** Muốn chạy phải được chủ dự án duyệt riêng, theo
> `docs/architecture/l7b-0-migration-runbook.md`.

## Đã làm gì

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261016100000_withdraw_fact/migration.sql` | Thêm `'withdrawn'` vào CHECK của `fact_reviews.decision`; hàm `withdraw_fact()` |
| `packages/db/prisma/recovery/20261016100000_withdraw_fact.forward-fix.sql` | Bản gỡ (forward-fix): xóa hàm, giữ dữ liệu và lịch sử |
| `apps/web/lib/facts/withdraw.database.test.ts` | Test PGlite (19 test) |
| `packages/db/scripts/verify-withdraw-fact.pg.mjs` | Kiểm chứng trên PostgreSQL thật, chạy tay, có test đồng thời bằng hai kết nối |
| `apps/web/lib/review/history.ts` + `history.test.ts` | Nhãn "Đã rút lại" / "Withdrawn"; test bắt buộc mọi decision đều có nhãn |
| `docs/architecture/l7b-0-migration-runbook.md` | Kiểm trước, sao lưu, chạy, kiểm sau, gỡ |

PR này **không** thêm giao diện để gọi hàm. Giao diện sẽ đến sau, khi migration đã chạy.

## Vì sao cần

Trước đây một fact đã `reviewed` hay `conflicted` không có đường quay lại:
- `review_fact()` và `set_fact_type()` chỉ nhận fact `proposed`;
- `resolve_source_change()` chỉ chạy khi nguồn có thay đổi.

Vì vậy, nếu một fact được duyệt nhầm, hoặc trùng với fact khác (L7b cần gộp các fact trùng), người duyệt
không làm gì được, trừ khi sửa thẳng bằng SQL. Sửa thẳng thì không để lại dấu vết nào, trái AGENTS.md §1.3
và §4.3.

## Luồng

```
withdraw_fact(p_fact, p_note, p_related?)
 ├─ khóa chia sẻ 918202603      (giống các hàm ghi khác)
 ├─ has_permission('facts.review')?            không → facts_forbidden
 ├─ khóa duyệt 919202604        (giống review_fact: hai quyết định không đè nhau)
 ├─ ghi chú sau khi cắt khoảng trắng dài 1–1000?   không → facts_invalid
 ├─ SELECT … FOR UPDATE fact
 │    không có → facts_missing
 │    không phải reviewed/conflicted → facts_not_withdrawable
 │    đang có thay đổi nguồn chờ xử lý → facts_source_change_pending
 ├─ p_related (nếu có): khác fact này, đang reviewed/conflicted?   không → facts_invalid
 ├─ UPDATE facts SET status='rejected', reviewed_at=NULL
 └─ INSERT fact_reviews(decision='withdrawn', actor=auth.uid(), note, related_fact_id)
```

Cả hàm chạy trong một giao dịch. Nếu bước ghi `fact_reviews` lỗi thì bước `UPDATE` cũng bị hoàn tác (có test).

## Khái niệm quan trọng

**PostgreSQL / Supabase**
- **`SECURITY DEFINER` + `SET search_path=''`.**
  - Hàm chạy với quyền của chủ hàm, nên ghi được vào `facts` và `fact_reviews`, dù `authenticated` không có
    quyền ghi trực tiếp.
  - `search_path` rỗng buộc mọi tên phải có schema (`public.facts`, `auth.uid()`).
  - Vì vậy, nếu người gọi tạo một hàm `has_permission()` giả ở schema khác rồi đổi `search_path`, hàm giả đó
    cũng không được dùng (có test).
- **Quyền EXECUTE.**
  - `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role`, rồi chỉ `GRANT` cho `authenticated`.
  - Hàm mới mặc định cho `PUBLIC` quyền EXECUTE, nên phải thu hồi rõ ràng.
  - Kiểm quyền thật nằm trong hàm (`facts.review`); EXECUTE chỉ là lớp ngoài.
- **Khóa.**
  - `FOR UPDATE` chặn hai giao dịch cùng sửa một fact.
  - Advisory lock 919202604 xếp hàng mọi quyết định duyệt, kể cả hai người rút hai fact chỉ tới nhau
    ("A trùng B" và "B trùng A" cùng lúc). Người thứ hai sẽ bị từ chối, vì lúc đó fact được giữ lại đã bị rút.
- **CHECK mở rộng.** CHECK cũ (từ L7a, `20261015100000_page_versions`) có 5 giá trị. CHECK mới giữ cả 5 và
  chỉ thêm `withdrawn`, nên mọi dòng cũ vẫn hợp lệ.
- **`btrim()` chỉ cắt dấu cách.** Ghi chú chỉ gồm `"\n\t"` vẫn lọt qua `btrim(p_note)`. Hàm này dùng
  `btrim(p_note, E' \t\n\r\f')`, chặt hơn bản thiết kế. `review_fact()` hiện có vẫn giữ cách cũ, chưa sửa ở PR
  này.

**TypeScript**
- `history.test.ts` đọc CHECK trong migration để lấy danh sách decision. Thêm decision mới mà quên nhãn thì
  test fail, không phải đợi tới khi giao diện hiện mã thô.

## Bảo mật

- Không thêm quyền đọc nào. `fact_reviews` vẫn như cũ:
  - `anon` không có quyền SELECT;
  - `authenticated` chỉ thấy khi có `facts.propose` hoặc `facts.review` (RLS);
  - không ai ghi hoặc xóa trực tiếp được.
- Fact đã rút thành `rejected`, nên công chúng không còn thấy (RLS của `facts`). Bằng chứng và lịch sử vẫn
  còn đầy đủ.
- Không dùng service role. Các vai trò `nordic_crawler_ops` / `nordic_extractor_ops` không được EXECUTE.

## Sai lầm hay gặp

- Gỡ migration bằng cách thu hẹp CHECK lại. Làm vậy sẽ hỏng ngay khi đã có dòng `withdrawn`, và chỉ "sửa"
  được bằng cách xóa lịch sử. Forward-fix giữ nguyên CHECK.
- Xóa dòng trong `_prisma_migrations` để "chạy lại". Không làm; xem runbook.
- Tin kết quả PGlite cho phần đồng thời. PGlite chỉ có một kết nối, nên phần đó phải kiểm trên PostgreSQL
  thật.

## Cách test

- `npm test -w @nordic/web -- lib/facts/withdraw.database.test.ts lib/review/history.test.ts`
- PostgreSQL thật, **chỉ trên máy chủ tạm ở máy mình**, không bao giờ trên Supabase:
  `VERIFY_PG_URL=postgres://postgres:<mật khẩu>@127.0.0.1:<cổng>/postgres node packages/db/scripts/verify-withdraw-fact.pg.mjs`.
  Script từ chối host không phải localhost, từ chối URL trùng `DATABASE_URL` / `DIRECT_URL`, và từ chối cluster
  đã có vai trò Nordic. Nó tự tạo rồi tự xóa database của mình.

## Thứ tự đọc

1. `migration.sql`
2. `withdraw.database.test.ts`
3. `verify-withdraw-fact.pg.mjs` (phần đồng thời ở cuối)
4. File forward-fix
5. Runbook
