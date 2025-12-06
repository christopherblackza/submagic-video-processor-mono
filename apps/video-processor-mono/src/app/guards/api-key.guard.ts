import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const apiKeyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const key = localStorage.getItem('submagic_api_key');
  if (key) return true;
  router.navigate(['/setup']);
  return false;
};

