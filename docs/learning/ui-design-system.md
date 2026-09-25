# UI design system (2026-09-23)

## Đã xây dựng

Toàn bộ giao diện được làm lại theo phong cách tối giản lấy cảm hứng từ Apple
Human Interface Guidelines, kết hợp với phần "UI / Visual Design Direction" trong
PROJECT_SPEC.md. Không dùng asset, icon hay thương hiệu của Apple. Không thêm
dependency nào.

- **Token** trong `apps/web/app/globals.css`: nền `canvas`, bề mặt `surface`, chữ
  `ink` / `ink-2` / `ink-3`, đường kẻ `hairline`, màu tương tác `accent`, và các
  màu ngữ nghĩa `positive` / `caution` / `critical`. Có sẵn light và dark mode.
- **Component dùng chung** trong `apps/web/components/ui/`:
  - `index.tsx`: `PageHeader`, `Section`, `List`, `ListRow`, `Badge`,
    `EmptyState`, `Notice`, `Card`, `DescriptionList`, `Disclosure`, `Field`,
    `FormMessage`, `ExternalLink`, `Quote`, `NoAccess`, `countLabel`.
  - `badges.tsx`: `TierBadge`, `ReviewBadge`, `SourceStatusBadge`.
  - `styles.ts`: class dùng chung cho `control`, các nút và link.
  - `loading.tsx` / `states.tsx`: skeleton khi đang tải và trạng thái lỗi.
- **Điều hướng**: `components/site-header.tsx` là thanh nav chung cho mọi trang,
  tab đang mở được làm nổi bật. `components/nav-links.tsx` là Client Component vì
  cần `usePathname`.

## Quy tắc cho danh sách (cách hiển thị để dễ đọc)

1. **Inset grouped list**: một khối bo góc, các hàng ngăn bằng đường kẻ mảnh.
   Không dùng lưới card rời rạc.
2. **Mỗi hàng có ba tầng chữ**: tiêu đề (17px, ink), dòng phụ (15px, ink-2),
   metadata (13px, ink-3). Badge đặt ngay cạnh tiêu đề. Số đếm hoặc hành động phụ
   đặt bên phải.
3. **Hàng dẫn sang trang chi tiết** thì cả hàng là link và có chevron `›`. Hàng
   không có trang chi tiết thì không có chevron.
4. **Tiết lộ dần**: chi tiết phụ (metadata registry, bằng chứng, form sửa hoặc
   duyệt) nằm sau `Disclosure` (thẻ `<details>` gốc, không cần JavaScript), thay
   vì mở sẵn hàng chục form.
5. **Việc cần xử lý lên trước**: trong workspace, đề xuất `proposed` và nguồn chưa
   xác minh được xếp lên đầu.
6. **Luôn có trạng thái rỗng** (`EmptyState`) nói rõ lý do, không để trống im
   lặng. Mọi danh sách hiện số lượng, với ngữ pháp số ít/số nhiều đúng.
7. **URL hiển thị như dữ liệu** thì dùng màu xám (`ExternalLink quiet`). Màu xanh
   accent chỉ dành cho hành động.

## Màu mang ý nghĩa, không để trang trí

| Tone | Dùng cho |
|---|---|
| accent (xanh) | Nút, link, tier T1, trạng thái "đã duyệt bằng chứng" |
| positive (xanh lá) | Nguồn registry đã verified, thông báo lưu thành công |
| caution (cam) | Đề xuất chờ duyệt, nguồn cần xác minh, disclaimer, nguồn không phải T1 |
| critical (đỏ) | Mâu thuẫn, review_required, lỗi |

"Đã duyệt bằng chứng" cố ý dùng màu xanh accent chứ không dùng xanh lá. Màu xanh
lá dễ bị đọc thành "đã xác minh là đúng", điều mà AGENTS.md mục 15 cấm.

## Vì sao thiết kế như vậy

- **Font hệ thống** (`-apple-system`, SF Pro trên thiết bị Apple): bỏ Geist từ
  Google Fonts. Không tải font từ bên ngoài, không bị giật layout, và build không
  còn phụ thuộc mạng.
- **Một màu accent duy nhất**: người dùng luôn biết chỗ nào bấm được.
- **Không lồng card trong card**: form nằm trong `Card`, nhưng form trong một
  hàng danh sách thì không có viền riêng (`SourceForm` được dùng ở cả hai chỗ).
- **Trợ năng**: focus ring rõ ràng; `role="alert"` / `role="note"` cho thông
  báo; `aria-current` cho tab đang mở; tôn trọng `prefers-reduced-motion`; ô nhập
  16px trên form đăng nhập để iOS không tự phóng to.

## Next.js / TypeScript

- Các component UI không dùng hook, nên dùng được trong cả Server lẫn Client
  Component. Chỉ `nav-links.tsx` và `states.tsx` là `"use client"`.
- `app/(public)/layout.tsx` bọc cả trang chủ lẫn các trang explore bằng cùng
  header và footer. `app/(app)/layout.tsx` dùng cùng header, thêm nút Sign out.
- `metadata.title.template` tạo tiêu đề tab dạng "… · Nordic".

## Thêm một trang mới

```tsx
<PageHeader eyebrow="Module" title="Tiêu đề" description="Một câu giải thích." />
<List>{rows.map((r) => <ListRow key={r.id} href={`/x/${r.id}`} title={r.name} subtitle={...} meta={...} />)}</List>
```

Không viết class màu Tailwind cố định (`zinc-*`, `red-*`); hãy dùng token (`text-ink-2`,
`bg-surface`, `text-critical`) để light và dark mode tự đúng.

## Kiểm thử

- `npm test` (147 pass), `npm run lint`, `npx tsc --noEmit -p apps/web`.
- Đã chụp màn hình headless các trang public (trang chủ, countries, country, sources,
  immigration, programmes, documents, login) ở 1280px và 500px.
- **Chưa** chụp các trang cần đăng nhập (dashboard, các workspace, admin): cần
  kiểm tra tay trên trình duyệt. Dark mode cũng cần kiểm tra tay (System Settings →
  Appearance).

## Cập nhật 2026-09-23 — danh sách dài: phân trang, tìm kiếm, tab trạng thái

Lý do: với dữ liệu lớn, danh sách mở sẵn tới 100 mục, mỗi hàng cao khoảng 140px,
khiến người dùng phải cuộn rất nhiều. Ba thay đổi:

1. **Phân trang 25 mục/trang + ô tìm kiếm** cho mọi danh sách (sources, documents,
   facts, programmes, universities, immigration, và các workspace). Không còn
   giới hạn 100 mục âm thầm ẩn phần còn lại.
   - Logic dùng chung nằm trong `apps/web/lib/pagination.ts`, có test:
     `pageParam`, `searchParam`, `pageWindow`, `pageSummary`, `withParams`,
     `choiceParam`.
   - PostgREST dùng `.select(..., { count: "exact" })` + `.range(from, to)`.
     Prisma dùng `skip/take` + `count()` (`searchSources`, `searchDocuments`).
   - Trang, tìm kiếm và tab đều nằm trên URL, nên link chia sẻ được và nút Back
     quay về đúng chỗ.
   - Tìm kiếm hiện chỉ là so khớp chuỗi con trên tên/tiêu đề (`ilike` với
     wildcard đã escape, hoặc Prisma `contains`). Full-text search vẫn thuộc Slice 7.
2. **Hàng gọn** (khoảng 60–70px): tiêu đề + badge, thêm đúng một dòng phụ. Chi
   tiết chuyển sang trang riêng: `/sources/[id]` (metadata registry và tài liệu của
   nguồn) và `/universities/[id]` (website, chương trình, bằng chứng tồn tại).
   Trang quốc gia chỉ hiện 5 fact mới nhất, kèm link "All facts" tới
   `/facts?country=…`.
3. **Segmented control theo trạng thái** trong workspace; mặc định mở tab cần xử
   lý ("Chờ duyệt", hoặc "Cần xác minh" trong Source Registry), kèm số lượng mỗi
   tab. Form đề xuất và lịch sử quyết định được thu gọn sau `Disclosure`. Form
   fact tự mở khi đi từ trang tài liệu sang (`?document=`).

Component mới trong `components/ui/index.tsx`: `Pagination`, `Segmented`,
`SearchInput`; `Disclosure` có thêm prop `open`.

## Cập nhật 2026-09-26 — trang xem trước UI `/dev/preview`

Lý do: để review giao diện cần có danh sách dài, dữ liệu mâu thuẫn, nhãn nguồn
không chính thức, bảng so sánh đầy ô… nhưng không được ghi dữ liệu bịa vào DB dùng
chung (AGENTS.md 1.1).

- Trang `apps/web/app/(public)/(explore)/dev/preview/page.tsx` render **đúng các
  component thật** (`FactCard`, `SourceList`, `CompareTable`, `ListRow`,
  `Pagination`…) với dữ liệu trong `apps/web/lib/dev/demo-fixtures.ts`.
- Dữ liệu fixture: mọi tên có tiền tố "DEMO", mọi URL dùng domain `example.test`
  (dành riêng cho test), mọi con số là 0, và trang có banner cam ở đầu.
- **Không truy cập DB** (test đảm bảo: mock client DB ném lỗi nếu bị gọi) và **trả
  404 ở production**. Khi build, trang được prerender thành 404.
- `CompareTable` / `CompareCell` được tách ra `components/compare-table.tsx` để trang
  `/compare` và trang preview dùng chung.
- Cách dùng: `npm run dev` → mở `http://localhost:3000/dev/preview`. Trang có mục
  lục để nhảy tới từng phần; bật dark mode trong cài đặt hệ điều hành để xem giao
  diện tối.
- Khi thêm component hoặc trạng thái mới, hãy thêm một mẫu vào trang này và vào
  `demo-fixtures.ts`.
