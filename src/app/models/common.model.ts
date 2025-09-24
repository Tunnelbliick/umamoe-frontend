export interface User {
  id: string;
  displayName: string;
  email?: string;
  avatar?: string;
  isVerified: boolean;
  reputation: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Vote {
  id: string;
  userId: string;
  targetId: string;
  targetType: 'inheritance' | 'support-card';
  voteType: 'up' | 'down';
  createdAt: Date;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters?: any;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
