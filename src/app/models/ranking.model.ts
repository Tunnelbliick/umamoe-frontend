// --- Entry types ---
export interface UserFanRankingMonthly {
  viewer_id: number;
  trainer_name: string | null;
  year: number;
  month: number;
  total_fans: number;
  monthly_gain: number;
  active_days: number;
  avg_daily: number | null;
  avg_3d: number | null;
  avg_7d: number | null;
  avg_monthly: number | null;
  rank: number;
  circle_id: number | null;
  circle_name: string | null;
}
export interface UserFanRankingAlltime {
  viewer_id: number;
  trainer_name: string | null;
  total_fans: number;
  total_gain: number;
  avg_day: number | null;
  avg_week: number | null;
  avg_month: number | null;
  rank: number;
  rank_total_gain: number;
  rank_total_fans: number;
  rank_avg_day: number;
  rank_avg_week: number;
  rank_avg_month: number;
  circle_id: number | null;
  circle_name: string | null;
}
export interface UserFanRankingGains {
  viewer_id: number;
  trainer_name: string | null;
  gain_3d: number;
  gain_7d: number;
  gain_30d: number;
  rank_3d: number;
  rank_7d: number;
  rank_30d: number;
  circle_id: number | null;
  circle_name: string | null;
}
// --- Response types ---
export interface MonthlyRankingsResponse {
  rankings: UserFanRankingMonthly[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  year: number;
  month: number;
}
export interface AlltimeRankingsResponse {
  rankings: UserFanRankingAlltime[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
export interface GainsRankingsResponse {
  rankings: UserFanRankingGains[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  sort_by: string;
}
// --- Request params ---
export interface MonthlyRankingsParams {
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
  query?: string;
  circle_id?: number;
  circle_name?: string;
}
export interface AlltimeRankingsParams {
  page?: number;
  limit?: number;
  query?: string;
  sort_by?: 'total_fans' | 'total_gain' | 'avg_day' | 'avg_week' | 'avg_month';
  circle_id?: number;
  circle_name?: string;
}
export interface GainsRankingsParams {
  page?: number;
  limit?: number;
  sort_by?: 'gain_3d' | 'gain_7d' | 'gain_30d';
  query?: string;
  circle_id?: number;
  circle_name?: string;
}
