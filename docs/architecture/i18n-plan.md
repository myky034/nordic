# Kế hoạch chuyển đổi ngôn ngữ Việt / Anh (đã duyệt, đang làm — 2026-10-06)

> Yêu cầu của chủ dự án (2026-10-06): một nút chuyển **tiếng Việt ↔ tiếng Anh cho toàn bộ trang
> web**. Việc này đã được dự kiến ở Decision Log "2026-09-29 — UI language: Vietnamese now,
> language switch later".
>
> **Chủ dự án đã chốt (2026-10-06):** 2.1 → cookie; 2.2 → luôn tiếng Việt; 2.3 → có, gồm cả khu
> biên tập và quản trị; 2.4 → chưa làm email song ngữ và User Guide tiếng Anh.
> **Tiến độ:** đợt 1–3 xong ngày 2026-10-06 (xem mục 4).
> Đã đọc hướng dẫn Next.js đi kèm dự án: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`.

## 1. Phạm vi

**Được dịch (chuỗi giao diện do Nordic viết):** menu, nút, nhãn, tiêu đề, mô tả, thông báo trống,
thông báo lỗi, nhãn trạng thái/tier/quyền (đang nằm trong các module domain như `tiers`,
`sourceStatusLabels`, `permissionLabels`…), ngày giờ và cách viết số (1.200 ↔ 1,200).

**Không dịch** (giữ quyết định 2026-09-29, AGENTS.md §1): nội dung lấy từ nguồn — tên trường,
chương trình, quy định, nghề như nguồn ghi; trích đoạn; giá trị; mã T1–T4, mã phân loại, ngày ISO.
Đối tượng/thuộc tính của thông tin hiện đã là tiếng Anh nên hiển thị như cũ ở cả hai ngôn ngữ.
Tên quốc gia: tiếng Việt khi chọn tiếng Việt, tên tiếng Anh đã lưu khi chọn tiếng Anh.

**Bản dịch tiếng Anh do Claude soạn, chủ dự án duyệt.** Đây là chữ giao diện, không phải dữ liệu,
nên không cần nguồn; nhưng câu cảnh báo pháp lý ("không phải tư vấn pháp lý…") phải giữ đúng nghĩa.

## 2. Quyết định cần chủ dự án chốt

**2.1 Cách lưu ngôn ngữ đã chọn**

| | A. Cookie (đề xuất) | B. Đường dẫn `/en/...` |
|---|---|---|
| Cách hoạt động | Nút chuyển lưu lựa chọn vào cookie; địa chỉ trang không đổi | Tiếng Anh có tiền tố `/en` (ví dụ `/en/countries/sweden`); tiếng Việt giữ địa chỉ hiện tại |
| Gửi link cho người khác | Người nhận thấy theo ngôn ngữ **họ** đã chọn (mặc định tiếng Việt) | Người nhận thấy đúng ngôn ngữ của link |
| Google tìm thấy | Chỉ bản tiếng Việt | Cả hai bản |
| Công sức | Vừa: thêm cookie, đọc ngôn ngữ ở server | Lớn: dời toàn bộ cây trang vào `app/[lang]/`, sửa mọi link nội bộ, proxy chuyển hướng |
| Rủi ro | Thấp | Cao hơn: đụng mọi trang, mọi link, đăng nhập / callback |

→ **Đề xuất A** cho giai đoạn này: người dùng chính là người Việt, mục tiêu là cho người đọc tự
chọn ngôn ngữ, không phải làm SEO tiếng Anh. Có thể chuyển sang B sau nếu cần.

**2.2 Ngôn ngữ mặc định khi vào lần đầu:** đề xuất **luôn là tiếng Việt** (không đoán theo trình
duyệt), người dùng bấm nút để đổi; lựa chọn được nhớ.

**2.3 Phạm vi trang:** "toàn bộ trang web" gồm cả khu biên tập và quản trị? Đề xuất **có**, nhưng làm
theo thứ tự ở mục 4 để có bản dùng được sớm.

**2.4 Phần nằm ngoài ứng dụng:**
- Email xác nhận tài khoản do Supabase gửi theo mẫu cài trong Supabase, chỉ một ngôn ngữ. Đề xuất
  viết mẫu email **song ngữ** (một email, cả hai thứ tiếng).
- User Guide (`documents/User_Guide.docx`) hiện chỉ tiếng Việt. Có cần bản tiếng Anh không?

## 3. Thiết kế kỹ thuật (theo hướng A)

- `lib/i18n/`:
  - `locales.ts`: danh sách `vi | en`, mặc định `vi`, tên cookie;
  - `dictionaries/vi.ts`, `dictionaries/en.ts`: chuỗi theo nhóm (nav, home, countries, facts,
    review, admin…); TypeScript bắt buộc hai file **có cùng khóa**, thiếu một chuỗi là lỗi biên dịch.
- `getLocale()` (server, `cache()` theo request): đọc cookie, giá trị lạ thì về `vi`.
  `getDictionary(locale)` trả từ điển.
- Server component gọi `const t = await getDictionary(await getLocale())`. Client component nhận
  chuỗi qua props, hoặc qua một provider nhỏ nhận từ điển từ layout.
- Module domain (`tiers`, `verificationLabel`, `countryName`, `reasonLabel`…) nhận thêm tham số
  `locale`; vẫn là hàm thuần, có test cho cả hai ngôn ngữ.
- Nút chuyển ở header (cạnh Đăng nhập): **VI | EN**; bấm thì gọi server action đặt cookie rồi tải
  lại trang hiện tại. Trên điện thoại nằm trong menu ☰.
- `<html lang>` theo ngôn ngữ đang chọn.
- Định dạng số và ngày dùng `Intl` theo locale (`vi-VN` / `en-GB`); ngày ISO giữ nguyên.

## 4. Thứ tự làm (mỗi đợt có thể deploy riêng)

1. ✅ **Nền tảng (xong 2026-10-06):** `lib/i18n`, cookie, nút chuyển (trên điện thoại nằm trong menu ☰), header/footer/menu, trang chủ, trang lỗi / 404, tiêu đề và mô tả trang, `<html lang>`.
2. ✅ **Trang công khai (xong 2026-10-06):** quốc gia, trường, chương trình, quy định, nghề, so sánh, tìm kiếm, nguồn,
   tài liệu, thông tin, thẻ thông tin, đăng nhập / đăng ký.
3. ✅ **Khu cá nhân (xong 2026-10-06, kèm trang Tổng quan `/dashboard`):** Không gian của tôi, dự án, Kế hoạch châu Âu.
4. **Khu biên tập và quản trị:** các trang duyệt, nhập tài liệu, quản lý nguồn, phân quyền, crawler,
   trích xuất AI, chỉ số, bảng điều khiển.

Khối lượng: khoảng 130 file có chữ giao diện; đợt 1–2 là phần lớn giá trị cho người dùng. Mỗi đợt
có test hiển thị cả hai ngôn ngữ và kiểm tra "không còn chữ tiếng Việt cứng trong file đã chuyển".

## 5. Quan hệ với các việc khác

- Phân loại ngành / hướng nghề (giai đoạn 1): làm sau đợt 1–2 để tên ngành ISCED có sẵn tên tiếng
  Anh (theo tài liệu UNESCO) và tên tiếng Việt (bản dịch của Nordic).
- Sửa `/dev/preview` trả 404: độc lập, làm bất cứ lúc nào.
