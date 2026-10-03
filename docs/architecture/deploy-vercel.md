# Chuẩn bị deploy lên Vercel (2026-10-03)

> Tài liệu chuẩn bị. **Chưa deploy.** Deploy và tạo tài nguyên mới (project Vercel, project
> Supabase production) là việc chủ dự án làm hoặc duyệt trước.

## Đã kiểm tra

- `next build` (production) chạy thành công trên máy dev ngày 2026-10-03; mọi trang dữ liệu là
  dynamic (ƒ), chỉ `/signup` là static.
- `/dev/preview` và `/dev/preview/patterns` trả 404 khi `NODE_ENV=production` (có trong code).
- Database Supabase hiện tại ở **ap-southeast-2 (Sydney)** (đọc từ hostname của pooler).

## Vùng chạy: `syd1`

`apps/web/vercel.json` đặt `"regions": ["syd1"]`, để server function của Vercel chạy cạnh
database ở Sydney. Mỗi trang gọi database nhiều lần; khi server ở xa (ví dụ Mỹ), mỗi lần gọi
mất thêm hàng trăm ms. Đây là nguyên nhân chính của việc "chuyển trang chậm" đã thấy khi dev.
Nếu sau này database chuyển vùng, phải đổi vùng Vercel theo.

## Cấu hình project Vercel

- **Root Directory:** `apps/web` (đúng như PROJECT_SPEC: "Vercel (root directory: apps/web)").
- Repo là npm workspaces; `next.config.ts` đã đặt `outputFileTracingRoot` về gốc repo để Vercel
  đóng gói được `packages/db`. Cần bật tùy chọn cho phép dùng file ngoài Root Directory nếu
  Vercel hỏi.
- Framework: Next.js (Vercel tự nhận).

## Biến môi trường

| Biến | Đặt ở Vercel? | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **Có** | URL công khai của môi trường đó. Dùng làm gốc cho link xác nhận email và callback Google (`app/(auth)/actions.ts`), nên phải đúng từng môi trường. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Có** | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Có** | Khóa publishable, không phải service role. |
| `DATABASE_URL` | **Có** | Theo `.env.example`: dùng **transaction pooler** cho Vercel. Hiện dev dùng session pooler (cổng 5432). **Cần thử trên một Preview deployment** rằng Prisma (adapter-pg) chạy ổn qua transaction pooler trước khi dùng cho production. |
| `INGESTION_API_TOKEN` | Chỉ khi dùng API nhập tài liệu | Bí mật, ≥ 32 ký tự. |
| `DIRECT_URL` | **Không** | Chỉ để chạy migration từ máy/CI. |
| `CRAWLER_*`, `EXTRACTOR_*`, `LLM_*`, `DATABASE_CA_CERT` | **Không** | Chỉ ở GitHub Actions secrets (crawler, extractor). `.env.example` ghi rõ không đặt ở Vercel. |

Không bao giờ đặt Supabase **service role key** ở Vercel; ứng dụng không dùng nó.

## Supabase Auth

- **Site URL** và **Redirect URLs** phải gồm URL production và `<URL>/auth/callback`.
- Nếu bật đăng nhập Google: thêm callback tương ứng ở Google Cloud Console.
- Preview deployment có URL thay đổi mỗi lần; vì `NEXT_PUBLIC_APP_URL` cố định, email xác nhận
  và Google từ preview sẽ quay về URL đã cấu hình. Muốn thử đăng nhập trên preview thì đặt
  `NEXT_PUBLIC_APP_URL` riêng cho môi trường Preview (một domain preview cố định).

## Migration

Trước khi deploy code cần migration mới: chạy `npm run db:migrate:deploy` (dùng `DIRECT_URL`)
vào đúng database của môi trường đó. Migration là SQL có trong repo, chạy lại an toàn.

## Cần chủ dự án quyết trước khi deploy production

1. **Tách môi trường.** PROJECT_SPEC §13 yêu cầu local / preview / production riêng. Hiện chỉ có
   **một** project Supabase (đang dùng cho dev, có dữ liệu thử và dữ liệu Thụy Điển đã duyệt).
   Lựa chọn:
   - (a) tạo project Supabase production mới ở cùng vùng Sydney, chạy migration, tạo quản trị
     viên đầu tiên (`bootstrap_administrator`), rồi nhập lại / chuyển dữ liệu đã duyệt;
   - (b) tạm dùng chung project hiện tại cho MVP và ghi rủi ro vào Decision Log.
2. **Domain** cho production (dùng cho `NEXT_PUBLIC_APP_URL` và Supabase Auth).
3. Crawler và extractor (GitHub Actions) trỏ vào database nào sau khi tách môi trường.
