import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserProfileResponse, ProfileVisibility, VeteranMember, CmData, Achievement } from '../models/profile.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private apiUrl = `${environment.apiUrl}/api/v4/user/profile`;

  private _profileCtx = new BehaviorSubject<{
    profile: UserProfileResponse | null;
    isOwnProfile: boolean;
    visibility: ProfileVisibility;
  }>({ profile: null, isOwnProfile: false, visibility: { profile_hidden: false, hidden_sections: [] } });

  readonly profileCtx$ = this._profileCtx.asObservable();

  get profileCtx() { return this._profileCtx.value; }

  patchProfileCtx(patch: Partial<{ profile: UserProfileResponse | null; isOwnProfile: boolean; visibility: ProfileVisibility }>): void {
    this._profileCtx.next({ ...this._profileCtx.value, ...patch });
  }

  resetProfileCtx(): void {
    this._profileCtx.next({ profile: null, isOwnProfile: false, visibility: { profile_hidden: false, hidden_sections: [] } });
  }

  constructor(private http: HttpClient) {}

  getProfile(accountId: string): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.apiUrl}/${accountId}`);
  }

  getVisibility(accountId: string): Observable<ProfileVisibility> {
    return this.http.get<ProfileVisibility>(`${this.apiUrl}/${accountId}/visibility`);
  }

  updateVisibility(accountId: string, visibility: ProfileVisibility): Observable<ProfileVisibility> {
    return this.http.put<ProfileVisibility>(`${this.apiUrl}/${accountId}/visibility`, visibility);
  }

  uploadVeterans(accountId: string, payload: VeteranMember[]): Observable<VeteranMember[]> {
    return this.http.post<VeteranMember[]>(`${this.apiUrl}/${accountId}/veterans`, payload);
  }

  ingestVeteranList(payload: any[], accountId: string): Observable<{ inserted: number; updated: number; deleted: number; total: number }> {
    return this.http.post<{ inserted: number; updated: number; deleted: number; total: number }>(
      `/ingest/veteran?account_id=${encodeURIComponent(accountId)}`,
      payload
    );
  }

  uploadCmData(accountId: string, payload: CmData[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${accountId}/cm`, payload);
  }

  uploadAchievements(accountId: string, payload: Achievement[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${accountId}/achievements`, payload);
  }
}
