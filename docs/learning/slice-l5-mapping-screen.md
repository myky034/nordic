# L5 — Màn hình "Ghép thông tin" từ trang đã crawl (2026-10-14)

> Kế hoạch đã duyệt: `docs/architecture/mapping-screen-plan.md` ("đồng ý tất cả", Q1–Q6).
> Decision Log: "2026-10-14 — L5". Linear: KHLOE-154 (L5a KHLOE-155, L5b KHLOE-156, L5c KHLOE-157).
> O3 (tự duyệt khi chỉ có 1 người duyệt) vẫn **chờ quyết định**; L5 không đổi luật đó.

## Đã làm gì

| Phần | Nội dung |
|---|---|
| **L5a — database** | Migration `20261014110000_mapping_screen`: luật trùng chung `fact_duplicate_of()`, câu trích nhập tay phải có trong trang, `editor_document_entity()` |
| **L5b — màn hình** | `/facts/map/[tài liệu]`: văn bản trang có tô màu, bôi đen → khung ghép, danh sách "cần có", duyệt tại chỗ, yêu cầu AI; 3 lối vào |
| **L5c — trang chương trình** | 8 ô "Thông tin chính", dùng chung với danh sách "cần có" |

## Vì sao thiết kế như vậy

- **Mỗi trường một cấu trúc trang.** Thay vì dạy máy hiểu cấu trúc của từng trường, người biên tập
  nhìn trang và chỉ ra đoạn nào là thông tin gì. AI vẫn làm trước; màn hình để bổ sung chỗ AI bỏ sót
  và để duyệt nhanh.
- **Đoạn bôi đen chính là câu trích.** Đoạn được cắt đúng từ văn bản đã lưu (`text.slice(start, end)`),
  nên không có chuyện chép sai. Database vẫn kiểm lại (Q4), vì không tin dữ liệu gửi từ trình duyệt.
- **Đối tượng gắn kèm được tính lại ở server.** `mapFact` đọc `editor_document_entity()` thay vì tin
  ô ẩn trong form, nên form bị sửa tay cũng không gắn được thông tin sang chương trình khác.
- **Một luật trùng cho mọi đường vào.** Trước đây chỉ AI có kiểm tra trùng, và chỉ khi giống hệt
  đối tượng + thuộc tính + giá trị. Hai bản trùng của SU (14/10) lọt qua vì AI đặt tên thuộc tính
  khác. Luật mới so theo **giá trị** và **loại + câu trích**.
- **Một danh sách ô cho hai nơi.** Danh sách "cần có" của màn hình ghép và các ô "Thông tin chính"
  của trang công khai cùng lấy từ `programme-slots.ts`, nên không thể lệch nhau.

## Luồng

```
/documents/[id] ──"Ghép thông tin"──┐
/facts/workspace ──"Mở trang để ghép"──┤
/programmes/[id] (biên tập viên) ───────┘
                 ▼
/facts/map/[id]  (server: page.tsx)
  documents · document_texts (RLS biên tập) · editor_document_entity() · facts của trang · fact_types
  findExcerpt() → vị trí tô màu      programmeChecklist() → "cần có"
                 ▼
MapView (client)
  bôi đen → offset từ data-start của <span> → khung ghép
  [Lưu đề xuất] → mapFact() → propose_fact()
                    ├─ câu trích có trong văn bản trang?   (facts_excerpt_not_in_document)
                    ├─ trùng? fact_duplicate_of()         (facts_duplicate)
                    └─ loại, giá trị cấu trúc (L4)
  [Duyệt / từ chối] → reviewFact() → review_fact()
```

## File quan trọng

| File | Vai trò |
|---|---|
| `packages/db/prisma/migrations/20261014110000_mapping_screen/migration.sql` | luật trùng, câu trích nhập tay, hàm đọc đối tượng |
| `apps/web/lib/facts/mapping.ts` | `findExcerpt`, `segments`, `expandToLines`, `programmeChecklist`, `topicForCategory` (thuần, có test) |
| `apps/web/lib/facts/structured.ts` | kiểm hình dạng giá trị cấu trúc, dùng chung cho mọi form |
| `apps/web/app/(app)/facts/map/[id]/page.tsx` | tải dữ liệu, dựng danh sách "cần có" |
| `apps/web/app/(app)/facts/map/[id]/map-view.tsx` | văn bản, tô màu, bôi đen, khung ghép |
| `apps/web/app/(app)/facts/map/[id]/actions.ts` | `mapFact` |
| `apps/web/lib/education/programme-slots.ts` | 8 ô + loại nào lấp ô nào (`slotAlsoFilledBy`) |
| `apps/web/lib/extraction/fact-types.database.test.ts` | test luật trùng, câu trích, quyền hàm đọc |

## Khái niệm cần biết

- **Lấy vị trí đoạn bôi đen (Selection API).** `window.getSelection().getRangeAt(0)` cho biết node
  và vị trí bắt đầu/kết thúc. Mỗi đoạn văn bản được bọc trong `<span data-start="…">`, nên vị trí
  trong văn bản = `data-start` của span + vị trí trong span.
- **So khớp bỏ qua khoảng trắng nhưng trả về vị trí gốc.** `findExcerpt` dựng chuỗi đã chuẩn hóa
  kèm bảng "vị trí chuẩn hóa → vị trí gốc", nên tô màu đúng chỗ dù câu trích bị xuống dòng.
- **`useActionState` với hàm bọc.** Muốn bỏ chọn sau khi lưu thành công, ta bọc server action trong
  một hàm gọi `setSel(null)`, thay vì `setState` trong `useEffect` (React khuyên tránh; ESLint chặn).
- **`revalidatePath("/facts/map/[id]", "page")`** làm mới mọi trang của route động, sau khi duyệt
  hay đổi loại ở nơi khác.
- **`<details open={!type}>`.** Ô bắt buộc nằm trong khung đang đóng thì trình duyệt không báo lỗi
  được, nên khung tự mở khi chưa có loại (chưa có thuộc tính điền sẵn).

## Bảo mật

- Màn hình cần quyền *Đề xuất thông tin* hoặc *Duyệt đề xuất*. Văn bản trang chỉ đọc được qua RLS
  `document_texts_editors`.
- `editor_document_entity()` là `SECURITY DEFINER` và kiểm quyền. `document_entity()` vẫn khóa,
  chỉ worker AI dùng.
- Ghép tạo **đề xuất**; duyệt là một bước riêng, có ghi chú và lịch sử (O3 chờ quyết định).

## Lỗi thường gặp

- "Trích đoạn không có nguyên văn trong văn bản trang": câu trích gõ tay khác văn bản đã lưu (thường
  vì trang đã đổi). Hãy bôi đen trên màn hình ghép.
- "Tài liệu này đã có thông tin giống vậy": cùng giá trị, hoặc cùng loại và câu trích lồng nhau. Xem
  thông tin đã có; nếu nó sai thì từ chối nó trước.
- Trang không khớp chương trình: `official_url` của chương trình phải trùng URL crawler lấy.
- Không thấy motivation letter hay tiêu chí xét tuyển của SU: phần đó tải bằng JavaScript, crawler
  chưa lấy (cần Playwright, kế hoạch riêng).

## Cách kiểm tra

- `npx vitest run lib/facts lib/extraction lib/compare "app/(app)/facts" "app/(public)"`.
- Thử tay sau khi chạy migration:
  1. mở `/documents/b0c05b41-174a-430c-9473-22649818e279` → "Ghép thông tin";
  2. bôi đen "60 credits", bấm "Mở rộng thêm một dòng", chọn **Số tín chỉ**, nhập 60, lưu;
  3. đoạn đó chuyển sang màu vàng; dòng "Số tín chỉ" trong "cần có" thành "Chờ duyệt";
  4. bôi đen lại "English 6 or English level 2" và lưu → báo trùng.

## Thứ tự đọc code

1. migration → 2. `lib/facts/mapping.ts` (+ test) → 3. `app/(app)/facts/map/[id]/page.tsx` →
4. `map-view.tsx` → 5. `actions.ts`.
