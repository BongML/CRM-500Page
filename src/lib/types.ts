export type Niche = {
  id: string;
  /** Chủ sở hữu — chỉ có mặt khi tài khoản tổng đang xem gộp nhiều tài khoản. */
  userId?: string;
  name: string;
  color: string;
  icon: string;
  aggPages: number;
  aggViews: number;
  aggReach: number;
  aggRate: number;
  aggPpi: number;
  order: number;
};

export type Group = { id: string; name: string; order: number; userId?: string };
export type Sub = { id: string; name: string; groupId: string; order: number; userId?: string };

export type Page = {
  id: string;
  /** Chủ sở hữu — chỉ có mặt khi tài khoản tổng đang xem gộp nhiều tài khoản. */
  userId?: string;
  /** Profile-ID trong báo cáo Karmar — khóa ghép dữ liệu giữa hai loại báo cáo. */
  ref: string;
  /** Tên chuẩn hóa — khóa lọc trùng khi báo cáo thiếu Profile-ID. */
  slug: string;
  name: string;
  groupId: string;
  subId: string;
  nicheId: string;
  follower: number;
  posts: number;
  likes: number;
  comments: number;
  rate: number;
  ppi: number;
  views: number;
  reach: number;
  network: string | null;
  url: string | null;
  /** Ảnh đại diện page từ báo cáo benchmark. Link fbcdn hết hạn sau vài ngày. */
  image: string | null;
  /** Mốc cuối kỳ của báo cáo benchmark đang dùng (ISO). */
  reportedAt: string | null;
  source: string | null;
};

export type TopPost = {
  id: string;
  caption: string;
  pageName: string;
  nicheId: string;
  /** Page mà bài này thuộc về — nối từ Profile-ID của báo cáo top content. */
  pageId: string | null;
  link: string | null;
  image: string | null;
  time: string;
  likes: number;
  comments: number;
  rcs: number;
  rate: number;
  reach: number;
  ipi: number;
  neg: number;
  order: number;
};

export type Trend = {
  id: string;
  term: string;
  posts: number;
  rate: string;
  nicheId: string;
  order: number;
};

/** Một điểm trên biểu đồ tăng trưởng — chốt tại mốc cuối kỳ của báo cáo. */
export type Snapshot = {
  id: string;
  takenAt: string;
  nicheId: string | null;
  pages: number;
  views: number;
  reach: number;
  rate: number;
  ppi: number;
};

/** Tài khoản đang đăng nhập. `role` = "admin" là tài khoản tổng. */
export type SessionUser = { id: string; email: string; name: string; role: string };

/** Chủ sở hữu dữ liệu — dùng để chú thích page/ngách của ai khi xem gộp. */
export type Owner = { id: string; name: string; email: string };

/**
 * Phạm vi dữ liệu đang xem. `userId === null` + `admin` = toàn hệ thống (dữ
 * liệu của mọi tài khoản gộp lại).
 */
export type Scope = { admin: boolean; userId: string | null };

/** Một dòng trong bảng quản lý người dùng của tài khoản tổng. */
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  pages: number;
  niches: number;
  groups: number;
  posts: number;
};

export type Bootstrap = {
  niches: Niche[];
  groups: Group[];
  subs: Sub[];
  pages: Page[];
  topPosts: TopPost[];
  trends: Trend[];
  snapshots: Snapshot[];
  /** Rỗng trừ khi tài khoản tổng đang xem toàn hệ thống. */
  owners: Owner[];
  scope: Scope;
  negThreshold: number;
};

export type BarMetric = "views" | "rate" | "ppi";
export type Screen = "login" | "dashboard" | "catalog" | "page" | "manage";
export type SortState = { col: string; dir: "desc" | "asc" } | null;
