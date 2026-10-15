# L7a — Phiên bản trang và chống trùng (2026-10-15)

> Kế hoạch: `docs/architecture/page-versions-plan.md`. Decision Log: "2026-10-15 — L7a". Linear: KHLOE-159.

## Đã làm gì

- Migration `20261015100000_page_versions`:
  - `page_documents()`: mọi phiên bản của một trang (cùng nguồn + cùng URL).
  - `fact_duplicate_of()`: so trùng trên **mọi phiên bản** của trang.
  - `evidence_history`: lịch sử bằng chứng, chỉ thêm, chỉ biên tập viên đọc được.
  - `resolve_source_change()` thêm 2 hành vi: "Vẫn khớp" **chuyển** thông tin sang bản mới;
    quyết định mới `superseded` (đã có thông tin mới thay thế).
- `/facts/workspace`, tab "Nguồn đã đổi":
  - báo câu trích còn hay không còn trong bản mới;
  - 3 lựa chọn (chuyển sang bản mới / đã có thông tin thay thế / không còn đúng);
  - danh sách thông tin cùng trang để chọn thông tin thay thế.
- `/facts/map/[id]`: hiện và tính cả thông tin của phiên bản khác của trang, có nhãn "Thuộc phiên bản khác".

## Vì sao

Sau lần crawl lại bằng trình duyệt (15/10), mỗi thông tin của trang SU có 2 bản: bản cũ đã duyệt, và
bản ghép lại trên trang mới. Có 3 nguyên nhân:
1. Luật trùng chỉ so trong **một tài liệu**, mà mỗi phiên bản là một tài liệu.
2. "Vẫn khớp" (Slice 9) cố ý **không** chuyển thông tin sang bản mới, để không "lặng lẽ đổi nguồn".
   Hệ quả là người duyệt phải ghép lại từ đầu.
3. Chỉ có "không còn đúng", không có "đã có thông tin mới thay thế".

Quy tắc Slice 9 được sửa **tường minh**: chỉ chuyển khi người duyệt bấm **và** câu trích có nguyên
văn trong bản mới (cùng phép so chống bịa như mọi đề xuất). Bằng chứng cũ được giữ trong lịch sử.
Crawler vẫn chỉ **gắn cờ**, không tự chuyển gì (AGENTS.md §10).

## Luồng

```
crawler: trang có phiên bản mới → gắn cờ "Nguồn đã đổi" cho thông tin đã duyệt của bản cũ
/facts/workspace · Nguồn đã đổi
  ├─ ✓ câu trích còn trong bản mới → "Vẫn khớp" → facts.document_id + evidence trỏ sang bản mới,
  │                                    dòng cũ vào evidence_history, fact_reviews: revalidated
  ├─ đã ghép lại trên bản mới       → "Đã có thông tin mới thay thế" (chọn) → rejected,
  │                                    fact_reviews: superseded + related_fact_id
  └─ sai                             → "Không còn đúng" → rejected
Ghép / AI trên bản mới → fact_duplicate_of() so cả bản cũ → báo trùng
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261015100000_page_versions/migration.sql` | mọi quy tắc |
| `apps/web/lib/crawler/database.test.ts` | test chuyển bản, thay thế, trùng giữa phiên bản, quyền |
| `apps/web/app/(app)/facts/workspace/forms.tsx` | `SourceChangeForm` 3 lựa chọn |
| `apps/web/app/(app)/facts/workspace/page.tsx` | tính "câu trích còn không", danh sách thay thế |
| `apps/web/app/(app)/facts/map/[id]/page.tsx` | thông tin của mọi phiên bản |

## Khái niệm cần biết

- **Phiên bản vs trang:** `documents` không bao giờ bị ghi đè; mỗi nội dung mới là một dòng mới
  (cùng `source_id` + `canonical_url`, khác `content_hash`). "Trang" là nhóm các dòng đó.
- **Đổi luật cũ một cách tường minh:** ghi vào Decision Log, giữ lịch sử (`evidence_history`), và
  test cả trường hợp bị từ chối (câu trích không còn).
- **`<option disabled>`:** form không cho chọn hành động mà database chắc chắn sẽ từ chối, nhưng
  database vẫn là nơi kiểm tra cuối cùng.

## Dọn dữ liệu SU (sau khi chạy migration)

Ở "Nguồn đã đổi", với mỗi thông tin của bản 14/10:
- nếu đã có bản 15/10 tương ứng → **Đã có thông tin mới thay thế**, chọn bản 15/10;
- nếu chưa có → **Vẫn khớp**, thông tin tự chuyển sang bản 15/10.

## Cách kiểm tra

- `npx vitest run lib/crawler "app/(app)/facts"`.
- Thử tay theo mục "Dọn dữ liệu SU"; sau đó trang chương trình không còn hai dòng giống nhau.
