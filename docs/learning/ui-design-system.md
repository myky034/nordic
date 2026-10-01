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

## Cập nhật 2026-09-28 — điều hướng theo nhóm (thay 9 tab ngang hàng)

**Vấn đề:** thanh nav có 9 mục ngang hàng trong một vùng cuộn ngang
(`overflow-x-auto`). Càng thêm module, chữ càng bị che mất ở cuối thanh.

**Cách làm (theo apple.com và Apple HIG: ít mục cấp cao, gom mục liên quan):**

- 5 mục cấp cao: **Countries · Study ▾ · Work & Immigration ▾ · Compare · Evidence ▾**.
  Cấu trúc nằm ở `lib/navigation/menu.ts` (có test); thêm module mới = thêm một
  dòng vào đúng nhóm, không thêm tab.
- Nhóm mở một **panel ngang toàn màn hình** dưới header: tên nhóm nhỏ, rồi từng
  trang với chữ lớn và một dòng mô tả. Mở bằng **click** (không chỉ hover) để dùng
  được bằng cảm ứng và bàn phím; `aria-expanded`/`aria-controls`; đóng bằng Esc,
  click ra ngoài, hoặc khi chuyển trang. Nhóm được tô nền khi đang ở một trang
  trong nhóm.
- Dưới **1024px (`lg`)**: nút **Menu** mở một sheet toàn màn hình liệt kê mọi
  trang theo nhóm. Chọn `lg` thay vì cỡ tablet vì trang đã đăng nhập có hai nút
  tài khoản ở bên phải; thanh không bao giờ được cắt chữ.
- Sheet được render bằng **portal vào `<body>`**: header dùng `backdrop-filter`,
  và thuộc tính này biến header thành containing block của phần tử
  `position: fixed` bên trong, khiến sheet bị ép vào chiều cao 56px của header.
  Portal chỉ render phía client (`useSyncExternalStore` trả `false` khi server
  render và hydrate) để tránh lệch HTML.
- Đóng menu khi đổi trang bằng cách so sánh `usePathname()` với giá trị trước
  ngay trong lúc render (cách React khuyến nghị để reset state theo input), không
  dùng effect.

File: `lib/navigation/menu.ts`, `components/nav-links.tsx` (`NavLinks`,
`MobileMenu`, `MobileNavList`), `components/site-header.tsx`.
Test: `lib/navigation/menu.test.ts`, `components/nav-links.test.tsx`.

## Cập nhật 2026-09-28 — Dashboard kiểu tổng quan (iCloud / Health)

Trang `/dashboard` trước đây là bốn danh sách chữ giống nhau. Nay gồm:

- **Cần xử lý**: ô số lớn như tóm tắt của Apple Health — Đề xuất chờ duyệt,
  Nguồn đã đổi, Yêu cầu AI đang chờ, Nguồn cần xác minh. Chỉ hiện ô người dùng
  có quyền xử lý; số đếm qua client của chính người dùng nên RLS giới hạn phạm vi.
  Số 0 để màu trung tính, số > 0 dùng màu accent; đếm lỗi hiện “—” và “Không tải
  được”, không bao giờ hiện 0 (AGENTS.md §13).
- **Các nhóm ô** (Của bạn, Biên tập, Quản trị, Khám phá): icon kiểu app iOS (ô
  vuông bo góc, màu hệ thống của Apple, nét trắng), tên, một dòng mô tả; lưới 1/2/3
  cột theo độ rộng. Icon chỉ trang trí (`aria-hidden`), tên ô mang nghĩa.
- Danh sách ô, quyền cần có và các bộ đếm nằm ở `lib/dashboard/items.ts`
  (`visibleGroups`, `visibleCounters`, có test) — trang chỉ hiển thị.
- Xem trước với dữ liệu DEMO: `/dev/preview?section=dashboard`.

File: `lib/dashboard/items.ts`, `app/(app)/dashboard/tiles.tsx` (`AppIcon`,
`TileLink`, `CounterTile`), `app/(app)/dashboard/page.tsx`.

## Cập nhật 2026-09-29 — Ngôn ngữ giao diện và bảng thuật ngữ

Quyết định (PROJECT_SPEC.md mục 21): **toàn bộ giao diện dùng tiếng Việt**. Nút
chuyển Việt/Anh sẽ làm sau. Chưa dịch hết một lần: làm theo từng đợt (0 thuật
ngữ → 1 form duyệt → 2 hướng dẫn người duyệt → 3 trang công khai → 4 trang quản
trị), nên trong lúc chuyển đổi, trang công khai vẫn còn một phần tiếng Anh.

### Nguyên tắc

- **Không hiện mã nội bộ**: không hiện `needs_verification`, `reviewed`, UUID
  hay mã quyền như `facts.review` cho người xem. Dùng nhãn trong bảng dưới.
- **Không dịch nội dung của nguồn**: tên trường, quy định, nghề, trích đoạn và
  giá trị giữ nguyên như nguồn viết. Giữ các mã cần đối chiếu với nguồn: T1–T4,
  mã SSYK/ISCO, ngày ISO.
- **Nhãn dùng chung đặt ở domain module**, không viết thẳng trong component. Khi
  làm nút chuyển ngôn ngữ, chỉ cần tách các module này thành từ điển theo ngôn
  ngữ.
- **Không nói quá bằng chứng** (AGENTS.md 15): "Đã duyệt bằng chứng" nghĩa là
  trích đoạn đã được đối chiếu, **không** có nghĩa thông tin còn hiệu lực. Không
  dùng "chính thức" hay "đã xác minh" cho một thông tin nếu quy tắc chưa cho phép.

### Bảng thuật ngữ

| Mã | Nhãn hiển thị | Định nghĩa ở |
|---|---|---|
| T1 | T1 · Cơ quan nhà nước (badge: "T1 · Nhà nước") | `tiers`, `tierShort` — `lib/registry/domain.ts` |
| T2 | T2 · Tổ chức / trường đại học | như trên |
| T3 | T3 · Nguồn chuyên môn / thứ cấp | như trên |
| T4 | T4 · Trải nghiệm / cộng đồng | như trên |
| tier trống | Chưa phân loại | `tierLabel`, `TierBadge` |
| nguồn `needs_verification` | Chưa xác minh | `sourceStatusLabels`, `verificationLabel` |
| nguồn `verified` | Đã xác minh (kèm "nội dung chưa kiểm tra hiệu lực" ở badge) | như trên |
| nguồn `review_required` | Cần xem xét lại | như trên |
| `proposed` | Chờ duyệt | `statuses` (`lib/facts/domain.ts`), `entityStatuses` (`lib/education/domain.ts`) |
| `reviewed` | Đã duyệt bằng chứng | như trên |
| `rejected` | Đã từ chối | như trên |
| `conflicted` | Có mâu thuẫn | `statuses` |
| ngày không có | Chưa có | `dateLabel` |
| bậc học `unknown` | Nguồn không nêu | `degreeTypes` |
| chủ đề AI (`tuition`…) | Học phí… | `topicLabel` (`lib/facts/domain.ts`) |

Từ nên dùng thống nhất: **nguồn** (source), **tài liệu** (document, một trang đã
lưu), **trích đoạn** (excerpt), **đề xuất** (proposal), **duyệt** (review),
**xác minh nguồn** (verify a source), **công khai** (hiển thị cho người chưa
đăng nhập).

### Thẻ thông tin (`FactCard`)

Mỗi giá trị chỉ xuất hiện một lần dưới nhãn của nó (trước đây nhãn bị lặp, ví
dụ "Nguồn — Nguồn: …"). Ô hiệu lực nói rõ khi nguồn không nêu thời hạn, thay
vì hiện "chưa biết · chưa biết".

## Cập nhật 2026-09-29 — Đợt 1: form duyệt và trạng thái công khai

### Đã xây dựng

- **`ReviewPanel`** (`components/review/review-panel.tsx`): một form duyệt dùng
  chung cho 4 workspace (thông tin, trường/chương trình, nhập cư, nghề). Gồm danh
  sách việc cần đối chiếu, ô ghi chú bắt buộc, và **hai nút "Duyệt" / "Từ chối"**.
- **`VisibilityNote`** (`components/review/visibility-note.tsx`): dưới mỗi mục ở
  workspace, cho biết mục đó **đang công khai**, **đã duyệt nhưng chưa công khai
  (kèm lý do)**, hay (với đề xuất) **sau khi duyệt có công khai không**.
- **`ConflictForm`** (workspace thông tin): tách riêng việc đánh dấu mâu thuẫn,
  chỉ hiện với thông tin đã duyệt; danh sách chọn hiện "đối tượng — thuộc tính:
  giá trị" thay vì 8 ký tự đầu của ID.
- Ở tab "Chờ duyệt", bằng chứng và form duyệt **mở sẵn**, không phải bấm thêm.
- Nút kiểu "destructive" (`buttonDestructive`): chữ đỏ trên nền xám, theo Apple HIG.

### Vì sao thiết kế như vậy

- **Ô "Quyết định" cũ mặc định là "Đã kiểm tra bằng chứng"**: chỉ cần gõ ghi chú
  rồi bấm lưu là đã duyệt. AGENTS.md 1.3 yêu cầu một người *chủ động* quyết định,
  nên giờ không có lựa chọn nào được chọn sẵn.
- **Duyệt xong mà không thấy công khai là điều khó hiểu nhất với người mới.** Quy
  tắc công khai nằm trong RLS (ví dụ quy định nhập cư cần nguồn T1 *đã xác minh*),
  người duyệt không thấy được. Giờ màn hình nói rõ lý do và dẫn tới chỗ sửa.
- Form cũ cho chọn "Đánh dấu mâu thuẫn" với đề xuất chưa duyệt, nhưng database
  luôn từ chối lựa chọn đó (quy tắc 2026-09-23). Lựa chọn không bao giờ thành công
  thì không nên xuất hiện.

### Luồng hoạt động: "mục này có công khai không?"

1. Trang workspace tải danh sách bằng client của người dùng (thấy cả bản nháp).
2. `publicIds(table, ids)` (`lib/review/public-check.ts`) hỏi lại **bằng client ẩn
   danh** (`anon`): "trong các id này, id nào người chưa đăng nhập đọc được?".
   RLS trả lời, nên đây là câu trả lời thật, không phải đoán.
3. Nếu một mục đã duyệt không có trong kết quả, `factBlockers` / `ruleBlockers` /
   `programmeBlockers` (`lib/review/visibility.ts`) giải thích lý do bằng lời.
4. `visibilityOf` gộp hai thông tin trên thành một trạng thái; `VisibilityNote`
   hiển thị. Nếu bước 2 lỗi thì hiện "Không kiểm tra được", **không bao giờ** đoán
   là đang công khai (AGENTS.md 13).

### Khái niệm Next.js / React

- **Nhiều nút submit trong một form action**: `<button name="decision"
  value="reviewed">`. React 19 đưa `name/value` của nút được bấm vào `FormData`
  truyền cho server action, nên không cần state phía client. Server action vẫn
  kiểm tra giá trị (không tin dữ liệu từ trình duyệt).
- **Tách phần hiển thị khỏi hook**: `ReviewFields` không dùng `useActionState`,
  nên trang `/dev/preview` (Server Component) render được bản "khóa" để xem giao
  diện mà không cần server action.

### Khái niệm TypeScript

- `Visibility` là **discriminated union** (`state: "public" | "hidden" | …`):
  `switch (visibility.state)` trong `VisibilityNote` buộc xử lý đủ mọi trường hợp,
  và chỉ trạng thái `hidden` / `will_stay_hidden` mới có `blockers`.

### Bảo mật

- Client ẩn danh chỉ dùng publishable key (vốn công khai) và chỉ `select("id")`.
- Logic giải thích **không quyết định** gì: chỉ database (RLS) quyết định công khai.
  Vì vậy nếu code giải thích bị lệch so với policy, hậu quả chỉ là lời giải thích
  mơ hồ hơn, không bao giờ là nhãn "đang công khai" sai.

### Lỗi thường gặp

- Sửa policy `*_public` trong migration mà quên sửa `lib/review/visibility.ts`:
  test `visibility.database.test.ts` sẽ fail, vì nó dựng mọi tổ hợp trạng thái
  trong PGlite và so sánh với kết quả thật của `anon`.
- Viết test so khớp chuỗi thuộc tính HTML theo thứ tự: React có thể sắp xếp thuộc
  tính khác đi. Hãy kiểm tra từng thuộc tính riêng.

### Kiểm thử

- `lib/review/visibility.test.ts`: các quy tắc giải thích.
- `lib/review/visibility.database.test.ts`: đối chiếu với RLS thật (PGlite, mọi
  migration, dữ liệu giả).
- `components/review/review.test.tsx`: có hai nút submit, không có `<select>`,
  ghi chú bắt buộc; không bao giờ nói "đang công khai" khi kiểm tra lỗi.
- Xem bằng mắt: `/dev/preview?section=workspace` (tab Chờ duyệt / Đã duyệt / Từ chối).

### Thứ tự đọc code

`lib/review/visibility.ts` → `lib/review/public-check.ts` →
`components/review/visibility-note.tsx` → `components/review/review-panel.tsx` →
`app/(app)/immigration/workspace/page.tsx` (ví dụ gọn nhất) →
`app/(app)/facts/workspace/page.tsx` (có liên kết quy định/nghề).

### Còn lại

- User Guide (`documents/User_Guide.docx`) vẫn mô tả form cũ ("Duyệt đề xuất
  này", "Ghi nhận quyết định"); cập nhật sau đợt 2 (xem mục đợt 2 bên dưới).
- Chưa thử trên database thật với tài khoản duyệt (trang workspace cần đăng nhập).

## Cập nhật 2026-09-29 — Đợt 2: hướng dẫn cho người duyệt

### Đã xây dựng

- **"Quy trình duyệt"** (`components/review/review-steps.tsx`) ở đầu 4 trang
  workspace, chỉ hiện với người có quyền duyệt: ba bước đánh số
  (1 Xác minh nguồn → 2 Duyệt mục gốc → 3 Duyệt thông tin chi tiết), mỗi mục có số
  việc đang chờ, bước hiện tại được tô xanh (`aria-current="page"`). Mục người dùng
  không có quyền mở vẫn hiện, kèm "Người quản lý nguồn thực hiện".
- **Lịch sử quyết định dễ đọc** (`components/review/decision-history.tsx`): tên
  mục (thay vì UUID), nhãn "Đã duyệt / Đã từ chối / Đánh dấu mâu thuẫn / Vẫn khớp
  nguồn mới" (thay vì `reviewed`…), thời gian ghi rõ UTC; với mâu thuẫn, ghi cả
  thông tin đối chiếu.
- **Câu chữ**: mô tả đầu 4 trang viết lại theo "mục này dùng để làm gì, khi nào
  công khai"; thông báo thiếu quyền dùng tên dễ hiểu kèm mã
  ("Duyệt đề xuất (facts.review)") — `lib/rbac/labels.ts`.

### Vì sao thiết kế như vậy

- Thứ tự làm việc quyết định việc công khai (nguồn → mục gốc → thông tin gắn
  kèm). Trước đây thứ tự này không có trên màn hình. Nó được định nghĩa một chỗ
  (`lib/review/steps.ts`), không nằm trong component (AGENTS.md 16).
- Số đếm đi qua client của người dùng, nên RLS giới hạn mọi con số — cùng quy tắc
  với `/dashboard`. Đếm lỗi thì hiện "—", không hiện 0 (AGENTS.md 13).
- Mã quyền vẫn được giữ trong ngoặc vì quản trị viên cần tìm đúng mã đó ở trang
  phân quyền (trang đó sẽ được Việt hóa ở đợt 4).

### Khái niệm Next.js / Supabase

- **Async Server Component**: `ReviewSteps` tự `await` các truy vấn đếm rồi render.
  Phần hiển thị tách thành `ReviewStepsView` (đồng bộ, không truy cập dữ liệu) để
  `/dev/preview` và test dùng được — `renderToStaticMarkup` không render được
  component async lồng bên trong.
- **Embed có hai khóa ngoại tới cùng bảng**: `fact_reviews` có `fact_id` và
  `related_fact_id` cùng trỏ tới `facts`, nên PostgREST cần tên constraint:
  `fact:facts!fact_reviews_fact_id_fkey(subject,predicate)`. `fact:` là alias để
  đặt tên trường trong kết quả.

### Kiểm thử

- `lib/review/steps.test.ts`: thứ tự bước, mục không có quyền, nhãn quyết định,
  thời gian có UTC, tên quyền kèm mã.
- `components/review/review.test.tsx`: lịch sử không hiện mã thô; quy trình hiện
  đúng số đếm, đánh dấu bước hiện tại, đếm lỗi hiện "—" và không có link khi thiếu
  quyền.
- Xem bằng mắt: `/dev/preview?section=workspace`.

### Còn lại

- User Guide đã cập nhật lên v2.1 (2026-09-30) theo đợt 0–2: mục 5 (thanh Quy
  trình duyệt), 5.4 (khung quyết định, trạng thái công khai, lịch sử), 6.1–6.3,
  hình 14, 15, 22, 22b, 24 chụp lại từ `/dev/preview`.
- Chưa thử với database thật và tài khoản duyệt.

## Cập nhật 2026-09-30 — Header và nút theo phân quyền

### Đã xây dựng

- **Header giống nhau ở mọi trang** (`components/account-actions.tsx`). Trước
  đây trang công khai luôn hiện nút "Workspace" cố định và không có "Đăng xuất",
  nên người dùng mất nút đăng xuất khi rời khu workspace.
  - Chưa đăng nhập: **Đăng nhập**.
  - Đã đăng nhập: **Không gian của tôi** (`/workspace`) và **Đăng xuất**.
  - Biên tập viên: thêm **Biên tập** (`/dashboard`); người duyệt thấy số đề xuất
    đang chờ trên nút đó. Trên màn hình hẹp, "Không gian của tôi" được ẩn (vẫn có
    trong tile của dashboard) để header không bị tràn.
- **Nút biên tập trên trang công khai chỉ hiện với người có quyền**:
  "Thêm thông tin & bằng chứng" (trang tài liệu, cần `facts.propose`), "Biên tập
  thông tin" (`/facts`) và link workspace trong trạng thái trống của trang quốc gia
  (cần `facts.propose` hoặc `facts.review`).

### Vì sao thiết kế như vậy

- Quy tắc nằm trong `lib/rbac/ui.ts` (có test), không nằm trong component
  (AGENTS.md 16). "Biên tập viên" = người thấy ít nhất một tile nhóm Biên tập hoặc
  Quản trị trên dashboard, dùng chung danh sách `lib/dashboard/items.ts`, nên
  header và dashboard không thể lệch nhau.
- **Ẩn nút không phải là phân quyền.** Trang workspace, server action và RLS vẫn tự
  kiểm tra quyền như trước; gõ thẳng URL vẫn bị chặn đúng như cũ. Việc ẩn chỉ để
  người dùng không bấm vào chỗ họ không dùng được.
- Nếu không đọc được quyền, người xem được coi là **không có quyền** (ẩn nút biên
  tập) và lỗi được ghi log — hỏng thì đóng, không mở.

### Khái niệm Next.js / React

- **`cache()` của React** (`lib/rbac/viewer.ts`, `lib/review/pending-total.ts`):
  header và trang cùng hỏi quyền trong một request; `cache()` gộp thành một lần gọi
  `my_permissions` cho mỗi request (không lưu giữa các request).
- Header đọc cookie phiên đăng nhập nên trang chủ `/` giờ render theo từng request
  (dynamic) thay vì tĩnh; các trang khám phá vốn đã như vậy.
- `server-only`: module nào gọi `createClient()` của server được đánh dấu
  `server-only`. Phần đếm thuần (`lib/review/pending-counts.ts`) không có dấu này
  để test và `/dev/preview` dùng được.

### Kiểm thử

- `lib/rbac/ui.test.ts`: ai là biên tập viên, đề xuất khác duyệt, link header theo
  vai trò.
- `components/account-actions.test.tsx`: khách, người dùng thường, người duyệt (có
  số đếm), người đề xuất (không số đếm), đếm lỗi thì không hiện số.
- Test trang tài liệu và trang quốc gia: khách không thấy link workspace; người có
  quyền thì thấy.

## Cập nhật 2026-09-30 — Trang "Thông tin & bằng chứng" dạng chia đôi (kiểu Mail)

### Vấn đề

Trang duyệt hiển thị tới 25 thẻ thông tin đầy đủ, mỗi thẻ kèm form mở sẵn. Người
duyệt phải cuộn rất xa xuống cuối trang để phân trang hoặc xem lịch sử, rồi lại
cuộn lên để đổi tab.

### Đã xây dựng (`components/review/split-view.tsx`)

- **Bên trái**: danh sách gọn (tiêu đề "đối tượng — thuộc tính", một dòng giá trị ·
  nguồn, nhãn nhỏ "AI", "Nguồn đã đổi", "Chưa công khai"), có thanh cuộn riêng;
  phân trang gọn ("1–25 / 60 ‹ 1/3 ›") luôn nằm ở chân danh sách.
- **Bên phải**: thẻ thông tin của mục đang chọn, dòng trạng thái công khai và khung
  quyết định; nút **‹ Trước · 7/25 · Sau ›** để đi qua các mục mà không cần danh sách.
  Khung này cũng cuộn riêng; đổi mục thì nó quay về đầu.
- **Duyệt xong tự sang mục kế tiếp**: mục vừa duyệt rời tab "Chờ duyệt", nên trang
  hiển thị mục đầu tiên còn lại (`lib/review/selection.ts`) — không cần code phía
  trình duyệt.
- **Màn hình hẹp (< 1024px)**: chỉ đủ chỗ cho một khung. Chưa chọn thì hiện danh
  sách; chọn một mục thì hiện chi tiết với nút "‹ Danh sách".

### Next.js

- Mục đang chọn nằm trong URL (`?fact=<id>`), nên tải lại trang vẫn giữ nguyên và
  hoạt động không cần JavaScript phía client. Các `Link` dùng `scroll={false}` để
  trang không nhảy lên đầu khi đổi mục.
- `key={current.id}` trên khung chi tiết: React tạo lại phần tử khi đổi mục, nên
  vị trí cuộn của khung được đặt lại về đầu, và form của mục cũ không giữ trạng
  thái (thông báo lỗi…) sang mục mới.

### Kiểm thử

- `lib/review/selection.test.ts`: chọn đúng mục, mục trước/sau; mục đã rời danh sách
  thì chọn mục đầu; danh sách trống thì không chọn gì.
- Xem bằng mắt: `/dev/preview?section=review` (thêm `&item=f8` để chọn một mục).

### Còn lại

- Ba trang duyệt còn lại (trường & chương trình, nhập cư, nghề) vẫn là danh sách
  một cột; mục của chúng ngắn hơn nhiều. Có thể chuyển sang cùng bố cục nếu cần.
- User Guide mục 5.4 vẫn mô tả danh sách một cột cho trang này; cần cập nhật hình 22
  và đoạn hướng dẫn.

## Cập nhật 2026-09-30 — "Các thông tin khác từ cùng trang này"

### Vì sao

Khi duyệt lô Thụy Điển, 9 thông tin khác nhau (lương của các nghề khác nhau, các
điều kiện visa khác nhau) bị từ chối với lý do "trùng" chỉ vì có chung trang nguồn.
Truy vấn cho thấy không có thông tin nào trùng đối tượng và thuộc tính với chúng.
Màn hình cũ không cho người duyệt thấy trang đó đã chứng minh những gì khác.

### Đã xây dựng

- Trong khung chi tiết của `/facts/workspace`, ngay trên khung quyết định: danh sách
  các thông tin khác lấy từ **cùng tài liệu** (tối đa 30, bỏ qua mục đã từ chối), kèm
  trạng thái và giá trị, cùng câu giải thích "cùng trang không có nghĩa là trùng".
- Mục có **cùng đối tượng và thuộc tính** (không phân biệt hoa thường, khoảng trắng,
  chuẩn hóa NFC) được tô cam và gắn nhãn **Có thể trùng**, xếp lên đầu. Đây chỉ là gợi
  ý: hệ thống không tự từ chối hay gộp (AGENTS.md 1.4).
- Không tải được thì ghi rõ "Không tải được…", không ẩn đi (AGENTS.md 13).

### File

`lib/review/siblings.ts` (quy tắc, có test) → `components/review/same-page-facts.tsx`
(hiển thị) → `app/(app)/facts/workspace/page.tsx` (truy vấn cho mục đang chọn).
Xem thử: `/dev/preview?section=review&item=f1`.

## Cập nhật 2026-09-30 — Trang quản lý nguồn `/admin/sources` dạng chia đôi

### Vấn đề

Mỗi nguồn là một dòng có form chỉnh sửa dài (13 trường) giấu trong "Chỉnh sửa";
mở form ở dòng thứ 10 thì phải cuộn rất xa, phân trang nằm ở cuối, và nhãn còn
tiếng Anh và mã thô ("Source tier", "Crawl policy: not_reviewed").

### Đã xây dựng

- Dùng lại `SplitView`: **bên trái** danh sách nguồn (tên, tên miền · quốc gia, nhãn
  tier / xác minh / "Đang crawl"), phân trang ở chân danh sách; **bên phải** tiêu đề
  nguồn, URL, các nhãn, ngày xác minh gần nhất và form. `?source=<id>` chọn nguồn;
  nút **Thêm nguồn mới** ở đầu trang mở form trống ở khung bên phải (`?new=1`).
- **Form chia nhóm** theo câu hỏi mà nhóm đó trả lời, giống Cài đặt của Apple:
  Thông tin nguồn · Phân loại và xác minh · Crawl · Ghi chú nội bộ.
- **Hướng dẫn chọn tier ngay dưới ô Tier** (`tierGuidance` trong
  `lib/registry/domain.ts`), cùng câu nhắc "chưa chắc thì để Chưa phân loại"; ô Căn
  cứ xác minh có ví dụ mẫu. Chính sách crawl dùng nhãn tiếng Việt
  (`crawlPolicyLabels`).
- **Thanh "Lưu thay đổi" dính ở đáy cửa sổ**: với form dài, khung chi tiết cuộn theo
  trang (`paneScroll={false}`) còn danh sách vẫn dính bên trái, nên nút lưu luôn
  trong tầm nhìn. Trang duyệt thông tin vẫn để khung chi tiết cuộn riêng.
- Lưu xong mà nguồn chuyển sang tab khác (ví dụ sang "Đã xác minh") thì nguồn đầu
  tiên còn lại được mở, như hàng chờ duyệt.

Xem thử: `/dev/preview?section=sources-admin&src=s2`.

## Cập nhật 2026-09-30 — Trang phân quyền `/admin/access`

### Vấn đề

Một trang dài gồm: danh sách vai trò (mỗi vai trò giấu form sửa), danh sách người dùng
(mỗi người có hai ô chọn "vai trò" + "Gán / Gỡ" rất dễ bấm nhầm), và nhật ký hiện mã
thao tác cùng UUID. Quyền hiện bằng mã (`facts.review`) và mô tả tiếng Anh.

### Đã xây dựng

- **Ba tab** (`?tab=users|roles|audit`), chỉ hiện tab người đó có quyền dùng.
- **Người dùng** (chia đôi): danh sách email kèm vai trò (hoặc nhãn cam "Chưa có vai
  trò"); bên phải là **Vai trò hiện có**, mỗi vai trò một thẻ có nút **Gỡ** riêng, và
  **Thêm vai trò** chỉ liệt kê vai trò người đó chưa có và bạn được phép gán. Tài
  khoản của chính bạn không sửa được (database cũng từ chối).
- **Vai trò** (chia đôi): quyền chia nhóm (Thông tin và duyệt · Dữ liệu chuyên mục ·
  Nguồn và tài liệu · Quản trị — `permissionGroups` trong `lib/rbac/labels.ts`), tên
  tiếng Việt kèm mã nhỏ; quyền bạn không có thì bị khóa kèm lý do. **+ Tạo vai trò
  mới** ở chân danh sách; thanh **Lưu vai trò** dính ở đáy cửa sổ.
- **Nhật ký**: tên thao tác dễ hiểu (`auditActionLabel`: "Gán vai trò", "Lưu URL
  crawl"…), "người thực hiện → đối tượng" hiện tên vai trò, email hoặc "Bạn" khi
  trang đã biết; dữ liệu gốc (JSON) nằm trong "Chi tiết kỹ thuật".

### Bảo mật

Không đổi server action hay RPC: gỡ và thêm vẫn gọi `assign_access_role` như trước;
việc khóa quyền trong form chỉ là hiển thị, database vẫn tự kiểm tra (không cấp được
quyền mình không có, không tự đổi vai trò của mình).

Xem thử: `/dev/preview?section=access-admin` (thêm `&atab=roles`).

## Cập nhật 2026-09-30 — Trang so sánh các kiểu bố cục `/dev/preview/patterns`

Để chủ dự án so sánh trước khi chọn bố cục cho trang thật. Chỉ có khi chạy dev (bản
production trả 404), chỉ dùng dữ liệu DEMO (`patterns/data.ts`, tên miền
`example.test`), không truy cập database, nút và form không lưu gì. Trạng thái nằm
trong URL (`?p=…&open=…&sort=…`), giống trang thật.

| `?p=` | Kiểu | Ghi chú kỹ thuật |
|---|---|---|
| `inspector` | Danh sách toàn chiều rộng + khung trượt từ phải (bảng trượt từ dưới trên điện thoại) | Khung là `position: fixed` + lớp nền mờ bấm để đóng; Esc đóng qua `KeyNav` |
| `table` | Bảng có sắp xếp theo cột và lọc bằng chip | Bảng nằm trong khung cuộn ngang, nên **không** dùng tiêu đề sticky (sticky sẽ bám theo khung, không theo cửa sổ) |
| `focus` | Duyệt từng mục, thanh tiến độ, nút cố định ở đáy | Phím tắt A / R / J / K / ← / → qua `KeyNav`; phím bị bỏ qua khi đang gõ trong ô nhập |
| `three` | Ba cột: khu vực + danh sách + chi tiết | Trên màn hình hẹp, cột khu vực thành hàng chip cuộn ngang |
| `cards` | Lưới thẻ cho trang công khai | Lọc theo quốc gia bằng chip |
| `accordion` | Mở rộng tại chỗ | `<details name="…">` của HTML: mở dòng này thì dòng kia tự đóng, không cần JavaScript |

`keys.tsx` (`KeyNav`) là component client duy nhất: gắn phím → URL bằng
`router.push`. Test: `patterns/patterns.test.tsx` (404 ở production, không truy cập
database, cả 6 kiểu render, mọi link ngoài là `example.test`).

## Cập nhật 2026-09-30 — `/admin/access` chuyển sang Bảng + khung trượt

Chủ dự án chọn kiểu 1–2 trong `/dev/preview/patterns` cho trang phân quyền, thay
bố cục chia đôi.

- **Ba bảng** (Người dùng · Vai trò · Nhật ký) dùng `DataTable` / `DataRow` / `Cell`
  (`components/ui/data-table.tsx`). Cả dòng là một vùng bấm: ô đầu chứa link, và
  `after:absolute after:inset-0` phủ link lên toàn dòng (`tr` có `relative`), nên
  trình đọc màn hình chỉ gặp một link có tên.
- **Sắp xếp** bằng tiêu đề cột (Vai trò: tên, số quyền; Nhật ký: thời gian, thao tác,
  người thực hiện). Quy tắc trong `lib/table.ts` (có test): giá trị trống luôn nằm
  cuối, chữ tiếng Việt so theo `Intl.Collator("vi")`. Bảng Người dùng **không** sắp
  xếp: dữ liệu về 20 dòng mỗi trang, sắp xếp sẽ chỉ đổi thứ tự trong một trang và gây
  hiểu nhầm.
- **Khung trượt** (`components/ui/inspector.tsx`): mở bằng tham số URL (`?user=`,
  `?role=`, `?entry=`, `?new=1`), đóng bằng ✕, bấm ra ngoài hoặc Esc (`KeyNav`, giờ ở
  `components/key-nav.tsx`). Khung cuộn riêng nên thanh "Lưu vai trò" luôn hiện.
  Trên điện thoại khung trượt từ dưới lên.
- Server action và RPC không đổi. Test: `app/(app)/admin/access/access-page.test.tsx`.
- 2026-09-30: khung người dùng có thêm **Quyền hiện có**: hợp các quyền từ mọi vai trò
  người đó đang có, chia nhóm như trình sửa vai trò, mỗi quyền ghi "từ <vai trò>"
  (`lib/rbac/effective.ts`, có test; `app/(app)/admin/access/effective-permissions.tsx`).
  Chỉ để xem: quyền thật do database tính (`has_permission`).

## Cập nhật 2026-09-30 — Cuộn bị giật: hạn chế hiệu ứng làm mờ

Chủ dự án thấy cuộn trang bị giật. Nguyên nhân chính là `backdrop-filter` (làm mờ
nền): khi nội dung phía sau một lớp mờ di chuyển, trình duyệt phải làm mờ lại vùng
đó ở **mọi khung hình**. Các lớp mờ lại xếp chồng lên nhau: header toàn trang, lớp
nền khi mở khung trượt, tiêu đề dính của khung trượt, thanh "Lưu" dính.

**Quy tắc từ nay:**

- Chỉ header toàn trang được làm mờ, và ở mức nhẹ (`backdrop-blur-md`, bỏ
  `backdrop-saturate`).
- **Không** làm mờ lớp nền phủ toàn màn hình (dùng `bg-black/30`), và **không** làm
  mờ các thanh dính nằm trong vùng cuộn (tiêu đề khung trượt, thanh lưu, thanh nút
  của chế độ tập trung): dùng nền đặc `bg-canvas`.
- Khi kiểm tra độ mượt, nên dùng bản production (`npm run build && npm start`):
  `next dev` chạy mã chưa tối ưu nên chậm hơn bản thật.

## Cập nhật 2026-09-30 — Bấm và chuyển trang chậm

### Đo được

- Trang DEMO không truy cập database render trong ~0,1 giây; trang thật 1–3 giây.
- Mỗi lượt gọi Supabase từ máy dev mất **0,4–0,8 giây**: database ở vùng
  **ap-southeast-2 (Sydney)**. Thời gian chủ yếu là chờ mạng, và một số lượt gọi chạy
  **nối tiếp** thay vì song song.

### Đã sửa

- **Hỏi quyền một lần mỗi request**: `myPermissionKeys` và `accessContext` trong
  `lib/rbac/access.ts` dùng `cache()` của React; `viewerPermissions` (header) dùng lại
  cùng kết quả. Trước đây header và trang mỗi bên gọi `my_permissions` một lần.
- **`getUser()` và hỏi quyền chạy song song** trong `accessContext` (kết quả "chưa
  đăng nhập" vẫn được kiểm tra trước, nên quy tắc không đổi).
- **Streaming bằng `<Suspense>`**: phần tài khoản ở header, con số việc chờ trên nút
  "Biên tập" và thanh "Quy trình duyệt" tải trong vùng riêng, có khung giữ chỗ; trang
  không phải đợi chúng. Khung trang giờ về trong ~0,03–0,14 giây.
- **Trang duyệt thông tin**: truy vấn "cùng trang" chạy chung lượt với các truy vấn
  trạng thái công khai (bớt một lượt chờ).
- **Phản hồi khi bấm**: thanh tiến trình mảnh ở mép trên cửa sổ (xem mục kế tiếp);
  dòng bảng và dòng danh sách có hiệu ứng nhấn (`active:`).

### Khi deploy

Đặt vùng chạy server của Vercel **cùng vùng với database** (Sydney, `syd1`), vì mỗi
trang cần nhiều lượt gọi database: cùng vùng thì mỗi lượt vài mili giây thay vì nửa
giây. Bản dev trên máy luôn chậm hơn bản production.

### Còn lại

- Các trang dùng Prisma trong giao dịch có `SET LOCAL ROLE` (ví dụ `/sources`,
  `/admin/sources`) cần nhiều lượt đi về trong một giao dịch; từ máy dev mỗi trang
  ~1,7 giây. Sẽ nhanh lên khi chạy cùng vùng; nếu vẫn chậm thì gộp truy vấn.

## Cập nhật 2026-09-30 — Thanh tiến trình ở mép trên thay cho vòng xoay cạnh chữ

Chủ dự án không muốn biểu tượng tải nằm cạnh từng dòng chữ. Thay bằng **một thanh
mảnh chạy dọc mép trên cửa sổ** khi đang chuyển trang, giống Safari
(`components/navigation-progress.tsx`, gắn một lần trong `app/layout.tsx`).

- **Cách biết đang tải**: Next.js không có sự kiện toàn cục "đang chuyển trang", nên
  thanh bắt đầu khi có cú bấm link cùng trang web (lắng nghe ở pha capture, trước khi
  `<Link>` gọi `preventDefault`) hoặc khi gửi form GET (tìm kiếm, lọc); nó ghi lại URL
  lúc bắt đầu. Còn đúng URL đó thì đang tải; URL đổi thì đã đến nơi và thanh mờ đi.
  Trạng thái được suy ra khi render, không `setState` trong effect (quy tắc lint của
  React 19). Quy tắc "cú bấm nào tính là chuyển trang" nằm trong
  `lib/navigation/progress.ts` (có test: bỏ qua mở tab mới, nút giữa, tải file, trang
  web khác, nhảy `#`).
- **Không nhấp nháy**: thanh chỉ bắt đầu chạy sau 150 ms (keyframe `nav-progress`
  trong `globals.css`), nên trang mở nhanh sẽ không thấy thanh; chạy chậm dần tới 85%
  và chỉ chạy hết khi trang đã đến. Tự tắt sau 15 giây nếu có sự cố. Người dùng bật
  "giảm chuyển động" thì thanh đứng yên ở 85%.
- Trang có `loading.tsx` (các trang khám phá) chuyển ngay sang khung chờ, nên thanh kết
  thúc ngay; thanh hữu ích nhất khi đổi tham số trên cùng trang (bấm dòng, tab trong
  `/admin/access`), nơi không có khung chờ.
- Kiểm tra bằng Chrome thật qua DevTools protocol với độ trễ mạng giả lập 1,5 giây:
  giữa lúc tải thanh hiện và đang chạy; tải xong thanh chạy hết rồi mờ đi.
- Cùng lúc: `<html lang="vi">` (trước là `en`), để trình đọc màn hình đọc đúng tiếng
  Việt.

## Cập nhật 2026-10-01 — Đợt 3: các trang công khai bằng tiếng Việt

Tất cả trang người xem gặp đều đã chuyển sang tiếng Việt (5 commit, phần A–E):
thanh điều hướng, chân trang, phân trang, đăng nhập/đăng ký, trang lỗi, tìm kiếm,
trang chủ, quốc gia, trường, chương trình, quy định nhập cư, nghề, thông tin, so sánh,
nguồn và tài liệu.

- **Trang chủ** hỏi "Bạn muốn làm gì?" với 4 thẻ mục tiêu (du học, đi làm, visa và cư
  trú, so sánh), liệt kê 5 quốc gia và 3 nguyên tắc. Vẫn không hiển thị dữ liệu nào
  không có nguồn.
- **Lưới thẻ** (kiểu 5 trong `/dev/preview/patterns`) cho danh sách quốc gia (xếp theo
  tên tiếng Việt) và danh sách trường đại học.
- **Tên quốc gia tiếng Việt** qua `countryName(slug, tênLưu)` trong
  `lib/registry/domain.ts` (Thụy Điển, Đan Mạch, Phần Lan, Na Uy, Hà Lan); database
  vẫn giữ tên tiếng Anh, tên đó hiện nhỏ phía trên trên thẻ quốc gia.
- Nhãn dùng chung đã dịch trong domain module: loại quy định nhập cư
  (`ruleTypes`), nhóm chỉ số so sánh (`metricCategories`), hệ phân loại nghề
  (`classificationSystems`; mã "national" hiện là "Mã quốc gia …"), trạng thái
  nghiên cứu của quốc gia (`countryStatusLabels`), thông báo đăng nhập và lỗi xác thực.
- `countLabel(n, danhTừ)` không còn thêm "s" số nhiều.
- **Không dịch**: tên trường, quy định, nghề, nguồn và trích đoạn — chúng là nội dung
  của nguồn (PROJECT_SPEC.md 21, 2026-09-29).
- `<html lang="vi">`.

Còn lại: trang quản trị Crawler, Trích xuất AI, Chỉ số so sánh, Nhập tài liệu và không
gian cá nhân (đợt 4); User Guide cần cập nhật theo giao diện mới.

## Cập nhật 2026-10-01 — Đợt 4: trang quản trị và khu cá nhân

- **Crawler** (`/admin/crawler`): hai tab *URL theo dõi* và *Lần chạy*, mỗi tab là
  bảng (`DataTable`); bấm dòng mở khung trượt (`Inspector`) để sửa URL (kèm tình
  trạng sẵn sàng và tài liệu mới nhất) hoặc xem các URL của một lần chạy. Nút
  *Đăng ký URL mới*. Lý do "chưa lấy được" viết bằng lời thường; cách chạy
  (`lib/runs.ts`: Theo lịch / Chạy tay / Chạy trên máy).
- **Trích xuất AI** (`/admin/extraction`): tab *Yêu cầu đang mở*, *Lần chạy* và
  *Cài đặt* (chỉ quản trị viên). Khung trượt của một lần chạy liệt kê mọi gợi ý; gợi ý
  bị loại có **giải thích tiếng Việt** (`reasonLabel` trong `lib/extraction/domain.ts`),
  câu gốc tiếng Anh vẫn hiện nhỏ bên dưới để đối chiếu với log.
- **Chỉ số so sánh** (`/admin/metrics`): bảng sắp xếp theo tên hoặc nhóm; sửa/tạo
  trong khung trượt.
- **Nhập tài liệu**: mô tả viết lại bằng lời thường; thông báo quyền dùng tên dễ hiểu.
- **Khu cá nhân**: "My workspace" → **Không gian của tôi**, "My Europe Plan" →
  **Kế hoạch châu Âu**, "Research projects / project" → **Dự án nghiên cứu / dự án**.
  Nhãn nhỏ đầu trang "Workspace" → "Biên tập" (trang biên tập) hoặc "Không gian của
  tôi" (trang cá nhân); tile "Source Registry" → "Quản lý nguồn".

User Guide đã cập nhật lên **v3.0** (2026-10-01): tên nút và menu theo giao diện
tiếng Việt, nút tài khoản và thanh tiến trình (2.1–2.2), khu cá nhân đổi tên (chương 4),
Tổng quan và phân quyền dạng bảng (5.1), Quản lý nguồn chia đôi (5.2), trang duyệt chia
đôi và khung "Các thông tin khác từ cùng trang này" (5.4), crawler / trích xuất AI /
chỉ số dạng bảng (5.8–5.11). Chụp lại hình 1–13, 16–22; thêm hình 21b, 21c; bỏ hình
minh họa crawler cũ vì nó còn bố cục trước đợt 4 (chưa có bản DEMO mới để chụp lại).
Mục lục trong Word cần "Update Field" sau khi mở.

## Bảng điều khiển quản trị (`/admin`, 2026-10-01)

**Làm gì:** một trang chỉ đọc cho người có quyền **Quản lý vai trò** (`roles.manage`), gồm
ba phần: *Tình trạng hệ thống* (crawler, trích xuất AI), *Độ phủ dữ liệu* (bảng theo
quốc gia) và *Hoạt động duyệt* (quyết định trong 7/30 ngày, mục chờ lâu nhất). Lối tắt ở
nhóm Quản trị của trang Tổng quan.

**Vì sao thiết kế như vậy:**
- **Đọc bằng quyền của người xem, không thêm migration.** Mỗi phần dùng client của người
  đang đăng nhập nên RLS quyết định được đếm gì. Không dùng service role, không viết
  hàm `SECURITY DEFINER` mới (AGENTS.md §5). Vai trò Administrator có mọi quyền nên
  thấy đủ; nếu một admin thiếu quyền đọc (ví dụ không có `crawler.manage`), phần đó ghi
  "Cần quyền …" thay vì hiện số 0 sai.
- **Không có điểm số.** Chỉ có số đếm và quy tắc rõ ràng (§11, §15). Quy tắc nằm ở
  `lib/admin/overview.ts` (có test): crawler bị coi là "lâu chưa chạy" khi quá
  `CRAWLER_STALE_DAYS = 8` ngày (lịch chạy hằng tuần); URL "cần xem lại" là URL có kết
  quả gần nhất thuộc `problemOutcomes`; trường, chương trình, quy định, nghề chỉ đếm mục
  đã duyệt.
- **Không im lặng khi thiếu dữ liệu.** Mỗi bảng tải tối đa `ROW_LIMIT = 5000` dòng kèm
  `count: "exact"`. Nếu số dòng nhỏ hơn tổng thật, trang hiện "Chưa đếm đủ" (`complete()`).
  Truy vấn lỗi được ghi log (`logAccessError`) và phần đó hiện "Không tải được" (§13).
  Khi dữ liệu vượt mức này, cần chuyển sang đếm trong SQL (một view hoặc hàm có migration).
- **Mỗi phần nằm trong một `<Suspense>`.** Phần nào chậm (DB ở Sydney) chỉ làm chậm khối
  của nó, phần còn lại vẫn hiện.

**File quan trọng:** `lib/admin/overview.ts` (quy tắc) → `app/(app)/admin/sections.tsx`
(mỗi phần = hàm async tải dữ liệu + View thuần) → `app/(app)/admin/page.tsx` (bố cục,
chặn quyền). Test: `lib/admin/overview.test.ts`, `app/(app)/admin/page.test.tsx` (gọi
thẳng từng hàm async vì `renderToStaticMarkup` không render được component async lồng
trong Suspense).

### Biểu đồ trên `/admin`

- **Không thêm thư viện biểu đồ.** `components/ui/charts.tsx` có `ColumnChart` (cột chồng,
  ví dụ theo ngày) và `BarChart` (thanh ngang chồng), vẽ bằng `div` trên server: không
  thêm JavaScript cho trình duyệt, màu lấy từ token (`bg-positive`, `bg-caution`…) nên tự
  đổi theo dark mode. Lớp màu phải viết nguyên văn (`swatch: "bg-positive"`) để Tailwind
  quét được. Cần biểu đồ tương tác (zoom, tooltip phức tạp) thì mới cân nhắc thư viện.
- **Biểu đồ không phải nơi duy nhất có số.** Mỗi biểu đồ là `role="img"` với câu tóm tắt,
  kèm một bảng ẩn (`sr-only`) cùng số liệu cho trình đọc màn hình; rê chuột lên cột/thanh
  thấy số (`title`). Cột không có trục nên ghi "Cao nhất: N" làm thang đo.
- **Bốn biểu đồ:** URL theo kết quả lần lấy gần nhất (crawler), token AI theo ngày (30 ngày),
  thông tin theo quốc gia (đã duyệt / chờ duyệt / mâu thuẫn), quyết định duyệt theo ngày
  (7/30 ngày). Gom theo ngày bằng `dayKeys` + `perDay` (ngày UTC, ngày trống vẫn hiện là 0;
  dòng không có thời gian hợp lệ bị bỏ qua thay vì làm hỏng trang).
- **Xem không cần đăng nhập:** `/dev/preview?section=admin-overview` (dữ liệu DEMO đi qua
  đúng các hàm trong `lib/admin/overview.ts`).
