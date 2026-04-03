export interface CircleListEntry {
  id: number;
  name: string;
  comment: string;
  leader_name: string;
  member_count: number;
  auto_accept: boolean;
  fan_count: number;
  prev_fan_count: number;
  rank: number;
  prev_rank: number;
}
export interface Circle {
  circle_id: number;
  name: string;
  comment: string;
  leader_viewer_id: number;
  leader_name?: string;
  member_count: number;
  join_style: number; // 1 = Open, 2 = Approval, 3 = Closed?
  policy: number; // 1 = Relaxed, etc?
  created_at: string;
  last_updated: string;
  monthly_rank: number;
  monthly_point: number;
  last_month_rank: number;
  last_month_point: number;
  archived?: boolean;
  yesterday_updated?: string;
  yesterday_points?: number;
  yesterday_rank?: number;
  club_rank?: number;
  live_points?: number;
  live_rank?: number;
  last_live_update?: string;
}
export interface CircleMemberMonthlyData {
  id: number;
  circle_id: number;
  viewer_id: number;
  trainer_name: string;
  membership?: number; // 1 = member, 2 = officer, 3 = leader
  year: number;
  month: number;
  daily_fans: number[];
  next_month_start?: number; // Fan count at month start (enables day 1 gain calculation)
  last_updated: string;
}
export interface CircleDetailsResponse {
  circle: Circle;
  members: CircleMemberMonthlyData[];
  club_rank?: number;
  fans_to_next_tier?: number;
  fans_to_lower_tier?: number;
  yesterday_fans_to_next_tier?: number;
  yesterday_fans_to_lower_tier?: number;
}
export interface CircleMember {
  trainer_id: string;
  name: string;
  fan_count: number;
  last_updated: string;
  role: 'leader' | 'officer' | 'member';
  daily_gain?: number;
  daily_avg?: number;
  monthly_gain?: number;
  seven_day_avg?: number;
  weekly_gain?: number;
  projected_monthly?: number;
  priorCircleGain?: number; // Fans gained in a prior circle before joining this one
  priorInDaily?: number;
  priorInWeekly?: number;
  hasPriorCircleData?: boolean;
  isActive?: boolean;
}
export interface CircleHistoryPoint {
  date: string;
  fan_count: number;
  rank?: number;
}
export interface CircleMemberHistoryPoint {
  date: string;
  fan_count: number;
}
export interface CircleSearchFilters {
  name?: string;
  query?: string;
  minRank?: number;
  maxRank?: number;
  minFanCount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
