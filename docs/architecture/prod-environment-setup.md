# Tách môi trường production với dữ liệu sạch (2026-10-03)

> Quyết định của chủ dự án (2026-10-03): production **không** dùng chung database với dev;
> production bắt đầu với **dữ liệu sạch**. Ghi ở PROJECT_SPEC.md, Decision Log.
> Tài liệu này là các bước làm. Bước nào cần tài khoản hoặc mật khẩu thì **chủ dự án tự làm**;
> không dán mật khẩu hay chuỗi kết nối vào chat hoặc commit vào repo.

## Sau khi tách, mỗi môi trường dùng gì

| Môi trường | Ứng dụng | Database (Supabase) |
|---|---|---|
| Local (máy dev) | `npm run dev` | project hiện tại (**dev**) — giữ nguyên dữ liệu thử và dữ liệu đã duyệt |
| Vercel **Preview** | mỗi nhánh / commit | project **dev** |
| Vercel **Production** | `nordic-red.vercel.app` | project **prod** mới |

## Database prod mới sẽ có gì sau khi chạy migration

Migration (`packages/db/prisma/migrations`) tạo toàn bộ bảng, hàm, RLS và chỉ chèn dữ liệu nền:

- 5 quốc gia (Thụy Điển, Đan Mạch, Phần Lan, Na Uy, Hà Lan);
- danh mục quyền và vai trò Administrator;
- vài nguồn hạt giống ghi trong spec (EURES, Hotcourses Europe và các ứng viên nguồn T1 của
  Slice 2), tất cả ở trạng thái **chưa xác minh**.

**Không có:** tài khoản người dùng, tài liệu, thông tin, trường, chương trình, quy định, nghề,
lịch sử duyệt. Nguồn đã thêm tay trên dev cũng không có. Đây chính là "dữ liệu sạch": mọi thứ
công khai trên production sẽ được xác minh và duyệt lại trên chính production.

## Các bước

### 1. Tạo project Supabase prod (chủ dự án)
- Supabase → New project, đặt tên ví dụ `nordic-prod`, **vùng Sydney (ap-southeast-2)** — cùng vùng
  với Vercel `syd1`.
- Lưu mật khẩu database vào trình quản lý mật khẩu.

### 2. Chạy migration vào prod (chủ dự án, trên máy của mình)
Dùng biến môi trường tạm cho đúng một lệnh. File `.env.local` vẫn trỏ về dev; dotenv không ghi
đè biến đã đặt sẵn, nên lệnh dưới đây chạy vào prod:

```bash
# Nhập chuỗi kết nối prod (Supabase prod → Connect → Session pooler hoặc Direct), không hiện lên màn hình
read -s PROD_DIRECT_URL
DIRECT_URL="$PROD_DIRECT_URL" npm run db:migrate:deploy
unset PROD_DIRECT_URL
```
Kiểm tra: lệnh báo đã áp dụng toàn bộ migration, không lỗi.

### 3. Cấu hình đăng nhập cho prod (chủ dự án)
- Supabase prod → Authentication → URL Configuration: **Site URL** `https://nordic-red.vercel.app`,
  **Redirect URLs** `https://nordic-red.vercel.app/auth/callback`.
- Nếu dùng đăng nhập Google: bật provider Google trong project prod và thêm callback của project
  prod ở Google Cloud Console.
- Nên cấu hình **SMTP riêng** cho email (xác nhận tài khoản): dịch vụ email có sẵn của Supabase
  giới hạn số email và dành cho thử nghiệm.

### 4. Đổi biến môi trường trên Vercel (chủ dự án)
Settings → Environment Variables. **Chỉ sửa ở môi trường Production**; Preview giữ giá trị dev:

| Biến | Production (mới) | Preview (giữ) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL của project prod | dev |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key của prod | dev |
| `DATABASE_URL` | transaction pooler (cổng 6543) của prod | dev |
| `NEXT_PUBLIC_APP_URL` | `https://nordic-red.vercel.app` | dev / preview |

Sau đó **Redeploy** bản production.

### 5. Tạo quản trị viên đầu tiên trên prod (chủ dự án)
1. Mở `https://nordic-red.vercel.app/signup`, tạo tài khoản admin, **xác nhận email**.
2. Lấy UUID của tài khoản: Supabase prod → Authentication → Users → cột User UID.
3. Chạy script (dùng đúng chuỗi kết nối prod như bước 2):
   ```bash
   read -s PROD_DIRECT_URL
   DIRECT_URL="$PROD_DIRECT_URL" node scripts/bootstrap-admin.mjs <UUID>
   unset PROD_DIRECT_URL
   ```
   Hàm `bootstrap_administrator` chỉ chạy được **một lần** cho mỗi database (lần sau báo
   `rbac_already_bootstrapped`).
4. Đăng nhập lại; vào Người dùng & phân quyền để tạo các vai trò khác.

### 6. Kiểm tra (Claude + chủ dự án)
- `/api/health` báo `db: ok`; các trang công khai mở được nhưng **trống** (đúng như mong đợi).
- Đăng nhập admin; Tổng quan, `/admin`, Quản lý nguồn hoạt động.

### 7. Nạp dữ liệu cho prod (sau, theo quy trình bình thường)
Xác minh nguồn → crawler lấy trang (hoặc nhập tài liệu) → đề xuất → duyệt — tất cả trên prod.
Dữ liệu trên dev là tham khảo cho người duyệt, **không** chép sang prod.

### 8. Crawler và trích xuất AI (sau)
GitHub Actions hiện trỏ vào database **dev**. Khi muốn chạy trên prod: tạo các login role chỉ
có quyền `nordic_crawler_ops` / `nordic_extractor_ops` trong project prod (cách làm ở
`docs/architecture/slice-09-crawler.md` và `slice-10a-ai-extraction.md`), rồi cập nhật GitHub
secrets. Cần quyết riêng: workflow theo lịch chạy vào prod, dev hay cả hai.

## Rủi ro và lưu ý
- Gõ nhầm chuỗi kết nối ở bước 2/5 sẽ chạy vào dev. Migration chạy lại an toàn (đã áp dụng thì
  bỏ qua); `bootstrap_administrator` tự chặn khi database đã có quản trị viên.
- Từ khi tách, dữ liệu duyệt trên localhost **không** hiện trên production nữa.
