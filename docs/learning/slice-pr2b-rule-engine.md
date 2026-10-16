# PR 2b: Rule engine cấu hình được (2026-10-16)

> Kiến trúc: `docs/architecture/l7b-pr2-architecture-review.md` (§5.4–§5.8, §6.2). Dựa trên PR 2a (#5).
> Nhánh: `extraction/pr-2b-rule-engine`. Không có migration, không đổi database, worker chưa dùng tới.

## Đã làm gì

| File | Vai trò |
|---|---|
| `extractor/src/rules/match.ts` | Loại trang theo cấu hình site, khớp phạm vi, độ cụ thể, `overrides` |
| `extractor/src/rules/strategies.ts` | 5 chiến lược trên snapshot: `pair`, `section_lines`, `sentence`, `table`, `json_ld`; `elementString()` |
| `extractor/src/rules/intake.ts` | Kỳ từ heading (chỉ chữ nguồn ghi) |
| `extractor/src/rules/engine.ts` | `runRules()`: chạy luật → `RuleOutput[]` (hợp đồng PR 2a) |
| `extractor/src/rules/sites/su.ts`, `sites/kth.ts` | Luật SU (5) và KTH (5), đều ở chế độ shadow |
| `extractor/src/rules/registry.ts` | `RULES`, `PAGE_TYPES`, `VERSIONS` (dấu vân tay) |
| `extractor/src/rules/fact-types.ts` | Thêm `INTAKE_SCOPE` (D2) |
| `extractor/src/rules/config.ts` | Chặn luật gán kỳ cho loại fact không thuộc kỳ; heading của kỳ phải có mùa hoặc tháng |
| `extractor/scripts/rules-check.ts` + `extractor/test/real/rules-expectations.json` | Nghiệm thu trên 4 trang thật lưu cục bộ |
| `crawler/test/fixtures/programme-intake.html`, `programme-deadlines.html` | Fixture tổng hợp kiểu SU / KTH (+ JSON sinh bởi crawler) |

## Vì sao thiết kế như vậy

- **Chạy trên snapshot, không chạy trên HTML.** Repo không lưu HTML (AGENTS.md §8). Mỗi kết quả trỏ tới đúng
  **một** phần tử và **một** chuỗi của nó, và đoạn trích nằm trong chuỗi đó. Engine tự kiểm điều này; sai
  thì báo lỗi lập trình.
- **Kỳ chỉ đến từ chữ nguồn ghi.** Mẫu regex của heading kỳ phải neo cả đầu lẫn cuối, nên "Changes to the
  selection process for autumn 2027" trên trang 2026 không khớp mẫu `^Autumn (?<year>…)`. Kỳ cũng không bao
  giờ lấy từ URL hay từ một ngày.
- **Phạm vi áp dụng (Risk C).**
  - Chỉ loại fact **thuộc kỳ** theo D2 (hạn nộp, kỳ nộp) mới được lấy kỳ.
  - Học phí, ngôn ngữ, tín chỉ nằm **dưới** heading kỳ của SU nhưng vẫn ra `intake = null`,
    `applicability = null`.
  - `validateRules()` chặn ngay từ cấu hình: luật học phí không thể khai `intake: page`.
- **Không chọn hộ khi có mâu thuẫn.**
  - Theo từng loại fact: luật cụ thể nhất có kết quả thắng; luật kém cụ thể hơn chỉ là dự phòng.
  - Cùng mức: priority cao thắng.
  - Cùng priority mà hai câu khác nhau → `ambiguous`, không đưa ra ứng viên nào.
  - Một câu có nhiều số (học phí đợt 1 + toàn khóa) là **một** câu, nên không coi là mâu thuẫn. Cùng một câu lặp
    ở phần tử khác là trùng, chỉ giữ một.
- **Thiếu thì báo.**
  - `not_found` khi loại fact không có kết quả nào.
  - `intake_unresolved` khi cần kỳ nhưng không xác định được; chữ về kỳ được giữ trong `intakeText`.
  - `normalize_failed` khi normalizer không đọc được, ví dụ JSON-LD `P2Y` không được quy đổi.
- **Tất định.** Luật được sắp theo id (so mã ký tự), và đầu ra có thứ tự cố định. Test đảo thứ tự registry vẫn ra
  kết quả giống hệt.

## Luồng

```
runRules(input, RULES, PAGE_TYPES)
  pageContext(url) → nguồn + loại trang (không có kỳ)
  applicableRules → bật, đúng phạm vi, trừ luật bị override
  mỗi luật: findHits(snapshot) → kiểm đoạn trích → kỳ (heading / page / none) → normalize
  resolve: mức cụ thể nhất theo loại fact → priority → mâu thuẫn = ambiguous
  → RuleCandidate[] + RuleIssue[] (không ghi gì vào database)
```

## Khái niệm TypeScript

- **Discriminated union** `RuleOutput = RuleCandidate | RuleIssue`: lọc bằng type guard
  `(o): o is RuleCandidate => o.kind === "candidate"`.
- **`as const` trên object gốc của luật**: `mode: "shadow"` giữ kiểu literal, không bị nới thành `string`.
- **Named capture group** `(?<year>\d{4})`: cấu hình luật nói rõ phần nào là năm, mùa, tháng hay giá trị.

## Bảo mật và toàn vẹn dữ liệu

- Không đụng database, không có mạng, không chạy mã do người dùng nhập; luật là dữ liệu TypeScript được review qua PR.
- Mọi kết quả vẫn chỉ là **đề xuất** (PR 3 cho qua `extractor_propose()` và duyệt của người); engine không đặt
  trạng thái nào.

## Lỗi hay gặp

- Mẫu heading không neo `^…$` sẽ khớp cả câu nhắc tới một kỳ khác. `validateRules()` bắt buộc phải neo.
- Gán kỳ cho học phí chỉ vì nó nằm trên trang của kỳ đó (Risk C).
- Coi hai số tiền trong cùng một câu là mâu thuẫn.

## Cách test

```bash
npm test -w @nordic/extractor                  # engine.test.ts + các test PR 2a
npm run rules:check -w @nordic/extractor       # trang thật, cần snapshot cục bộ (thiếu = FAIL)
npm run structure-fixtures -w @nordic/crawler  # sinh lại JSON fixture khi sửa HTML tổng hợp
```

## Hạn chế đã biết

- JSON-LD không có `ref` phần tử trong `html-structure-v1`; engine dùng `sd<adapter>.<item>`. PR 3 phải kiểm
  bằng chứng JSON-LD theo chỉ số item.
- Kỳ theo trang (`from: "page"`) cần bản ghi L7b. Hiện engine chỉ nhận qua tham số `pageIntake`.
- Chưa có luật cho `application_status`, ngày bắt đầu / kết thúc kỳ, nhịp học, vì các loại fact này chưa tồn
  tại (D8).
- Mâu thuẫn được xét theo **loại fact + kỳ**; giữa nhiều tài liệu là việc của PR 4.

## Thứ tự đọc code

1. `sites/su.ts`, `sites/kth.ts` (luật trông ra sao)
2. `match.ts` → `strategies.ts` → `intake.ts`
3. `engine.ts` (`runRules`, `resolve`)
4. `engine.test.ts`, rồi `scripts/rules-check.ts`
