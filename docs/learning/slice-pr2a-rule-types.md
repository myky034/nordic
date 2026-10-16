# PR 2a: Kiểu luật và các hàm chuẩn hóa xác định (2026-10-16)

> Kiến trúc: `docs/architecture/l7b-pr2-architecture-review.md` (§5.2, §5.3, §5.5, §6.2).
> Nhánh: `extraction/pr-2a-rule-types`. Không có migration, không đổi database, worker chưa dùng tới.

## Đã làm gì

- `packages/db/src/rule-output.ts`: hợp đồng dùng chung (`IntakeRef`, `EvidenceRef`, `RuleCandidate`,
  `RuleIssue`, `RuleOutput`, `NormalizedValue`, `VALUE_PERIODS`). Export `@nordic/db/rule-output`.
- `extractor/src/rules/types.ts`: một luật gồm những gì (phạm vi, chiến lược, normalizer, nguồn của kỳ,
  phần tử làm bằng chứng, phiên bản, chế độ shadow/propose).
- `extractor/src/rules/config.ts`: `validateRules()` kiểm mọi luật và trả **tất cả** lỗi.
- `extractor/src/rules/fingerprint.ts`: dấu vân tay của định nghĩa luật, `checkVersions()`, `rulesetVersion()`.
- `extractor/src/rules/registry.ts`: danh sách luật (trống tới PR 2b) + bảng phiên bản.
- `extractor/src/rules/fact-types.ts`: các loại fact luật được nhắm tới, kèm kiểu giá trị.
- `extractor/src/rules/normalizers/`: `duration`, `credits`, `money`, `date`, `pace` + `normalize()` điều phối.

## Vì sao thiết kế như vậy

- **Ba kết quả tách bạch.** Mỗi normalizer trả về một trong ba:
  - `ok`: database lưu được ngay;
  - `unresolved`: hiểu được nhưng nguồn thiếu một phần, ví dụ ngày không có năm, hay số tiền không rõ kỳ;
  - `failure`: không đọc được, hoặc đọc sẽ không an toàn, ví dụ nhiều giá trị khác nhau, hay tên bằng cấp.

  Có ba trạng thái là để "không có thông tin" không bao giờ trông giống "0" hay "miễn phí".
- **Theo đúng ràng buộc database.** Tiền chỉ `ok` khi có đủ số, mã tiền tệ 3 chữ hoa và kỳ
  (`facts_money_complete`). "First instalment: 67500 SEK" không nói kỳ, nên là `unresolved`.
- **Không suy luận (D6, D7):**
  - "15 January" giữ nguyên chữ, không tự thêm năm;
  - "One Year Master’s" là tên chương trình, không phải thời lượng;
  - "31/08/2026 - 04/06/2028" là lịch học, không phải thời lượng;
  - học kỳ, `hp` và chữ "half-time" không được quy đổi.
- **Không lấy kỳ từ URL.** `IntakeRef.from` chỉ có `heading` hoặc `page`; kiểu dữ liệu và
  `validateRules()` đều chặn lựa chọn `url`.
- **Luật không đặt phạm vi áp dụng.** `Rule` không có trường "applicability"; engine (PR 2b) chỉ đặt
  trường này khi bằng chứng nói rõ (Risk C).
- **Luật là dữ liệu có kiểu trong repo (D11).** Không có bảng luật hay trình sửa luật, và không có mã do người
  dùng nhập. Regex có cờ `g`/`y` bị cấm, vì `lastIndex` làm kết quả phụ thuộc vào lần gọi trước.

## Sửa sau review PR #5 (2026-10-16)

| # | Lỗi | Cách sửa |
|---|---|---|
| M1 | "Year 1 135 000 SEK" bị đọc thành 1 135 000 | Nếu số dùng khoảng trắng phân nhóm, phần còn lại sau nhóm đầu vẫn là một số tiền hợp lý, và ngay trước nó là một từ hoặc một số → `unresolved` (`amount_boundary_ambiguous`). Ký hiệu tiền đứng trước, đầu câu, hay dấu câu ("Fee: 1 135 000") thì ranh giới rõ |
| M2 | "2–3 years" bị đọc thành 36 tháng | Khoảng (`-`, `–`, `—`, "to", "between … and …") → `unresolved` (`range`), giữ nguyên biểu thức. "1 year or 2 years" là các lựa chọn, vẫn là `several_values` |
| M3 | Dấu vân tay tính cả `mode`, `enabled` | Bỏ hai trường đó: chuyển shadow → propose giữ nguyên id + version (D12 S6). Mọi trường ảnh hưởng tới cách trích vẫn nằm trong dấu vân tay |
| M4 | `localeCompare` phụ thuộc ngôn ngữ của máy | `compareCodeUnits` (so theo mã UTF-16) |

**Hợp đồng:**
- `EvidenceRef` là union: `cell` chỉ hợp lệ khi `field = "cell"`, và bắt buộc khi đó.
- `IntakeRef` phải có mùa hoặc tháng. `from: "page"` mang id bản ghi L7b (`programmePageId`, `intakeId`) thay
  vì bằng chứng trong snapshot, vì bằng chứng của kỳ nằm ở bản ghi kỳ.
- Chữ về kỳ không giải được thì báo `RuleIssue` `intake_unresolved` kèm `intakeText`.
- Thêm `evidenceRefProblems()` và `intakeRefProblems()` để kiểm dữ liệu dựng từ JSON.

## Luồng (khi PR 2b, PR 3 nối vào)

```
snapshot cấu trúc → luật (types.ts, đã qua validateRules) → chiến lược tìm đoạn chữ (PR 2b)
  → normalize(spec, text) → RuleCandidate / RuleIssue (rule-output.ts)
  → PR 3: extractor_propose() kiểm lại trong database → fact "proposed" → con người duyệt
```

## Khái niệm TypeScript

- **Union phân biệt** (`{ status: "ok"; value } | { status: "unresolved"; reason }`): TypeScript buộc
  phải kiểm `status` trước khi đọc `value`.
- **`as const` + `(typeof X)[number]`**: một danh sách duy nhất sinh ra cả giá trị lúc chạy lẫn kiểu.
- **`@ts-expect-error` trong test**: chứng minh kiểu chặn được `IntakeRef["from"] = "url"`; nếu kiểu lỏng
  ra thì test biên dịch lỗi.

## Bảo mật và toàn vẹn dữ liệu

- Không đụng database, không thêm phụ thuộc. Worker (`run.ts`) không gọi tới.
- Database vẫn là nơi quyết định cuối cùng: PR 3 cho kết quả luật đi qua `extractor_propose()` như AI.
- `fact-types.ts` là bản sao để kiểm sớm; PR 3 sẽ so nó với database lúc chạy.

## Lỗi hay gặp

- **Gán chữ của câu sau cho số tiền trước.** "First instalment: 67500 SEK. The complete course: 135000 SEK".
  Nếu phạm vi câu kéo tới số tiền kế tiếp, khoản đầu sẽ nhận nhầm "total". Phạm vi phải dừng ở **ranh giới
  câu**; test đã bắt được lỗi này khi viết.
- **Dấu phân cách hàng nghìn bằng khoảng trắng** ("135 000") có thể dính với một số đứng trước nó (M1).
- **Coi khoảng là một giá trị** ("2–3 years" → 36 tháng): phải nhận ra khoảng trước (M2).
- **Đưa trạng thái triển khai vào dấu vân tay** (M3), hay **sắp xếp theo ngôn ngữ của máy** (M4).

## Cách test

```bash
npm test -w @nordic/extractor        # gồm src/rules: normalizers.test.ts, config.test.ts
npm run typecheck -w @nordic/extractor
```

## Hạn chế đã biết

- Ranh giới số tiền (M1) được xử lý thận trọng: "Tuition 1 500 SEK" cũng thành `unresolved`, vì không
  phân biệt được với "Year 1 500 SEK" nếu không hiểu ngôn ngữ. An toàn nhưng có thể bỏ sót.
- Tên tháng: chỉ tiếng Anh và tiếng Thụy Điển.
- `fact-types.ts` phải được cập nhật tay khi thêm loại fact (D8); PR 3 sẽ kiểm tự động.

## Thứ tự đọc code

1. `packages/db/src/rule-output.ts`
2. `extractor/src/rules/types.ts`, `fact-types.ts`
3. `extractor/src/rules/normalizers/result.ts`, rồi từng normalizer + `normalizers.test.ts`
4. `extractor/src/rules/config.ts`, `fingerprint.ts`, `registry.ts` + `config.test.ts`
