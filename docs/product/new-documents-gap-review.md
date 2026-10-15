# Đối chiếu bộ tài liệu "Study Abroad" (New_documents) với code hiện tại

> Ngày: 2026-10-14 · Commit đối chiếu: `4e4bd47` (main)
> Tài liệu nguồn: `documents/New_documents/*.docx` (13 file, đều ghi ngày 14/10/2026).
> Cách làm: đọc toàn bộ 13 tài liệu; đối chiếu bằng cách đọc migration, route, thư viện `lib/` và
> test trong repo. **Chưa** chạy kiểm thử E2E, accessibility hay usability; trạng thái dưới đây là
> theo code, không phải theo trải nghiệm người dùng.
>
> Mục 4 điền đúng bảng "Development Gap Review" mà tài liệu *Delivery Planning v1.1* (mục 7–9) yêu
> cầu, với trạng thái Done / Partial / Missing / Rework / N/A và hành động Keep / Enhance / Refactor /
> Build / Drop.

---

## 1. Tóm tắt

1. **Hai bộ tài liệu mô tả hai sản phẩm khác nhau.**
   - Bộ mới ("Study Abroad") là **công cụ lập kế hoạch du học cho người Việt**: tìm chương trình,
     so sánh 2 lựa chọn, tính ngân sách có tỷ giá, checklist, báo lỗi dữ liệu, CMS có duyệt.
   - Code hiện tại ("Nordic", theo `PROJECT_SPEC.md` + `AGENTS.md`) là **cổng tra cứu có bằng chứng**
     về học tập, nghề nghiệp, nhập cư ở châu Âu: nguồn → tài liệu → đề xuất → bằng chứng → duyệt.
   - Phần chung khá lớn: tra cứu chương trình, trang chi tiết có nguồn/ngày, duyệt trước khi công
     khai, dữ liệu riêng tư theo chủ sở hữu, không bịa dữ liệu.
2. **Phần đã có và tốt hơn yêu cầu:** nguồn và bằng chứng, phân quyền ở database (RLS + RPC),
   audit, crawler, AI trích xuất có kiểm soát, đa ngôn ngữ Việt/Anh.
3. **Phần thiếu hẳn:** công cụ tính ngân sách + tỷ giá (FR-04, US-008/009), checklist kế hoạch
   (FR-05, US-012), báo lỗi dữ liệu (FR-06, US-016), so sánh 2 *chương trình* (FR-03, US-007).
4. **Xung đột phải quyết trước khi làm tiếp** (mục 3): danh sách 5 nước, quy trình duyệt nhiều
   bước, tách người tạo/người duyệt, phạm vi việc làm/nhập cư, đề xuất spike NestJS, phong cách giao
   diện.
5. Trạng thái các tài liệu: PRD và ACL ghi "DRAFT / FOR REVIEW", nhưng IA, User Flows, Wireframe và
   Decision Log lại ghi "đã được PO xác nhận". **Cần bạn xác nhận bộ nào là chuẩn** trước khi chuyển
   thành task.

---

## 2. Tài liệu đã đọc

| # | Tài liệu | Trạng thái ghi trong file | Nội dung chính |
|---|---|---|---|
| 1 | Product Discovery v0.1 | Discovery, chưa duyệt | Tầm nhìn, 3 nhóm proto-persona, JTBD, kế hoạch nghiên cứu |
| 2 | User Research Findings v0.1 | Nghiên cứu nguồn công khai | 8 phát hiện từ Reddit r/vozforums; nhu cầu chưa xếp hạng |
| 3 | Problem & Opportunity v1.0 | Discovery | Nguồn S01–S08, cơ hội O01–O06, problem statements |
| 4 | Product Scope & MVP v1.0 | Proposed | MoSCoW F01–F12, BR01–BR07, release gates |
| 5 | PRD v0.1 | Draft / for review | FR-01…FR-08, NFR-01…06, entity gợi ý |
| 6 | Authorization & Access Control v0.1 | Draft / for review | 6 vai trò, ma trận quyền, ACL-01…12, SEC-01…14 |
| 7 | Information Architecture v1.0 | "PO đã xác nhận" | Sitemap `/explore`, `/programs/:slug`, `/budget`, `/plan`, `/report`, `/cms/*` |
| 8 | User Flows v1.0 | "PO đã xác nhận" | UF-01…UF-08, trạng thái UX |
| 9 | Wireframe & UX Spec v1.0 | Low-fi | WF-01…WF-09 |
| 10 | UI Design System v1.0 | Baseline hi-fi | Liquid Glass / Iridescent, token màu, typography |
| 11 | High-Fidelity UI v1.0 | Review draft | 6 màn hình mẫu (Home, Explore, Budget × desktop/mobile) |
| 12 | Decision Log & UI Readiness v1.0 | "Approved" | DEC-001…005 |
| 13 | Delivery Planning v1.1 & Gap Review | Proposed | US-001…019, Sprint 0, ADR-001, bảng gap trống |

---

## 3. Xung đột cần quyết định (ưu tiên đọc mục này)

| # | Tài liệu mới nói | Code / quy tắc hiện tại | Hệ quả | Đề xuất |
|---|---|---|---|---|
| X1 | **DEC-001:** MVP gồm Sweden, Netherlands, Finland, **France, Germany** | Seed 5 nước: Sweden, **Denmark**, Finland, **Norway**, Netherlands (`20260917090000_countries_sources`) | Thêm 2 nước, bỏ hoặc ẩn 2 nước; cần nguồn chính thức mới cho Pháp, Đức | Quyết định rõ danh sách. Thêm nước là migration nhỏ, **nhưng** không có dữ liệu cho tới khi đăng ký và xác minh nguồn (AGENTS §1, §22) |
| X2 | **Phạm vi:** chỉ du học. "Dự báo việc làm" là Won't; IA không có mục việc làm hay nhập cư | Có module Nhập cư (`/immigration`) và Thị trường lao động (`/occupations`, EURES), là 2/4 chủ đề của trang chủ | Nếu theo tài liệu mới, các phần này thành ngoài phạm vi | **Giữ** nhập cư (tài liệu mới vẫn cần visa và tiền chứng minh tài chính trong ngân sách). Với việc làm, cần bạn quyết: giữ dạng tham khảo, hay ẩn khỏi menu |
| X3 | **Quy trình nội dung:** DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED, có revision | `proposed` → `reviewed` / `rejected` / `conflicted`; không có bước gửi duyệt riêng, không có lưu trữ (archive) hay gỡ công bố cho thông tin đã duyệt | Phải viết lại toàn bộ luồng duyệt nếu theo đúng tài liệu | Giữ mô hình hiện tại (nó chính là "duyệt rồi mới công khai"). Chỉ **thêm** "gỡ công bố có lý do" và "thay bằng bản mới" cho thông tin đã duyệt; việc này hợp AGENTS §4.3 (giữ lịch sử) |
| X4 | **Tách người tạo / người duyệt** (ACL-04, SEC-05): không được tự duyệt | Người có cả `facts.propose` và `facts.review` có thể duyệt đề xuất của chính mình. Riêng tài khoản AI **bắt buộc** không có quyền duyệt | Dự án chỉ có 1 người: chặn tự duyệt thì bạn không duyệt được gì | Ghi vào Decision Log là "ngoại lệ có chủ ý khi chỉ có 1 người duyệt". Bật chặn bằng một cờ cấu hình khi có người thứ hai |
| X5 | **Vai trò cố định:** Guest / User / Editor / Reviewer / Admin / Super Admin | RBAC tùy biến: bảng `roles` + `role_permissions` (`has_permission`), admin tự tạo vai trò | Mô hình hiện tại linh hoạt hơn và bao trùm mô hình kia | Giữ. Tạo sẵn các vai trò mẫu Editor và Reviewer nếu cần. Chưa có Super Admin, xác thực lại (re-auth) hay MFA (ACL-07, AUTH-05) |
| X6 | **Sprint 0 / ADR-001:** spike Next.js vs **Next.js + NestJS**, "stack chưa chốt" | Stack đã chốt và đang chạy: Next.js 16 + Supabase + Prisma + Vercel (AGENTS §3 cấm thay) | Spike không cần thiết | **Drop** T-002…T-004. ADR-001 coi như đã quyết phương án A |
| X7 | **Giao diện:** Liquid Glass + Iridescent, token `#F8FAFC` / `#2459A6`… | Hướng Apple tối giản, nền `#f5f5f7`, chữ `#1d1d1f` (`app/globals.css`, `docs/learning/ui-design-system.md`) | Gần nhau về tinh thần; khác ở hiệu ứng kính và mã màu | Có thể thêm hiệu ứng kính cho header và hero. Không cần làm lại; quyết khi bước vào giai đoạn hi-fi |
| X8 | **URL:** `/explore`, `/programs/:slug`, `/cms/*` | `/search`, `/programmes/[id]`, `/admin/*` và các trang `*/workspace` | Chỉ là đặt tên | Giữ URL hiện tại; không đáng sửa |
| X9 | **Ngôn ngữ:** tiếng Việt cho MVP | Việt + Anh (i18n đủ 4 đợt) | Không mâu thuẫn, có thừa | Giữ |
| X10 | **Lưu kế hoạch:** guest tính được, **phải đăng nhập mới lưu** (DEC-002) | Workspace (dự án, đánh dấu, ghi chú, "Kế hoạch của tôi") đã yêu cầu đăng nhập và chỉ chủ sở hữu đọc được | Khớp | Keep |
| X11 | **Tỷ giá:** cập nhật hằng ngày, quy đổi sang VND (DEC-003) | Không có. Quy tắc hiện tại: không quy đổi tiền tệ (L3, AGENTS §1) | Cần **nguồn tỷ giá chính thức đã đăng ký** và ngày tham chiếu | Chỉ làm sau khi chọn được nguồn cụ thể. Mình không tự chọn hay đoán URL (AGENTS §1.2) |
| X12 | Nghiên cứu người dùng dùng bài Reddit, kèm khảo sát IDP/ICEF | Không ảnh hưởng code | Các URL Reddit mới ghi "cần rà soát lại trước khi trích dẫn công khai" | Không đưa các URL này vào dữ liệu nguồn của sản phẩm |

---

## 4. Development Gap Review (điền bảng mục 7 của Delivery Planning)

### 4.1 Theo nhóm audit

| Nhóm | Bằng chứng trong code | Trạng thái | Gap / hành động |
|---|---|---|---|
| Architecture | Monorepo npm workspaces: `apps/web` (Next.js 16), `packages/db` (Prisma 7), `crawler`, `extractor`; Vercel; GitHub Actions `crawler.yml`, `extractor.yml` | **Done** | Keep. Bỏ spike |
| Database | 20 migration (`packages/db/prisma/migrations`), test PGlite chạy trên DB sạch | **Done** | Keep. Thêm bảng cho ngân sách, checklist và báo lỗi khi làm các phần đó |
| Discovery | `/countries`, `/programmes` (lọc theo nước, bậc, trường), `/universities`, `/search`, trang chi tiết có nguồn và ngày | **Partial** | Thiếu lọc theo **ngành** (taxonomy 11c, KHLOE-111…113) và **khoảng học phí** (cần dữ liệu học phí có loại) |
| Comparison | `/compare`: so sánh **quốc gia** theo loại thông tin `comparable`, tự ẩn khi chưa đủ dữ liệu | **Rework** | Tài liệu cần so sánh **2 chương trình**. Đây là trang mới; giữ nguyên trang so sánh quốc gia |
| Budget | `user_plans.budget_amount/currency/period`: chỉ ghi một con số, không tính toán | **Missing** | Build: công cụ khoản mục + dự phòng + chênh lệch; tỷ giá sau (X11) |
| Auth / Private | Supabase Auth (email + mật khẩu), `proxy.ts`, RLS chủ sở hữu, `delete_my_workspace()`, test "kể cả admin cũng không đọc được" | **Done** (MVP) | Thiếu re-auth và MFA cho admin, Super Admin (X5) |
| Study plans | `research_projects`, `saved_items`, `notes`, `user_plans` (`/workspace`, `/workspace/plan`) | **Partial** | Chưa có **checklist đầu việc** (tên, hạn, trạng thái, thứ tự) |
| CMS | Các trang workspace cho facts, education, immigration, labour; `/admin/*`; `review_fact` có khóa chống ghi đè; `fact_reviews`, `access_audit` | **Partial** | Thiếu: gỡ công bố hoặc lưu trữ, bản thay thế, chặn tự duyệt (X3, X4) |
| Quality | 425 test web + 15 test extractor; tsc, eslint và build chạy tay; Vercel build khi push | **Partial** | **Chưa có CI chạy test** trên GitHub. Chưa kiểm accessibility (WCAG 2.2 AA) hay test E2E |
| Release | Vercel deploy; DB dùng chung cho dev và prod | **Missing** | Tách DB prod (KHLOE-119, Urgent); backup và rollback; giám sát |

### 4.2 Theo user story US-001…019

| Story | Hiện có (file / route) | Trạng thái | Thiếu so với AC | Hành động |
|---|---|---|---|---|
| US-001 Repo, CI, staging | Monorepo, Vercel, `.env.example`, `.gitignore` | Partial | CI test/lint; staging tách khỏi prod | Enhance: thêm workflow test |
| US-002 Schema & migration | 20 migration, test PGlite | Done | Không | Keep |
| US-003 Authorization foundation | `lib/rbac`, `has_permission`, RLS, `/admin/access` | Done | Không (với MVP) | Keep |
| US-004 Duyệt 5 quốc gia | `/countries`, `/countries/[slug]`, nhãn mức độ có dữ liệu | Partial | Sai danh sách nước (X1) | Quyết X1, rồi migration |
| US-005 Tìm kiếm/lọc programs | `/programmes` + `/search` (full-text), empty state | Partial | Lọc ngành, lọc học phí | Build (11c + loại học phí) |
| US-006 Program detail & sources | `/programmes/[id]`: nút trang chính thức, checklist "Thông tin chính", `FactValue` + nguồn + ngày (L3b) | Done | Không | Keep |
| US-007 Compare 2 programs | Không | Missing | Toàn bộ | Build (trang mới, dùng `fact_types` có sẵn) |
| US-008 Budget calculation | Không | Missing | Toàn bộ | Build (logic thuần + test, không cần DB cho guest) |
| US-009 FX & assumptions | Không | Missing | Nguồn tỷ giá | Chặn bởi X11 |
| US-010 Save budget scenario | Chỉ một con số trong `user_plans` | Partial | Lưu nhiều kịch bản, các khoản mục | Build (bảng mới, RLS chủ sở hữu) |
| US-011 Authentication/session | Supabase Auth, `/login`, `/signup`, `auth/callback` | Done | Không | Keep |
| US-012 Study plan & checklist | Workspace dự án + kế hoạch | Partial | Đầu việc có hạn và trạng thái | Build (bảng `plan_tasks`, RLS) |
| US-013 Editor draft management | Đề xuất `proposed` qua RPC; ẩn công khai cho tới khi duyệt | Done (mô hình khác) | Không có bước "gửi duyệt" riêng | Keep (X3) |
| US-014 Reviewer approval/publish | `review_fact`, duyệt entity, `fact_reviews` | Partial | Chặn tự duyệt (X4) | Quyết X4 |
| US-015 CMS role/permission | RBAC tùy biến, audit | Done | Super Admin, re-auth | Enhance nếu cần |
| US-016 Report incorrect info | Không | Missing | Toàn bộ | Build: form công khai + giới hạn tần suất (rate limit) + hàng chờ admin |
| US-017 Source freshness review | Xác minh lại nguồn (`source_reverification`), cảnh báo trong `/admin` | Partial | Lịch rà soát theo loại dữ liệu (DEC-003) | Enhance |
| US-018 E2E/security/a11y | Test RLS và quyền ở mức database | Partial | E2E trên staging, đo WCAG | Build |
| US-019 UAT & deployment | Không | Missing | Không có bằng chứng UAT, backup, rollback | Build sau KHLOE-119 |

### 4.3 Test bảo mật bắt buộc (SEC-01…14)

| Nhóm | Hiện trạng |
|---|---|
| SEC-01/02/03/12: guest, IDOR, đổi `owner_id` | **Có test**: `lib/workspace/database.test.ts` (chủ sở hữu lấy từ session, từ chối ghi thay người khác, admin không đọc được) |
| SEC-04/11: editor hoặc client tự gọi API duyệt | **Có**: mọi thao tác ghi đi qua RPC `SECURITY DEFINER` kiểm `has_permission` |
| SEC-05: tự duyệt | **Không chặn** (X4) |
| SEC-06/07: nâng quyền, tài khoản bị khóa | Có kiểm quyền quản lý truy cập; chưa có Super Admin hay re-auth. Trường hợp tài khoản bị khóa dùng token cũ chưa được test riêng |
| SEC-08: guest đọc bản nháp qua tìm kiếm | **Có**: RLS và bộ lọc `reviewed` công khai (`lib/review/visibility.test.ts`) |
| SEC-10: hai người duyệt cùng lúc | **Có**: khóa advisory + `facts_already_decided` |
| SEC-14: sửa audit | `access_audit` chỉ ghi qua hàm; chưa có test riêng cho trường hợp "không sửa được" |
| SEC-13: session cũ sau đăng xuất | Do Supabase Auth xử lý; chưa có test riêng |

---

## 5. Code có nhưng tài liệu mới không nhắc

Nếu lấy bộ tài liệu mới làm chuẩn mà không ghi rõ, các phần này dễ bị coi là "thừa":

- **Sổ đăng ký nguồn** với hạng T1–T4, xác minh, xác minh lại (`/sources`, `/admin/sources`). Nó
  đáp ứng BR01 tốt hơn mức tài liệu yêu cầu.
- **Crawler** có kiểm tra robots.txt, ETag và mã băm nội dung; chỉ lấy nguồn đã đăng ký.
- **AI trích xuất** chỉ tạo đề xuất (L3c vừa xong). Tài liệu chỉ cấm "AI quyết định visa", nên phần
  này không mâu thuẫn.
- **Phát hiện mâu thuẫn** giữa các nguồn (`conflicted`).
- **Phân loại ngành ISCED-F** và lộ trình nghề nghiệp IT (11a/11b).
- **Nhập cư và thị trường lao động** (xem X2).
- **Song ngữ Việt/Anh.**

---

## 6. Đề xuất thứ tự làm tiếp

1. **Bạn quyết định:** X1 (5 nước), X2 (việc làm), X4 (tự duyệt), X11 (nguồn tỷ giá), và bộ tài
   liệu nào là chuẩn. Mình ghi các quyết định vào Decision Log của `PROJECT_SPEC.md`.
2. **Không phụ thuộc quyết định nào**, làm được ngay:
   - CI chạy test (US-001);
   - so sánh 2 chương trình (US-007);
   - công cụ ngân sách **không có tỷ giá** (US-008);
   - checklist kế hoạch (US-012);
   - báo lỗi dữ liệu (US-016).
3. **Sau quyết định:**
   - thêm nước (X1);
   - lọc ngành, lọc học phí (US-005);
   - gỡ công bố / bản thay thế (X3);
   - tỷ giá (US-009);
   - lưu kịch bản ngân sách (US-010).
4. **Trước khi phát hành:** tách DB prod (KHLOE-119), E2E và accessibility, UAT.

Theo mục 2 của AGENTS.md, mỗi tính năng mới ở bước 2–3 (ngân sách, checklist, báo lỗi) là mở rộng
phạm vi so với `PROJECT_SPEC.md`. Cần bạn xác nhận rồi mới tạo task trên Linear và bắt đầu code.

## 7. Giới hạn của báo cáo này

- Trạng thái được đánh giá bằng cách đọc code và test, không qua thử nghiệm người dùng hay audit
  WCAG.
- Hình ảnh mockup trong file High-Fidelity (khoảng 700 KB) chưa được xem, chỉ đọc phần chữ.
- Báo cáo không kiểm lại các URL nghiên cứu (IDP, ICEF, Reddit) trong tài liệu.
