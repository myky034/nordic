# Kế hoạch L4 — Thông tin linh hoạt: loại và con số là phần bổ sung, không phải điều kiện

> **Trạng thái:** chủ dự án **đã duyệt** (2026-10-14, "đồng ý tất cả"), Q1–Q5 theo đề xuất ở mục 10.
> **L4a, L4b, L4c đã code** (`docs/learning/slice-l4-flexible-facts.md`). Còn lại: chạy migration,
> ngừng dùng `programme_duration_text` trong `/admin/metrics`.
> Bối cảnh: lần chạy AI thật trên trang chương trình Stockholm University (14/10). Mỗi khi một trang
> viết khác đi, lại phải sửa prompt hoặc tạo loại mới. Chủ dự án hỏi có cách nào linh hoạt hơn.
> Liên quan: kế hoạch L3 (`fact-types-plan.md`), Decision Log 2026-10-13 (L3), 2026-10-14 (L3c, thời lượng).

---

## 1. Chuyện gì đã xảy ra

Ba lần chạy AI trên cùng một trang (chương trình *IT Project Management*, su.se):

| Lần | Prompt | AI đề xuất | Kết quả |
|---|---|---|---|
| 1 | v3 | Thời lượng = **24** tháng, từ câu "takes **two years**" | ❌ Từ chối: số 24 không có trong câu |
| 2 | v3 | (giống lần 1) | ❌ Từ chối |
| 3 | v4 | "two years" (không loại) + yêu cầu bằng cấp (có loại) | ✅ 2 đề xuất, nhưng thời lượng **không lấp được ô "Thời lượng"** |

Để sửa, mình đã phải: đổi prompt hai lần, tạo thêm loại `programme_duration_text`, và sửa định nghĩa
loại cũ. **Mỗi trang mới viết theo một kiểu khác lại phải làm tiếp.** Đó là điều bạn lo, và đúng là
cách này không bền.

## 2. Gốc rễ: ba chỗ "cứng" chồng lên nhau

| # | Chỗ cứng | Ở đâu trong code | Hậu quả |
|---|---|---|---|
| C1 | **Loại số/tiền/ngày bắt buộc có giá trị cấu trúc.** Loại "thời lượng" (số) thì phải có con số | `propose_fact()` và `extractor_propose()`: kiểm tra `CASE value_kind …` | Trang ghi "two years" không vào được loại, phải đẻ loại `_text` |
| C2 | **Phần loại sai thì mất cả thông tin.** Loại không hợp trang, số không có trong câu… → cả ứng viên `invalid` | `extractor_propose()` (L3c) | Nội dung đúng vẫn bị vứt; phải chạy lại AI sau khi sửa prompt |
| C3 | **Người duyệt không gắn hay sửa được loại.** Chỉ có duyệt / từ chối / mâu thuẫn | `review_fact()` | AI quên hoặc gắn sai loại → phải từ chối rồi tạo lại |

Ba chỗ này khiến **chỗ hay thay đổi nhất (cách mỗi trang viết)** phải xử lý bằng **chỗ khó thay
đổi nhất (prompt và danh mục loại)**.

## 3. Ý tưởng chính

> **Bắt buộc:** nguyên văn + câu trích có thật trong trang. Đây là phần chống bịa, giữ nguyên.
> **Bổ sung:** loại thông tin và con số. Có thì tốt; thiếu hay sai thì **bỏ riêng phần đó**,
> thông tin vẫn giữ.

So sánh với một tủ hồ sơ: hiện tại một tờ giấy dán nhãn sai bị **vứt đi**. Sau thay đổi, tờ giấy vẫn
được **cất vào tủ**, nhãn sai được gỡ ra kèm một mẩu ghi chú, và người duyệt **dán lại nhãn đúng**
bằng một lần bấm.

## 4. Thiết kế

### 4.1 Con số thành tùy chọn ở mọi loại (sửa C1)

Một thông tin có loại được phép **không có** giá trị cấu trúc. Nếu có thì phải **đầy đủ và đúng**
như hiện nay.

| Kiểu loại | Hiện tại | Sau thay đổi |
|---|---|---|
| Số tiền | bắt buộc số + tiền tệ + kỳ | **hoặc** đủ cả ba, **hoặc** không có gì |
| Con số | bắt buộc số, trong khoảng hợp lệ | **hoặc** có số (trong khoảng), **hoặc** không |
| Ngày | bắt buộc ngày | **hoặc** có ngày, **hoặc** không |
| Chữ | không có giá trị cấu trúc | (không đổi) |

Giữ nguyên:
- quy tắc D3: **con số (hoặc năm của ngày) phải có trong câu trích** khi có;
- không bao giờ quy đổi đơn vị hay tiền tệ.

Ví dụ trang SU: "two years" → loại **Thời lượng**, không có số. Ô "Thời lượng" trên trang chương
trình hiện *two years*, kèm nguồn. Trang khác ghi "18 months" → cùng loại, có thêm số 18, nên
lọc và so sánh được.

→ Loại `programme_duration_text` **không còn cần**; ngừng dùng nó (xem 4.5).

### 4.2 AI sai phần nào thì bỏ phần đó, có ghi chú (sửa C2)

`extractor_propose()` chia lỗi thành hai nhóm:

**Nhóm 1 — vẫn từ chối cả ứng viên** (chống bịa, không đổi):
- câu trích không có nguyên văn trong trang;
- con số trong *giá trị nguyên văn* không có trong câu trích;
- chủ đề, độ dài, ngày tháng sai dạng;
- quốc gia mâu thuẫn với trang đã gắn;
- trùng, vượt 30 đề xuất.

**Nhóm 2 — giữ thông tin, bỏ phần sai, ghi chú lại** (mới):

| AI làm sai | Xử lý | Ghi chú lưu lại (người duyệt thấy) |
|---|---|---|
| Loại không tồn tại / đã ngừng | bỏ loại và giá trị cấu trúc | "Loại `x` không tồn tại — đã bỏ loại" |
| Loại không hợp trang (vd. loại chương trình trên trang tin tức) | bỏ loại và giá trị cấu trúc | "Loại học phí không hợp trang này — đã bỏ loại" |
| Loại quốc gia nhưng không xác định được quốc gia | bỏ loại | "Cần quốc gia — đã bỏ loại" |
| Giá trị cấu trúc không đúng kiểu (thiếu tiền tệ, ngoài khoảng…) | giữ loại, bỏ giá trị cấu trúc | "Thiếu tiền tệ — đã bỏ số" |
| Số cấu trúc không có trong câu trích (vd. 24 từ "two years") | giữ loại, bỏ số | "AI ghi 24 nhưng câu trích không có — đã bỏ số" |
| Có giá trị cấu trúc nhưng không có loại | bỏ giá trị cấu trúc | "Có số mà không có loại — đã bỏ số" |

Như vậy **không có gì bị giấu** (AGENTS.md §1.3, §9): ghi chú nằm trong `extraction_items` của lần
chạy và hiện trên thẻ duyệt. Ghi chú chỉ biên tập viên thấy, như mọi chi tiết vận hành khác (Decision
Log 2026-10-02). Kết quả của ứng viên vẫn là `proposed`, kèm danh sách điều chỉnh.

### 4.3 Người duyệt gắn hoặc sửa loại (sửa C3)

Hàm mới `set_fact_type()`, chỉ cho người có quyền **Duyệt đề xuất** (`facts.review`):

- Chỉ áp dụng cho thông tin **đang chờ duyệt** (`proposed`). Thông tin đã duyệt thì không sửa tại
  chỗ (xem câu hỏi Q3).
- Chọn loại (hoặc bỏ loại), nhập giá trị cấu trúc nếu muốn.
- Database kiểm tra **y như khi người đề xuất nhập tay** (L3a): loại đang dùng, hợp đối tượng,
  đúng kiểu, trong khoảng, con số có trong câu trích.
- **Không** sửa được: nguyên văn, câu trích, tài liệu, đối tượng gắn. Đó là bằng chứng, giữ nguyên.
- Mỗi lần đổi ghi vào bảng mới **`fact_type_changes`**, chỉ được thêm, không sửa hay xóa (ai, lúc
  nào, loại và giá trị trước/sau, ghi chú).

Vì sao điều này không trái quyết định L3c ("không chọn đối tượng khi duyệt, vì sẽ sửa đề xuất tại
chỗ"): **đối tượng** quyết định thông tin nói về *cái gì*, nên vẫn chỉ đến từ URL hoặc người đề xuất.
**Loại** chỉ là cách *xếp nhãn và đọc số* từ chính câu trích đã có; database kiểm lại, và mọi thay
đổi có lịch sử.

### 4.4 Màn hình duyệt

Thẻ đề xuất trong `/facts/workspace` (hàng chờ duyệt) có thêm:

```
┌──────────────────────────────────────────────────────────┐
│ Chương trình: IT Project Management (Stockholm Univ.)    │
│ Giá trị: two years                                       │
│ Câu trích: "…half-time study pace online programme…      │
│            The programme takes two years to complete."   │
│ ⚠ AI: "AI ghi 24 nhưng câu trích không có — đã bỏ số"    │
│                                                          │
│ Loại thông tin: [Thời lượng            ▼]                │
│ Con số (tùy chọn): [      ]  (chỉ nhập nếu trang ghi số) │
│ [Lưu loại]                                               │
│                                                          │
│ [Duyệt]  [Từ chối]  [Đánh dấu mâu thuẫn]                 │
└──────────────────────────────────────────────────────────┘
```

- Danh sách loại chỉ gồm các loại hợp với đối tượng của thông tin (như form "Thêm thông tin" L3a).
- Ô nhập số hiện theo kiểu của loại (số tiền: số + tiền tệ + kỳ…), dùng lại component của L3a.

### 4.5 Prompt AI gọn lại (`extract-v5`)

Bỏ các quy tắc vá theo từng trường hợp của v4. Chỉ còn:
- trích đúng nguyên văn; mọi con số trong giá trị phải có trong câu trích;
- rà từng loại trong danh sách; **gắn loại khi chắc**, không chắc thì để trống;
- chỉ điền giá trị cấu trúc khi câu trích ghi số bằng chữ số; **không bao giờ quy đổi**.

Từ nay, trang viết kiểu lạ **không làm mất thông tin nữa**, nên không cần sửa prompt mỗi lần gặp
trường hợp mới.

### 4.6 Dọn dẹp

- Ngừng dùng `programme_duration_text`: bỏ tick "Đang dùng" trong `/admin/metrics`. Loại này chưa có
  thông tin nào gắn vào.
- Giữ `slotAlsoFilledBy` trong code. Nó vô hại, và cần nếu sau này có loại tương tự.
- Sửa lại định nghĩa tiếng Anh của `programme_duration`: "length of the programme; the number of
  months only when the page states months in digits".

## 5. Trước và sau

```
TRƯỚC:  trang lạ ─► AI gắn loại/số sai ─► cả ứng viên bị từ chối ─► sửa prompt / tạo loại ─► chạy lại
SAU:    trang lạ ─► AI gắn loại/số sai ─► phần sai bị bỏ, ghi chú ─► vào hàng chờ ─► người duyệt chọn loại ─► duyệt
```

**Khi nào vẫn cần tạo loại mới?** Chỉ khi có **một kiểu thông tin thật sự mới** mà người xem cần
thấy thành một ô riêng, ví dụ "học bổng", "phí nộp hồ sơ". Không bao giờ vì một trang viết khác đi.

## 6. Điều KHÔNG thay đổi

- Câu trích phải có nguyên văn trong trang; con số phải có trong câu trích (D3).
- Không quy đổi đơn vị hay tiền tệ; không bịa con số.
- Mọi thông tin vẫn ẩn cho tới khi người duyệt đồng ý.
- AI không chọn đối tượng; đối tượng vẫn đến từ URL trang (L3c) hoặc người đề xuất.
- RLS, quyền, audit: chỉ thêm, không nới.

## 7. Bảo mật và toàn vẹn

- `set_fact_type()` là `SECURITY DEFINER`, kiểm `facts.review`, khóa thông tin đang sửa (như
  `review_fact`). Không mở ghi trực tiếp vào bảng.
- `fact_type_changes`: không ai sửa hay xóa được qua API; công khai đọc **không** được (chi tiết vận
  hành).
- Ràng buộc database mới: "thông tin có loại thì giá trị cấu trúc hoặc đủ, hoặc không có". Đây là
  bản nới của luật hiện tại, áp ở cả ba đường vào (nhập tay, AI, người duyệt).

## 8. Kiểm thử (PGlite + Vitest)

1. Thông tin có loại số **không có số** được nhận; có số thì vẫn phải có trong câu trích.
2. Số tiền chỉ có số mà thiếu tiền tệ → từ chối khi nhập tay (thiếu nửa chừng vẫn là lỗi).
3. AI, từng dòng của bảng 4.2: thông tin được giữ, đúng phần bị bỏ, đúng ghi chú.
4. AI, nhóm 1: vẫn `invalid` như cũ (không nới chống bịa).
5. `set_fact_type()`: người duyệt gắn được; người chỉ có quyền đề xuất bị từ chối; thông tin đã duyệt
   bị từ chối; loại không hợp đối tượng bị từ chối; mỗi lần đổi có đúng một dòng lịch sử.
6. `fact_type_changes` không sửa hay xóa được; khách không đọc được.
7. Trang chương trình: thông tin "Thời lượng" không có số vẫn lấp ô "Thời lượng".
8. Extractor: prompt v5 (nội dung), `parseCandidates`, `precheck` khớp nhóm 1 / nhóm 2.

## 9. Chia phần và ước lượng

| Phần | Nội dung | Ước lượng |
|---|---|---|
| **L4a** | Migration: nới ràng buộc (4.1), `extractor_propose` nhóm 1/2 (4.2), `set_fact_type` + `fact_type_changes` (4.3); test database | ~1 buổi |
| **L4b** | Màn duyệt: ghi chú AI, chọn loại + số (4.4); nhãn tiếng Việt cho ghi chú; test giao diện | ~½–1 buổi |
| **L4c** | Prompt `extract-v5` (4.5), test extractor; tài liệu học; dọn dẹp (4.6) | ~½ buổi |

Thứ tự: L4a → L4b → L4c. Mỗi phần chạy được và có test trước khi sang phần sau.

Bạn chạy migration sau L4a, như thường lệ. Thông tin đang chờ không cần chạy lại: đề xuất
"two years" của SU sẽ được gắn loại "Thời lượng" ngay ở màn duyệt sau L4b.

## 10. Câu hỏi cần bạn quyết

| # | Câu hỏi | Đề xuất của mình |
|---|---|---|
| Q1 | Đồng ý cho giá trị cấu trúc thành **tùy chọn** ở mọi loại (4.1)? | **Có** |
| Q2 | AI sai loại hoặc số thì **giữ thông tin, bỏ phần sai, ghi chú** (4.2), thay quy tắc L3c "ghi invalid"? | **Có** |
| Q3 | Người duyệt gắn/sửa loại: chỉ thông tin **đang chờ**, hay cả thông tin **đã duyệt** (vd. 36 thông tin cũ chưa có loại)? | **Chỉ đang chờ** trước. Thông tin đã duyệt đổi qua "gỡ / thay thế" (tính năng 6 trong Decision Log), để trang công khai không đổi lặng lẽ |
| Q4 | Ngừng dùng `programme_duration_text` sau L4c? | **Có** |
| Q5 | Hai đề xuất SU đang chờ: đợi L4b rồi mới duyệt thông tin thời lượng? | **Có.** Thông tin "yêu cầu bằng cấp" thì duyệt luôn được |

Bạn trả lời "đồng ý tất cả" nếu theo đề xuất, hoặc nêu câu nào muốn khác. Sau đó mình ghi vào
Decision Log và bắt đầu L4a.
