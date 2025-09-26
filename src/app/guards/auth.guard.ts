import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const isLoggedIn = this.isUserLoggedIn();
    
    if (!isLoggedIn) {
      this.router.navigate(['/pages/login']);
      return false;
    }
    
    return true;
  }

  private isUserLoggedIn(): boolean {
    const userData = localStorage.getItem('userInfo') || localStorage.getItem('user_data');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    return !!(userData && isLoggedIn === 'true');
  }
}
