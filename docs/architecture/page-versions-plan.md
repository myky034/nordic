# Kế hoạch L7a — Phiên bản trang và chống trùng

> **Trạng thái:** chủ dự án yêu cầu làm trước phần này (2026-10-15). Decision Log: "2026-10-15 — L7a".
> L7b (một chương trình nhiều trang theo kỳ tuyển sinh) làm sau.

## 1. Vấn đề (dữ liệu thật ngày 15/10)

Trang SU có 2 phiên bản (14/10 đọc HTML, 15/10 đọc bằng trình duyệt). Mỗi thông tin xuất hiện 2 lần:
- bản cũ đã duyệt, đang ở hàng chờ "Nguồn đã đổi";
- bản mới vừa ghép lại.

Nguyên nhân:
1. Luật trùng (L5) chỉ so trong **một tài liệu**, mà mỗi phiên bản là một tài liệu riêng.
2. "Vẫn khớp" chỉ gỡ cờ; thông tin vẫn bám vào **bản cũ** (quy định Slice 9), nên người duyệt phải
   ghép lại trên bản mới.
3. Không có lựa chọn "đã có thông tin mới thay thế" (chỉ có "không còn đúng").

## 2. Thiết kế

| # | Thay đổi | Ở đâu |
|---|---|---|
| D1 | **Trang** = một URL đăng ký của một nguồn; các tài liệu cùng nguồn + cùng URL là các phiên bản. Hàm `page_documents(tài liệu)` trả mọi phiên bản | database |
| D2 | `fact_duplicate_of()` so trên **mọi phiên bản** của trang (AI và nhập tay, như L5) | database |
| D3 | "Vẫn khớp" = **chuyển sang phiên bản mới** nếu câu trích có nguyên văn trong bản mới. Bằng chứng cũ được chép vào bảng `evidence_history` (chỉ thêm). Không có câu trích thì từ chối (`facts_excerpt_not_in_new_version`) | `resolve_source_change()` |
| D4 | Quyết định mới **"Đã có thông tin mới thay thế"** (`superseded`): chọn thông tin thay thế trên cùng trang; thông tin cũ bị gỡ khỏi trang công khai, lịch sử ghi rõ "bị thay thế bởi…" | `resolve_source_change()` + `fact_reviews` |
| D5 | Thẻ "Nguồn đã đổi": hiện "✓ câu trích vẫn có trong bản mới" hoặc "✗ không còn"; danh sách thông tin trên bản mới để chọn thay thế | `/facts/workspace` |
| D6 | Màn hình ghép: hiện cả thông tin của **phiên bản khác** của cùng trang (nhãn "bản cũ"), tính vào danh sách "cần có" | `/facts/map/[id]` |

Không đổi: crawler vẫn chỉ **gắn cờ**, không tự chuyển gì (AGENTS.md §10); mọi quyết định là của người duyệt.

## 3. Dọn dữ liệu SU hiện tại (sau khi triển khai)

Ở tab "Nguồn đã đổi", với từng thông tin của bản 14/10:
- đã có bản 15/10 tương ứng → **"Đã có thông tin mới thay thế"**, chọn thông tin của bản 15/10;
- chưa có → **"Vẫn khớp"**: thông tin tự chuyển sang bản 15/10.

## 4. Kiểm thử (PGlite + Vitest)

- Trùng giữa hai phiên bản bị chặn (AI và nhập tay); khác URL thì không coi là trùng.
- "Vẫn khớp": chuyển tài liệu và bằng chứng, có đúng một dòng lịch sử; câu trích không có trong
  bản mới thì từ chối.
- "Đã có thông tin mới thay thế": thông tin thay thế phải cùng trang, chưa bị từ chối, khác chính nó.
  Thông tin cũ thành "rejected"; lịch sử ghi `superseded` kèm liên kết.
- Quyền: chỉ người có quyền duyệt; lịch sử bằng chứng không sửa, không xóa được.
- Giao diện: form "Nguồn đã đổi" có 3 lựa chọn và hiện trạng thái câu trích; màn hình ghép hiện thông
  tin bản cũ.
