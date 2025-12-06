import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'vp_auth';
  private readonly validUsername = 'james';
  private readonly validPassword = 'secretjames';

  isLoggedIn(): boolean {
    return localStorage.getItem(this.storageKey) === 'true';
  }

  login(username: string, password: string): boolean {
    const ok = username === this.validUsername && password === this.validPassword;
    if (ok) localStorage.setItem(this.storageKey, 'true');
    return ok;
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
  }
}

