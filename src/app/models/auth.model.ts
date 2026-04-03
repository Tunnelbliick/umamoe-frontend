export interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface AuthLoginResponse {
  url: string;
  state: string;
}

export interface Identity {
  provider: string;
  provider_id: string;
  display_name?: string;
}

export interface LinkedAccount {
  id: number;
  account_id: string;
  verification_status: 'pending' | 'verified';
  verification_token?: string;
  verified_at: string | null;
  trainer_name?: string;
  representative_uma_id?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // full key, only returned on creation
  key_prefix: string;
  last_used?: string;
  total_requests: number;
  created_at: string;
  revoked: boolean;
}
