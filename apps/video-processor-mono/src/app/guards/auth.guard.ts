import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  
  if (auth.isLoggedIn()) return true;

  const token = await auth.getToken();
  if (token) return true;

  router.navigate(['/login'], { queryParams: { redirect: state.url } });
  return false;
};
