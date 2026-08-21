import { writeXlsx, type SheetOut } from "./xlsxWrite";

/**
 * File mẫu cho từng loại dữ liệu hệ thống nhận. Mục đích duy nhất: người dùng
 * tải về, thay nội dung, đẩy lên là chạy — nên mỗi mẫu phải **nhập lại được**
 * qua đúng endpoint của nó (xem `parseReport` và `parsePageList`).
 *
 * Cột Profile-ID cố ý ghi dạng **chữ**: để dạng số thì Excel làm tròn ID dài
 * thành "1.21954E+20" và hai page khác nhau có thể trùng ID sau khi tròn.
 */

export type TemplateKind = "classify" | "benchmark" | "content";

export type Template = {
  kind: TemplateKind;
  /** Tên file khi tải về. */
  file: string;
  /** Nhãn hiển thị trên nút tải. */
  label: string;
  /** Endpoint dùng để nhập file này. */
  target: string;
  build: () => SheetOut[];
};

/** Mốc kỳ báo cáo trong file mẫu — Karmar để dòng này ngay trên hàng tiêu đề. */
const PERIOD = "Jul 23, 2026 - Aug 19, 2026";

/** Mẫu "phân loại page": file người dùng tự gõ, quyết định page nào vào nhóm nào. */
function classify(): SheetOut[] {
  const rows: (string | number | null)[][] = [
    ["STT", "Tên page", "Profile-ID", "Nhóm"],
    [1, "Love Brady Olivia", "141199565743461", "n8n_1_25"],
    [2, "McMullen Chris Maines", "0", "n8n_1_25"],
    [3, "Matthew Maher Gabrielle", "143702395491581", "n8n_1_25"],
    [4, "Spa Serenity Scape", "278453942015726", "n8n_26_50"],
    [5, "Everyday Essentials Emporium", "0", "n8n_26_50"],
    [6, "Blissful Bath Boutique", "277960952064942", "n8n_26_50"],
  ];

  const guide: (string | number | null)[][] = [
    ["Cách dùng file này"],
    [],
    ["Cột", "Bắt buộc", "Ý nghĩa"],
    ["STT", "không", "Số thứ tự, hệ thống bỏ qua."],
    ["Tên page", "có", "Tên fanpage. Dùng để khớp khi thiếu Profile-ID."],
    [
      "Profile-ID",
      "không",
      'ID trang. Bỏ trống hoặc ghi 0 nếu chưa có. Định dạng ô là Text, đừng để Number.',
    ],
    ["Nhóm", "có", "Tên nhóm page. Mỗi nhãn khác nhau là một nhóm."],
    [],
    ["Lưu ý"],
    ["• Mỗi page chỉ nên xuất hiện 1 dòng — dòng thứ hai bị bỏ qua và nhóm sẽ hụt page."],
    ["• Nhóm trùng tên với nhóm đang có thì page được xếp vào chính nhóm đó."],
    ["• File này không mang số liệu; số liệu đến từ báo cáo Fanpage Karma."],
    ["• Dòng chưa có page trong hệ thống: tick “Tạo page chưa có” để tạo mới với số liệu 0."],
  ];

  return [
    { name: "Phân loại page", rows },
    { name: "Hướng dẫn", rows: guide },
  ];
}

/** Mẫu báo cáo benchmark của Fanpage Karma — nguồn số liệu của bảng Page. */
function benchmark(): SheetOut[] {
  const header = [
    "Profile",
    "Profile-ID",
    "Network",
    "External Links",
    "Follower",
    "Number of Posts",
    "Number of Likes",
    "Number of Comments",
    "Post interaction rate",
    "Page Performance Index",
    "Daily Views",
    "Reach per day",
  ];

  const rows: (string | number | null)[][] = [
    ["Benchmarking"],
    [PERIOD],
    header,
    [
      "Love Brady Olivia",
      "141199565743461",
      "FACEBOOK",
      "https://facebook.com/lovebradyolivia",
      18420,
      62,
      9310,
      412,
      4.82,
      71,
      15200,
      8400,
    ],
    [
      "Spa Serenity Scape",
      "278453942015726",
      "FACEBOOK",
      "https://facebook.com/spaserenityscape",
      9250,
      41,
      3120,
      168,
      3.15,
      54,
      7300,
      3900,
    ],
    [
      "Nestled Nook Nest",
      "293296050526266",
      "FACEBOOK",
      "https://facebook.com/nestlednooknest",
      12680,
      55,
      5740,
      291,
      4.06,
      63,
      11100,
      6250,
    ],
  ];

  return [{ name: "Metrics Overview", rows }];
}

/** Mẫu báo cáo top content — nguồn của bảng TopPost và hashtag nổi bật. */
function content(): SheetOut[] {
  const header = [
    "Message",
    "Message-ID",
    "Profile",
    "Profile-ID",
    "Date",
    "Link",
    "Image Link",
    "Number of Likes",
    "Number of Comments",
    "Reactions, Comments & Shares",
    "Post interaction rate",
    "Reach per post",
    "Interactions per impression/view",
    "Post comments negative sentiment share",
  ];

  const posts: (string | number | null)[][] = [
    ["Top 25 Posts"],
    [PERIOD],
    header,
    [
      "Góc bếp nhỏ nhưng gọn gàng thế này thì ai cũng muốn nấu ăn mỗi ngày.",
      "141199565743461_9012345678",
      "Love Brady Olivia",
      "141199565743461",
      "2026-08-14 19:30",
      "https://facebook.com/lovebradyolivia/posts/9012345678",
      "https://scontent.fbcdn.net/v/anh-mau-1.jpg",
      2410,
      186,
      2712,
      6.24,
      41200,
      5.9,
      1.2,
    ],
    [
      "Bộ khăn tắm cotton mềm — món quà nhỏ cho phòng tắm của bạn.",
      "278453942015726_9012345679",
      "Spa Serenity Scape",
      "278453942015726",
      "2026-08-12 08:15",
      "https://facebook.com/spaserenityscape/posts/9012345679",
      "https://scontent.fbcdn.net/v/anh-mau-2.jpg",
      1180,
      74,
      1305,
      4.11,
      22800,
      4.3,
      0.6,
    ],
  ];

  const hashtags: (string | number | null)[][] = [
    ["Top 50 Hashtags"],
    [PERIOD],
    ["Profile", "value", "Times above average"],
    ["#homedecor", 128, 3],
    ["#cozyhome", 96, 2],
    ["#interiordesign", 74, 2],
  ];

  return [
    { name: "Top 25 Posts Overview", rows: posts },
    { name: "Top 50 Hashtags", rows: hashtags },
  ];
}

export const TEMPLATES: Template[] = [
  {
    kind: "classify",
    file: "mau-phan-loai-page.xlsx",
    label: "File phân loại page",
    target: "/api/groups/arrange",
    build: classify,
  },
  {
    kind: "benchmark",
    file: "mau-bao-cao-benchmark.xlsx",
    label: "Báo cáo benchmark (Karmar)",
    target: "/api/import",
    build: benchmark,
  },
  {
    kind: "content",
    file: "mau-bao-cao-top-content.xlsx",
    label: "Báo cáo top content (Karmar)",
    target: "/api/import",
    build: content,
  },
];

export function buildTemplate(kind: string): { file: string; buf: Buffer } | null {
  const tpl = TEMPLATES.find((t) => t.kind === kind);
  return tpl ? { file: tpl.file, buf: writeXlsx(tpl.build()) } : null;
}
