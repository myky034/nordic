# ISCED-F 2013 — danh mục ngành học (file `isced-f-2013.csv`)

> **Trạng thái (2026-10-07):** Claude chép 219 mã từ tài liệu chính thức; chủ dự án (Ky Vu) đối
> chiếu và ký từng dòng ngày 2026-10-07; đã nhập vào database dev (đang dùng chung với production)
> bằng `scripts/import-isced.ts`. Khi tách database prod, chạy lại script với `DIRECT_URL` của prod.

## Nguồn

| | |
|---|---|
| Tài liệu | *International Standard Classification of Education — Fields of education and training 2013 (ISCED-F 2013) — Detailed field descriptions* |
| Nhà xuất bản | UNESCO Institute for Statistics (UIS), 2015. ISBN 978-92-9189-179-5, DOI 10.15220/978-92-9189-179-5-en |
| Địa chỉ tải | https://www.uis.unesco.org/sites/default/files/medias/fichiers/2025/04/international-standard-classification-of-education-fields-of-education-and-training-2013-detailed-field-descriptions-2015-en.pdf |
| Tìm thấy từ | trang ISCED của UIS: https://www.uis.unesco.org/en/methods-and-tools/isced |
| Ngày tải | 2026-10-06 |
| SHA-256 của PDF | `3f463bb91d7ae89f17f12fcbd53d7746db46c81c140e49183518b8d7804e8564` |
| Phần đã chép | Appendix I "ISCED-F 2013: List of possible codes", trang 54–58 |
| Giấy phép | CC BY-SA 3.0 IGO (ghi trên trang 2 của tài liệu) |

UIS cho biết ISCED-F 2013 đang được sửa đổi (2025–2026). Bản 2013 vẫn là bản đang có hiệu lực,
nên cột `classification` trong database ghi rõ `ISCED-F 2013`.

Trang UNESDOC (`unesdoc.unesco.org`) chặn bằng trang kiểm tra chống bot, nên Claude không tải từ
đó (AGENTS.md §6); bản trên `uis.unesco.org` là bản do chính UIS lưu trữ.

## Cột trong file

| Cột | Ý nghĩa |
|---|---|
| `code` | mã ISCED-F: 2 chữ số (rộng), 3 (hẹp), 4 (chi tiết) |
| `level` | 1 rộng, 2 hẹp, 3 chi tiết |
| `parent_code` | mã cha = bỏ chữ số cuối; trống ở cấp rộng |
| `name_en` | tên **nguyên văn** theo Appendix I |
| `name_vi` | **bản dịch của Nordic** (Claude soạn), không phải của UNESCO |
| `source_page` | trang trong PDF có dòng đó |
| `verified_by`, `verified_on` | người đối chiếu và ngày (YYYY-MM-DD) — **bạn điền** |

## Đã kiểm tra tự động (2026-10-06)

- Mỗi cặp "mã + tên tiếng Anh" có nguyên văn trong văn bản trích từ Appendix I.
- Mỗi mã cũng có trong Appendix II (danh sách theo số), một danh sách độc lập trong cùng tài liệu.
- Không có mã nào trong Appendix I bị thiếu trong file: 12 rộng, 58 hẹp, 149 chi tiết.

Kiểm tra tự động không thay được người đọc: văn bản trích từ PDF có thể sai ở chỗ xuống dòng.

## Cách đối chiếu (chủ dự án)

1. Mở PDF ở trang 54–58 và file CSV (Excel/Numbers/Google Sheets đều được, nhớ lưu lại dạng CSV UTF-8).
2. Với từng dòng: so `code` và `name_en` với PDF; đọc `name_vi` xem bản dịch có ổn không (sửa nếu cần).
3. Điền `verified_by` (tên bạn) và `verified_on` (ngày đối chiếu) cho dòng đã kiểm tra.

## Cách nhập vào database (người vận hành)

1. Ở `/admin/sources`, đăng ký nguồn **UNESCO Institute for Statistics** (`https://www.uis.unesco.org/`),
   chọn tier phù hợp và xác minh như mọi nguồn khác.
2. Ở `/documents/import`, nhập tài liệu: chọn nguồn đó, URL PDF ở trên, chọn **đúng file PDF** đã
   tải. Mã băm phải trùng SHA-256 ở trên.
3. Lấy mã tài liệu (UUID) trong địa chỉ trang `/documents/<uuid>`.
4. Chạy kiểm tra (không ghi gì):
   `node scripts/import-isced.ts <uuid>`
5. Nếu báo "Check passed", chạy thật:
   `node scripts/import-isced.ts <uuid> --write`

Script dùng `DIRECT_URL` trong `.env.local` (như `scripts/bootstrap-admin.mjs`). Nhập lại lần
nữa không tạo trùng; nếu một mã đã có mà tên khác, script dừng (`taxonomy_conflict`) chứ không ghi
đè. Làm ở database nào thì chạy với `DIRECT_URL` của database đó (dev trước, prod sau khi tách).
