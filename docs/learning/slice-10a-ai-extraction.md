# Slice 10a — AI trích xuất thông tin ứng viên

## Đã xây dựng

- Migration `20260929090000_ai_extraction`: cột `facts.origin/ai_model/ai_confidence`,
  bảng `extraction_settings`, `extraction_requests`, `extraction_runs`,
  `extraction_items`, role `nordic_extractor_ops`, hàm kiểm tra `extractor_propose`.
- Package `extractor/`: worker gọi LLM (chuẩn OpenAI, đang dùng Gemini free tier).
- Trang tài liệu: mục **Trích xuất bằng AI** (yêu cầu/hủy) cho người có `facts.propose`.
- Trang `/admin/extraction`: tài khoản AI, yêu cầu đang mở, 10 lần chạy, lý do từng ứng viên bị loại.
- Thẻ thông tin: badge "Đề xuất bởi AI · <mô hình>" và "mô hình tự đánh giá x%".
- Workflow `.github/workflows/extractor.yml`.

## Vì sao thiết kế như vậy

- **AI chỉ đề xuất**: AGENTS.md 1.3 cấm biến output AI thành dữ liệu chính thức.
  Mọi đề xuất đi vào đúng hàng chờ duyệt mà bạn đã dùng.
- **Kiểm tra trong database, không chỉ trong worker**: nếu worker có lỗi hoặc
  bị sửa, database vẫn từ chối đoạn trích bịa và con số bịa.
- **Đoạn trích phải có nguyên văn trong trang**: đây là cách rẻ nhất để chặn
  "bằng chứng" do mô hình tự viết. Chuẩn hóa chữ hoa/thường, khoảng trắng và
  dấu phân cách số để không loại oan "10,656" với "10 656".
- **Mọi con số phải có trong đoạn trích**: chặn việc mô hình tự tính, đổi tiền
  tệ hoặc nhớ nhầm số từ nơi khác.
- **Tài khoản AI riêng, không có quyền duyệt**: AI không thể tự duyệt đề xuất của mình.
- **Chỉ tài liệu được yêu cầu**: kiểm soát chi phí và chất lượng (trang chủ
  EURES chẳng hạn sẽ sinh đề xuất vô ích).
- **Không dùng SDK**: một lệnh `fetch` là đủ; đổi nhà cung cấp chỉ cần đổi 3 biến.
- **Độ tự tin chỉ là gợi ý**: AGENTS.md 11 — không phải "trust score", luôn ghi
  rõ là mô hình tự đánh giá.

## Luồng hoạt động

1. Biên tập viên mở tài liệu do crawler lấy → **Yêu cầu trích xuất bằng AI**.
2. Workflow `extractor` (hằng ngày hoặc chạy tay) nhận tối đa 5 yêu cầu.
3. Worker cắt văn bản ở 50.000 ký tự, gửi cho mô hình kèm JSON schema.
4. Mỗi ứng viên → `extractor_propose` → đề xuất mới, hoặc bị loại kèm lý do.
5. Người duyệt xem ở `/facts/workspace` (tab Chờ duyệt), gắn thực thể nếu cần
   bằng cách tạo đề xuất mới, rồi duyệt hoặc từ chối.

## File nên đọc theo thứ tự

1. `packages/db/prisma/migrations/20260929090000_ai_extraction/migration.sql`
2. `extractor/src/config.ts`, `prompt.ts`, `validate.ts`
3. `extractor/src/llm.ts`, `db.ts`, `run.ts`, `main.ts`
4. `apps/web/app/(public)/(explore)/documents/[id]/extraction-*.ts(x)`
5. `apps/web/app/(app)/admin/extraction/*`, `apps/web/lib/facts/view.tsx`
6. `.github/workflows/extractor.yml`

## Khái niệm kỹ thuật

- **Structured Outputs / JSON schema**: yêu cầu mô hình trả JSON đúng cấu trúc.
  Vẫn phải kiểm tra lại vì nhà cung cấp có thể không tuân thủ hoàn toàn.
- **Prompt injection**: văn bản trang web có thể chứa câu "bỏ qua hướng dẫn…".
  Văn bản được bọc trong `<<< >>>` và mô hình được dặn coi nó là dữ liệu; kiểm
  tra ở database là lớp bảo vệ thật sự.
- **`FOR UPDATE SKIP LOCKED`**: hai lần chạy song song không nhận cùng một yêu cầu.
- **PL/pgSQL**: điều kiện `IF` đọc tới chữ `THEN` đầu tiên, nên `CASE ... THEN`
  trong điều kiện phải đặt trong ngoặc (lỗi đã gặp khi viết migration này).
- **Server Component + Server Action**: panel đọc quyền và trạng thái phía
  server; form client chỉ gọi action, action gọi RPC bằng session người dùng.

## Bảo mật

- Key LLM và `EXTRACTOR_DATABASE_URL` chỉ ở GitHub secret; không ở Vercel, không ở repo.
- Key Gemini nên giới hạn chỉ gọi Generative Language API; không bật billing nếu muốn miễn phí.
- Gói free của Gemini có thể dùng dữ liệu gửi lên để cải thiện sản phẩm: chỉ
  gửi văn bản trang công khai, không bao giờ gửi dữ liệu người dùng.
- Role `nordic_extractor_ops` không đọc được bảng nào (test PGlite).
- Log không chứa văn bản trang, prompt, key hay connection string.

## Lỗi thường gặp

- `extraction_account_missing`: chưa chọn tài khoản AI ở `/admin/extraction`,
  hoặc tài khoản đó có `facts.review` / mất `facts.propose`.
- Không thấy nút yêu cầu: tài liệu không có văn bản nội bộ (không phải do
  crawler lấy) hoặc tài khoản không có `facts.propose`.
- `rate_limited`: vượt giới hạn gói free; giảm `EXTRACTOR_MAX_DOCUMENTS` hoặc chạy sau.
- Nhiều ứng viên "Excerpt not found verbatim": mô hình diễn đạt lại thay vì chép;
  thử mô hình khác hoặc trang có nội dung rõ hơn.
- `http_400`: tên mô hình sai hoặc nhà cung cấp không hỗ trợ JSON schema.

## Kiểm thử

- `npm run test -w @nordic/extractor` (11 test: chuẩn hóa, kiểm tra ứng viên,
  prompt, client LLM với fetch giả, luồng chạy với DB giả).
- `apps/web/lib/extraction/database.test.ts` (PGlite: quyền, tài khoản AI,
  đoạn trích/số bịa bị loại, trùng, giới hạn 30, token).
- Test panel tài liệu, trang admin, badge trên thẻ.
- Thủ công: `npm run dry-run -w @nordic/extractor -- page.txt` với biến môi
  trường đặt tạm trong terminal, rồi chạy workflow thật trên một tài liệu.
