import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MenuController } from '@ionic/angular';
import { AddressService } from 'src/app/services/address.service';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  isSubmitting = false;

  provinces: string[] = [];
  filteredCities: string[] = [];
  filteredBarangays: string[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private menuController: MenuController,
    private addressService: AddressService // <-- inject here
  ) {}

  ngOnInit() {
    this.registerForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      province: ['', Validators.required],
      city: ['', Validators.required],
      barangay: ['', Validators.required],
      postalCode: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      agree: [false, [Validators.requiredTrue]]
    }, {
      validators: this.passwordMatchValidator
    });

    this.addressService.getProvinces().subscribe(provs => {
      this.provinces = provs.map((prov: { name: string }) => prov.name); // ["Cebu", "Bohol"]
    });
  }
  ionViewWillEnter() {
    this.menuController.enable(false); // Ensure menu is hidden when entering this page
  }
  ionViewWillLeave() {
    this.menuController.enable(true); // Re-enable menu when leaving register page
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      await this.register();
    } else {
      this.markFormGroupTouched();
      this.showToast('Please fill in all required fields correctly.');
    }
  }

  async register() {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingCtrl.create({
      message: 'Creating account...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });

      const formValue = this.registerForm.value;
      // Use the network IP of your backend server instead of localhost for devices on the same network
      const apiUrl = `http://127.0.0.1:8000/api/register/`; // Replace 127.0.0.1 with your server's actual LAN IP
      const registerData = {
        first_name: formValue.firstName,
        last_name: formValue.lastName,
        province: formValue.province,
        city: formValue.city,
        barangay: formValue.barangay,
        postal_code: formValue.postalCode,
        email: formValue.email,
        password: formValue.password
      };

      this.http.post(apiUrl, registerData, { headers }).subscribe({
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
              // Also store userName for compatibility
              const fullName = `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim();
              localStorage.setItem('userName', fullName || response.user.email || 'User');
            }
            
            this.showToast('Account created successfully!', 'success');
            
            // Navigate to home since user is now logged in with tokens
            this.router.navigate(['/pages/home']);
          } else {
            this.showToast(response.message || 'Registration failed');
          }
        },
        error: async (err) => {
          await loading.dismiss();
          this.isSubmitting = false;
          console.error('Registration error:', err);
          
          let errorMessage = 'Registration failed. Please try again.';
          
          if (err.status === 0) {
            errorMessage = 'Cannot connect to server. Please check server connection.';
          } else if (err.error && err.error.errors) {
            // Handle multiple validation errors from your Django backend
            if (Array.isArray(err.error.errors)) {
              errorMessage = err.error.errors.join('\n• ');
              errorMessage = '• ' + errorMessage; // Add bullet point to first error
            } else {
              errorMessage = err.error.errors;
            }
          } else if (err.error && err.error.error) {
            errorMessage = err.error.error;
          } else if (err.error && err.error.message) {
            errorMessage = err.error.message;
          } else if (err.status === 400) {
            errorMessage = 'Invalid data provided. Please check your input.';
          } else if (err.status === 500) {
            errorMessage = 'Server error. Please try again later.';
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

  goToLogin() {
    this.router.navigate(['/pages/login']);
  }

  private markFormGroupTouched() {
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
    });
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

  onProvinceChange(event: any) {
    const province = event.detail.value;
    this.registerForm.patchValue({ province });
    this.addressService.getCities(province).subscribe(cities => {
      this.filteredCities = cities.map((city: { name: string }) => city.name); // ["Cebu City", "Mandaue"]
      this.filteredBarangays = [];
    });
  }

  onCityChange(event: any) {
    const city = event.detail.value;
    this.registerForm.patchValue({ city });
    this.addressService.getBarangays(this.registerForm.value.province, city).subscribe(brgys => {
      this.filteredBarangays = brgys; // ["Barangay 1", "Barangay 2"]
    });
  }
}
