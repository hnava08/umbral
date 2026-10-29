import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session.service';

export const guard: CanActivateFn = () => {
  const session = inject(Session);
  const router = inject(Router);
  if (session.account()) {
    return true;
  }
  return router.createUrlTree(['/sign-in']);
};
