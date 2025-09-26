import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isSubmitting: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private menuController: MenuController
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }
  
  ngOnInit() {
    this.menuController.enable(false); 
  }
  
  ionViewWillEnter() {
    this.menuController.enable(false); 
  }
  
  ionViewWillLeave() {
    this.menuController.enable(true);
  }


  // Add this method that your HTML template is calling
  async login() {
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      this.showToast('Please fill all fields correctly.', 'danger');
      return;
    }

    if (this.isSubmitting) {
      return; // Prevent multiple submissions
    }

    this.isSubmitting = true;
    const loading = await this.loadingCtrl.create({ 
      message: 'Signing you in...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });

      const apiUrl = `http://127.0.0.1:8000/api/login/`;

      this.http.post(apiUrl, this.loginForm.value, { headers }).subscribe({
        next: async (response: any) => {
          await loading.dismiss();
          this.isSubmitting = false;
          
          if (response.success) {
            // Store JWT tokens
            if (response.access) {
              localStorage.setItem('accessToken', response.access);
            }
            if (response.refresh) {
              localStorage.setItem('refreshToken', response.refresh);
            }
            if (response.user) {
              localStorage.setItem('userInfo', JSON.stringify(response.user));
              localStorage.setItem('userName', response.user.firstName + ' ' + response.user.lastName);
            }
            
            // Set the isLoggedIn flag that AuthGuard checks for
            localStorage.setItem('isLoggedIn', 'true');
            
            this.showToast('Login successful!', 'success');
            this.router.navigate(['/pages/home']);
          } else {
            this.showToast(response.message || 'Login failed');
          }
        },
        error: async (err) => {
          await loading.dismiss();
          this.isSubmitting = false;
          console.error('Login error:', err);
          
          let errorMessage = 'Login failed. Please try again.';
          
          if (err.status === 0) {
            errorMessage = 'Cannot connect to server. Please check:\n• Server is running\n• Network connection\n• Server IP address is correct';
          } else if (err.status === 401) {
            errorMessage = 'Invalid email or password.';
          } else if (err.status === 403) {
            errorMessage = 'Access forbidden. Please check your credentials.';
          } else if (err.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (err.error && err.error.message) {
            errorMessage = err.error.message;
          }
          
          this.showToast(errorMessage);
        }
      });
    } catch (error) {
      await loading.dismiss();
      this.isSubmitting = false;
      this.showToast('Unexpected error occurred. Please try again.');
    }
  }

  async onSubmit() {
    // Call the login method for form submission
    await this.login();
  }

  goToRegister() {
    this.router.navigate(['/pages/register']);
  }

  async testConnection() {
    const loading = await this.loadingCtrl.create({
      message: 'Testing server connection...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const testUrl = `${environment.apiUrl}/`;
      this.http.get(testUrl).subscribe({
        next: async (response) => {
          await loading.dismiss();
          this.showToast('Server is reachable!', 'success');
        },
        error: async (err) => {
          await loading.dismiss();
          console.error('Connection test error:', err);
          
          let message = 'Server connection failed.';
          if (err.status === 0) {
            message = 'Cannot reach server. Check if Django server is running on ' + environment.apiUrl;
          } else {
            message = `Server responded with status ${err.status}`;
          }
          
          this.showToast(message);
        }
      });
    } catch (error) {
      await loading.dismiss();
      this.showToast('Connection test failed.');
    }
  }

  // Add this method to your login component or create an auth service
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userName');
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['/pages/login']);
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}