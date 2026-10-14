# L3c — AI trích xuất có loại thông tin, gắn theo URL trang (2026-10-14)

> Kế hoạch: `docs/architecture/fact-types-plan.md`. Quyết định: Decision Log 2026-10-14 (phương án A).
> Task Linear: KHLOE-146.

## Đã làm gì

- Migration `20261014090000_extraction_fact_types`:
  - `page_key(url)`: khóa so sánh URL (scheme + host viết thường, bỏ `#…`, bỏ `/` cuối trước `?` hoặc cuối chuỗi);
  - `document_entity(document)`: trả về **đúng một** chương trình / trường / quy định đã duyệt có
    `official_url` trùng URL của tài liệu, hoặc không gì cả;
  - `extractor_fact_types(run, request)`: các loại thông tin AI được dùng cho tài liệu đang xử lý
    (loại của đối tượng khớp + loại cấp quốc gia), chỉ worker gọi được;
  - `extractor_propose()` nhận thêm `fact_type`, `value_number`, `value_currency`, `value_period`,
    `value_date`, kiểm tra như khi người nhập tay (L3a), và **tự gắn** đề xuất vào đối tượng của trang.
- Worker (`extractor/`), `PROMPT_VERSION = "extract-v3"`:
  - mỗi tài liệu hỏi `extractor_fact_types()`;
  - prompt liệt kê loại + định nghĩa; schema giới hạn `fact_type` vào đúng các khóa đó;
  - `precheck()` (dry-run) kiểm thêm con số cấu trúc.
- Nhãn tiếng Việt cho 7 lý do từ chối mới (`lib/extraction/domain.ts`).

## Vì sao thiết kế như vậy

- **AI không chọn đối tượng.** Nếu để mô hình nói "thông tin này của chương trình X", nó có thể gắn
  nhầm và người duyệt khó phát hiện. URL trang là bằng chứng có sẵn, kiểm được: trang chính thức của
  chương trình nào thì thông tin trên đó thuộc chương trình ấy.
- **Đúng một, không đoán.** Hai đối tượng cùng URL → không gắn gì (AGENTS.md §1.4). Occupation không
  có URL chính thức nên không bao giờ khớp.
- **So khớp gần như tuyệt đối.** Chỉ bỏ khác biệt vô nghĩa (hoa/thường ở host, `/` cuối). `www.` và
  query vẫn tính, vì `?eventcode=43006` có thể là chương trình khác.
- **Ứng viên sai loại bị ghi "invalid" kèm lý do**, không bị lặng lẽ lưu thành thông tin không loại.
  Người duyệt thấy rõ AI đã thử gì.
- **Schema enum + database kiểm lại.** Enum chặn khóa bịa ngay từ mô hình; nhưng output mô hình là
  không tin cậy (AGENTS.md §9) nên database vẫn kiểm mọi điều.

## Luồng

```
crawler → documents (canonical_url) ──┐
biên tập: duyệt chương trình (official_url) ─┤ page_key() bằng nhau, đúng 1 → document_entity()
                                          ▼
worker: claim → extractor_fact_types() → prompt + schema (enum khóa) → LLM
      → parseCandidates → extractor_propose()
           kiểm: trích đoạn nguyên văn, loại hợp trang, kiểu giá trị, con số có trong trích đoạn
           → facts (programme_id, country_id, fact_type_id, value_*) status=proposed, origin=ai
người duyệt → hàng chờ duyệt như mọi đề xuất AI
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261014090000_extraction_fact_types/migration.sql` | khớp URL, danh sách loại, kiểm tra |
| `apps/web/lib/extraction/fact-types.database.test.ts` | test PGlite: khớp, trùng, loại hợp/không hợp, lý do |
| `extractor/src/prompt.ts` | `candidateSchemaFor(keys)`, mô tả loại trong prompt |
| `extractor/src/validate.ts` | trường mới của `Candidate`, `precheck` |
| `extractor/src/run.ts`, `db.ts` | lấy loại cho từng tài liệu |
| `apps/web/lib/extraction/domain.ts` | nhãn tiếng Việt cho lý do |

## Khái niệm cần biết

- **NULL trong điều kiện SQL.** `NOT (CASE … END)` với kết quả NULL cho NULL, và `IF NULL` **không**
  chạy nhánh lỗi — thiếu tiền tệ từng lọt qua. Sửa bằng `NOT coalesce(CASE … END, false)`. Test bắt
  được lỗi này.
- **Regex trong Postgres phân biệt hoa thường** (`~` và `substring FROM`), `~*` thì không.
- **Hàm `SECURITY DEFINER` gọi hàm nội bộ.** `document_entity` bị thu quyền với mọi role, nhưng
  `extractor_propose` (chạy với quyền chủ sở hữu) vẫn gọi được.
- **Schema động theo tài liệu** (TypeScript): `candidateSchemaFor(keys)` trả `as const` để test đọc
  được `enum` có kiểu.

## Bảo mật

- Worker vẫn không có quyền bảng; chỉ thêm quyền gọi `extractor_fact_types`.
- `page_key`, `document_entity` không mở cho `anon`/`authenticated`.
- Thông tin AI vẫn `proposed`, ẩn đến khi người duyệt đồng ý.

## Lỗi thường gặp

- Chương trình chưa **duyệt** → trang không khớp → AI chỉ được dùng loại cấp quốc gia.
- `official_url` khác URL crawler đang lấy (khác `www.`, khác query) → không khớp. Sửa URL cho giống
  hệt trang crawler lấy.
- Mô hình viết `"145 000"` vào `value_number` → "Con số cấu trúc phải chỉ gồm chữ số…".

## Cách kiểm tra

- `npx vitest run lib/extraction` (apps/web) và `npx vitest run` (extractor).
- Thử thật, sau khi chạy migration:
  1. `official_url` của chương trình SU trùng URL crawler (`…/sprom?semester=HT2026&eventcode=43006`);
  2. chạy crawler, rồi yêu cầu AI trích xuất tài liệu đó;
  3. đề xuất có loại sẽ hiện trong hàng chờ, đã gắn chương trình.

## Thứ tự đọc code

1. migration → 2. `fact-types.database.test.ts` → 3. `extractor/src/prompt.ts` →
4. `extractor/src/run.ts` → 5. `extractor/src/validate.ts`.
