# Handoff: Fanpage CRM (quản lý 500 fanpage)

## Tổng quan
CRM nội bộ dùng để quản lý & tối ưu chiến lược content cho 500 fanpage Facebook. Dữ liệu đẩy về từ nền tảng **Karmar** dưới dạng file export; **mọi số liệu ngầm hiểu là 28 ngày gần nhất** — hệ thống **không** có bất kỳ bộ lọc thời gian nào (không dropdown 7d/30d, không date picker). Người dùng: admin & content team, thao tác trên desktop (min 1280px, không vỡ ở 1024px). Ngôn ngữ UI: tiếng Việt.

Cấu trúc phân cấp: **500 page → Nhóm lớn (25 page) → Sub-group (tùy chọn) → Page → Ngách gán cho từng page.** Một page có 1 ngách; các page trong 1 nhóm 25 không bắt buộc cùng ngách.

## Về các file thiết kế trong bundle
Các file trong gói này là **tài liệu tham chiếu thiết kế viết bằng HTML** — prototype thể hiện giao diện & hành vi mong muốn, **không phải code production để copy trực tiếp**. Nhiệm vụ là **dựng lại các thiết kế này trong codebase mục tiêu** (React/Vue/… ) theo pattern & thư viện sẵn có của dự án. Nếu chưa có môi trường, hãy chọn framework phù hợp nhất (khuyến nghị React + TypeScript, Chart.js hoặc Recharts cho biểu đồ, một data-grid như TanStack Table cho bảng cây/sort).

Prototype gốc là một **Design Component** (`Fanpage CRM.dc.html`) — toàn bộ state & logic nằm trong một class, styling inline. Khi dựng lại, tách thành component theo pattern của bạn (xem "Component library" bên dưới).

## Fidelity
**High-fidelity (hifi).** Màu, typography, spacing, layout và tương tác đều là bản cuối. Dựng lại pixel-perfect bằng thư viện/design system của codebase. Dữ liệu trong prototype là **mock** (sinh ngẫu nhiên có seed) — thay bằng dữ liệu Karmar thật.

---

## Design tokens

### Màu — Light (mặc định)
| Token | Hex | Dùng cho |
|---|---|---|
| `--bg` | `#f6f7f9` | Nền app |
| `--surface` | `#ffffff` | Nền card, bảng, topbar, sidebar |
| `--surface-2` | `#fbfcfd` | Header bảng, dòng nhóm |
| `--border` | `#e8eaed` | Hairline border, row divider |
| `--border-strong` | `#d1d5db` | Viền input, select, nút phụ |
| `--text` | `#14171a` | Chữ chính |
| `--muted` | `#6b7280` | Label, chữ phụ |
| `--faint` | `#9ca3af` | Chú thích mờ |
| `--accent` | `#2563eb` | Accent chính (nút, active nav, link, đường line chart) |
| `--accent-soft` | `#eff4ff` | Nền active nav, avatar admin |
| `--good` | `#16a34a` | Trạng thái tốt (Hiệu quả) |
| `--warn` | `#d97706` | Cảnh báo (Trung bình) |
| `--danger` | `#dc2626` | Nguy hiểm (Cần review, neg. sentiment cao) |
| `--danger-soft` | `#fef2f2` | Nền badge neg. sentiment cao |
| `--row-hover` | `#f7f8fa` | Hover dòng bảng |

### Màu — Dark
| Token | Hex |
|---|---|
| `--bg` | `#0e1013` |
| `--surface` | `#16191e` |
| `--surface-2` | `#1b1f26` |
| `--border` | `#262b33` |
| `--border-strong` | `#333a44` |
| `--text` | `#e6e8eb` |
| `--muted` | `#9aa4b2` |
| `--faint` | `#6b7480` |
| `--accent` | `#3b82f6` |
| `--accent-soft` | `#16233b` |
| `--good` | `#22c55e` |
| `--warn` | `#f59e0b` |
| `--danger` | `#f87171` |
| `--danger-soft` | `#2a1a1c` |
| `--row-hover` | `#1b2028` |

Implement theme bằng CSS variables trên phần tử gốc, đảo bộ token khi toggle. Toggle được lưu ở trạng thái app (prototype dùng state; production nên lưu localStorage + tôn trọng `prefers-color-scheme`).

### Màu ngách (nhất quán mọi màn — dùng cho tag, dot, chart slice, viền card)
| Ngách | Màu | Nền tag (màu + alpha ~11%) | Icon |
|---|---|---|---|
| Content Win | `#2563eb` | `#2563eb1c` | W |
| Sản phẩm Trend | `#7c3aed` | `#7c3aed1c` | T |
| Hotdeals | `#ea580c` | `#ea580c1c` | H |
| Coupon | `#16a34a` | `#16a34a1c` | C |
| EPC | `#d97706` | `#d977061c` | E |
| Ngách tạo mới | chọn từ palette | — | chữ cái đầu của tên |

Palette chọn màu khi tạo ngách: `#2563eb #7c3aed #ea580c #16a34a #d97706 #0891b2 #db2777 #65a30d`. Icon ngách = **chữ cái đầu của tên**, in hoa, trong ô bo góc nền tint.

### Typography
- Font: **Inter** (400/500/600/700), fallback `system-ui, sans-serif`.
- Body 14px / line-height 1.45. Label phụ 11–12.5px. Sentence case, **không ALL CAPS**.
- KPI lớn: 27px/700, letter-spacing −0.5px. KPI page: 20px/700. Tiêu đề card: 14px/600. Tên page detail: 18px/700.
- Mọi số cột/KPI: `font-variant-numeric: tabular-nums`.
- Số theo định dạng VN: `toLocaleString('vi-VN')` (dấu `.` ngăn nghìn). Rút gọn views: ≥1tr → `"18,4 tr"`, ≥1K → `"90K"`. Phần trăm hiển thị dấu phẩy: `"4,9%"`.

### Spacing / radius / shadow
- Padding nội dung màn: `22px 26px 40px`. Gap grid card: `12–14px`. Padding card: `15–18px`.
- Radius: card `11px`, input/nút/select `8px`, tag/badge pill `20px`, thumbnail `6px`, avatar page `6–12px`.
- Shadow: rất nhẹ. Card `0 1px 2px rgba(16,24,40,.04)`. Modal `0 24px 60px rgba(15,18,25,.28)`. Bulk bar `0 12px 34px rgba(15,18,25,.32)`. **Không gradient, không đổ bóng lòe loẹt.**
- Sidebar rộng `236px`. Topbar cao `58px`, sticky. Main scroll độc lập.

---

## Màn hình / Views

### 1. Đăng nhập
- **Mục đích:** xác thực. Cực kỳ tối giản.
- **Layout:** form canh giữa màn, card `340px`, padding `32px`, radius `12px`, nền `--surface` trên nền `--bg`.
- **Thành phần:** 1 ô email, 1 ô mật khẩu (mỗi ô: label `--muted` 12.5px + input cao 40px viền `--border-strong`), 1 nút submit "Đăng nhập" cao 40px nền `--accent` chữ trắng 600. **Không logo, không tagline, không branding.**
- **Hành vi:** submit → chuyển sang Dashboard.

### 2. Dashboard tổng thể
Layout: sidebar trái + main. Topbar: tiêu đề + filter **Nhóm page** + filter **Ngách** (2 native select) + badge tĩnh "28 ngày · Karmar" ở phải. **Không filter thời gian.** Khi có ngách đang lọc, hiện chip ngách có nút ×.
- **Khối 1 — KPI (4 thẻ ngang, grid 4 cột):** Page đang active (`487 / 500`), Tổng Daily Views (`18,4 tr`/ngày), Tổng Reach/ngày (`9,7 tr`), Interaction rate TB (`4,9%`). Khi lọc theo ngách → 4 KPI đổi sang số của ngách đó.
- **Khối 2 — Biểu đồ (grid 1.7fr / 1fr):**
  - **Line chart** tăng trưởng lượt xem theo ngày, 28 điểm, fill gradient màu accent, không điểm tròn, tension .35. Y-axis rút gọn `tr`. Khi lọc ngách → series scale theo tỉ trọng views ngách.
  - **Doughnut** phân bổ page theo ngách (cutout 62%), + legend chú thích dưới. **Click 1 slice hoặc 1 legend → lọc dashboard theo ngách đó** (toggle).
- **Khối 3 — Top nội dung & xu hướng (grid 1.7fr / 1fr):**
  - **Bảng Top post 28 ngày:** cột Bài đăng (thumbnail 44px + caption + tên page + dot ngách + thời gian), Likes, Bình luận, R/C/S, Tương tác(%), **Neg. sentiment(%)**. Header sticky, hover row `--row-hover`, **sort mọi cột số** (click header → toggle desc/asc, hiện mũi tên ↓/↑). Neg. sentiment `> ngưỡng (mặc định 5%)` → chữ đỏ đậm nền `--danger-soft`.
  - **Xu hướng đang lên:** list hashtag/từ khóa/sản phẩm có tương tác tăng đột biến + số bài + tên ngách + % tăng (màu `--good`).

### 3. Danh mục ngách & nhóm page
- **Khối 1 — Niche cards (grid auto-fill 196px):** mỗi ngách 1 card viền trên 3px màu ngách: icon (chữ cái nền tint) + tên, Page, Views/ngày, Tương tác TB. Card cuối **"+ Tạo ngách mới"** (dashed) mở modal.
- **Khối 2 — So sánh ngách:** bar chart **ngang** so sánh giữa các ngách, **toggle chỉ số** (segmented): Daily Views / Tương tác / PPI. Mỗi bar màu ngách, bo góc, barThickness ~20.
- **Khối 3 — Bảng cây phân cấp:** grid cột cố định `34px | tên(2fr) | ngách 150px | page 90px | views 110px | tương tác 130px | trạng thái 130px`.
  - **Dòng nhóm lớn** (nền `--surface-2`, đậm hơn): checkbox, caret ▸ xoay 90° khi mở, tên + "25 page", mix ngách, chỉ số **roll-up**, badge trạng thái. Click dòng → expand.
  - **Dòng sub-group** (thụt lề 22px): caret + tên + số page + views. Click → expand. **Là vùng thả (drop target)** khi kéo page.
  - **Dòng page** (thụt lề 44px, `draggable`): checkbox, handle `⋮⋮`, avatar (initials), tên, tag ngách, views, tương tác, badge trạng thái. Click → mở trang chi tiết page.
  - **Kéo-thả:** kéo dòng page thả vào 1 sub-group → đổi `groupId`+`subId` của page (opacity 0.4 khi kéo, các sub-group sáng nền `--accent-soft` báo drop khi đang kéo).
  - **Bulk-edit:** tick nhiều page (hoặc tick dòng nhóm để chọn cả nhóm) → hiện **thanh bulk** nổi giữa dưới màn: "N page đã chọn" + các nút gán nhanh từng ngách + "Bỏ chọn".
- **Trạng thái tính theo PPI:** `≥80` Hiệu quả (good) · `60–79` Trung bình (warn) · `<60` Cần review (danger).

### 4. Modal tạo/chỉnh ngách
Popup giữa màn (520px, backdrop mờ). Gồm: input **tên ngách** + ô preview icon (tự lấy chữ đầu, nền tint theo màu chọn); hàng **swatch màu** (8 màu, viền đậm khi chọn); **danh sách page multi-select có ô search** (checkbox + avatar + tên + ngách hiện tại, cuộn max ~210px). Footer: Hủy / **Lưu ngách**. Lưu → tạo ngách mới (gán các page đã chọn sang ngách này) hoặc cập nhật ngách; rebuild doughnut & bar.

### 5. Chi tiết 1 fanpage (drill-down)
- **Header card:** avatar (56px, initials) + tên page + tag ngách + follower + tên nhóm; bên phải **select "Đổi ngách"** (đổi ngay lập tức).
- **KPI grid (4 cột × 2 hàng)** đúng cột Karmar Metrics Overview: Follower, Số bài đăng, Lượt thích, Bình luận, Interaction rate(%), Reach/ngày, Page Performance Index(%), Daily Views.
- **Bảng top post của page:** Bài đăng (thumb + caption + thời gian), Tương tác(%), Reach, Neg.(highlight nếu vượt ngưỡng).
- **Gợi ý ngách:** so sánh PPI của page với PPI TB ngách hiện tại → 3 trạng thái: giữ nguyên (PPI cao hơn ≥6), cân nhắc đổi sang ngách phù hợp hơn (thấp hơn ≥6), hoặc ổn định. Kèm bảng nhỏ: PPI page / PPI TB ngách / chênh lệch (màu theo dấu).

---

## Tương tác & hành vi
- **Điều hướng:** Login → Dashboard → (click page trong bảng cây) → Chi tiết page → "Quay lại danh mục" → tạo sub-group / gán ngách. Nav sidebar: Dashboard, Danh mục ngách & nhóm.
- **Sort bảng:** click header cột số → toggle `desc → asc`, hiện mũi tên. Chỉ cột số sort được.
- **Tree expand/collapse:** độc lập từng nhóm & sub-group; nhóm 1 & sub-group đầu mở sẵn mặc định.
- **Drag & drop page** giữa các sub-group (HTML5 DnD hoặc thư viện dnd-kit khi dựng React).
- **Doughnut click → lọc**; chip lọc + filter select đồng bộ; toggle tắt filter.
- **Bulk assign** ngách cho nhiều page.
- **Toggle dark/light** (nút cuối sidebar).
- **Đổi ngách** từ trang chi tiết (select) — cập nhật ngay.
- **Transition:** đổi màn fade nhẹ (`crmPop` .18s), modal/bulk bar pop .16s. Caret xoay .15s. Không animation nặng.
- **Responsive:** desktop-first ≥1280px, không vỡ ở 1024px; bảng rộng dùng scroll ngang.

## State cần có
- `theme` (light/dark), `screen` (login/dashboard/catalog/page), `selectedPageId`.
- `nicheFilter` (id|null), `groupFilter` (id|'all').
- `expanded` (map groupId→bool), `subExpanded` (map subId→bool).
- `selected` (map pageId→bool cho bulk), `dragId`.
- `sort` (per-table `{col, dir}`), `barMetric` (views/rate/ppi).
- `niches[]`, `pages[]`, `groups[]`, `subs[]` (nguồn dữ liệu — thay bằng data Karmar thật).
- `modal` ({id, name, color, pages}) + `modalSearch`.
- **Data fetching:** import file export Karmar (xlsx/csv) → parse → map vào `pages[]` (page-level) và `topPosts[]` (post-level). Không có tham số thời gian trong request.

## Cấu trúc dữ liệu Karmar (khớp cột export)
**Page-level (Metrics Overview):** Name, Follower, Number of posts, Number of Likes, Number of comments, Post interaction rate (%), Reach per day, Page Performance Index (%), Daily Views.
**Post-level (Top Posts):** Post (thumbnail + caption + tên page + timestamp), Number of Likes, Number of comments, Reactions/Comments/Shares, Post interaction rate (%), Reach per post, Interactions per impression/view (%), **Post comments negative sentiment share (%)** — highlight cảnh báo khi vượt ngưỡng.

## Component library (đề xuất khi dựng lại)
`KpiCard`, `ChartCard` (line/doughnut/bar wrapper), `DataTable` (sortable) + `TreeTable` (expandable, dnd, bulk-select), `NicheCard`, `NicheTag`, `StatusBadge`, `NicheModal`, `BulkBar`, `PageDetail`, `Sidebar`, `Topbar` (filter nhóm/ngách, badge 28 ngày), `ThemeToggle`.

## Assets
- **Không có ảnh thật.** Thumbnail post & avatar page là placeholder màu (HSL sinh từ tên) + initials → thay bằng ảnh/avatar thật từ Karmar/Facebook Graph.
- **Icon:** prototype dùng ký tự đơn giản (caret ▸, handle ⋮⋮, ▶). Khi dựng lại nên thay bằng icon set của codebase (Lucide/Heroicons…).
- **Chart:** Chart.js v4 (line/doughnut/bar ngang). Có thể thay bằng thư viện chart của dự án.

## Files trong bundle
- `Fanpage CRM.dc.html` — prototype đầy đủ 4 màn + mọi tương tác (tham chiếu chính).

> Lưu ý số liệu: Dashboard & niche cards hiển thị **mức hệ thống 500 page** (tổng quan); bảng cây thao tác trên **tập ~24 page mẫu** để demo drill-down/kéo-thả. Khi nối data thật, hợp nhất về cùng một nguồn `pages[]`.
