import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { IonicModule, ToastController, ModalController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  standalone: true, 
  imports: [IonicModule, CommonModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  userName: string = 'User';
  currentTime: string = '';
  userAvatar: string = '';
  selectedDetectionType: string | null = null;
  selectedImageFile: any = null;
  
  // stats stuff
  totalAnalyses: number = 0;
  healthyCount: number = 0;
  diseaseCount: number = 0;
  recentAnalysesCount: number = 0;
  
  // weather (fake for now)
  weatherData: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.handleRefreshParams();
    this.loadUserData();
    this.updateTimeGreeting();
    this.loadStatistics();
    this.loadWeatherData();
  }

  ionViewWillEnter() {
    // clear everything and reload
    this.resetPageData();
    this.handleRefreshParams();
    this.loadUserData();
    this.updateTimeGreeting();
    this.loadStatistics();
    this.loadWeatherData();
  }

  private handleRefreshParams() {
    // if refresh param exists clear stuff
    this.route.queryParams.subscribe(params => {
      if (params['refresh']) {
        // wipe cached stuff
        this.resetPageData();
        // remove param from url cuz ugly
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { refresh: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  private resetPageData() {
    // clear everything
    this.selectedDetectionType = null;
    this.selectedImageFile = null;
    
    // zero out stats
    this.totalAnalyses = 0;
    this.healthyCount = 0;
    this.diseaseCount = 0;
    this.recentAnalysesCount = 0;
    
    // clear weather
    this.weatherData = null;
    
    // delete temp stuff from storage
    const tempKeys = ['tempImageData', 'lastAnalysis', 'analysisResult', 'selectedImage', 'predictionData'];
    tempKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });
    
  }

  // other components can call this to refresh
  public forceRefresh() {
    this.resetPageData();
    this.loadUserData();
    this.updateTimeGreeting();
    this.loadStatistics();
    this.loadWeatherData();
  }

  selectDetectionType(type: 'leaf' | 'fruit') {
    this.selectedDetectionType = type;
  }
  
  clearSelection() {
    this.selectedDetectionType = null;
  }

  private loadUserData() {
    // try both old and new storage keys
    const userData = localStorage.getItem('userInfo') || localStorage.getItem('user_data');
    const authToken = localStorage.getItem('accessToken') || localStorage.getItem('auth_token');
    
    
    if (userData) {
      try {
        const user = JSON.parse(userData);
        
        this.userName = user.firstName || 
                       user.first_name || 
                       user.name || 
                       user.username || 
                       user.displayName ||
                       'User';
        
        this.userAvatar = user.avatar || user.profileImage || '';
      } catch (error) {
        this.userName = 'User';
      }
    } else {
      // no user data, check simple name
      const storedUserName = localStorage.getItem('userName');
      if (storedUserName) {
        this.userName = storedUserName;
      } else {
        this.userName = 'User';
      }
    }
  }

  private updateTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) {
      this.currentTime = 'Good Morning';
    } else if (hour < 17) {
      this.currentTime = 'Good Afternoon';
    } else {
      this.currentTime = 'Good Evening';
    }
  }

  private loadStatistics() {
    // get from storage or api
    const stats = localStorage.getItem('analysis_stats');
    if (stats) {
      try {
        const data = JSON.parse(stats);
        this.totalAnalyses = data.total || 0;
        this.healthyCount = data.healthy || 0;
        this.diseaseCount = data.diseases || 0;
        this.recentAnalysesCount = data.recent || 0;
      } catch (error) {
        console.error('Error loading statistics:', error);
      }
    }
  }

  private loadWeatherData() {
    // fake weather data - todo use real api later
    this.weatherData = {
      temperature: 28,
      description: 'Partly Cloudy',
      location: 'Your Farm',
      humidity: 65,
      pressure: 1013
    };
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  getTimeIcon(): string {
    const hour = new Date().getHours();
    if (hour < 6 || hour > 20) return 'moon-outline';
    if (hour < 12) return 'sunny-outline';
    if (hour < 18) return 'partly-sunny-outline';
    return 'moon-outline';
  }

  async openProfile() {
    // go to profile page
    this.router.navigate(['/folder/Settings']);
  }

  async importPhoto() {
    if (!this.selectedDetectionType) {
      await this.showToast('Please select detection type (Leaf or Fruit) first.', 'warning');
      return;
    }
    
    
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });
      const imageData = 'data:image/jpeg;base64,' + image.base64String;
      
      
      this.router.navigate(['/pages/verify'], {
        state: {
          image: imageData,
          detectionType: this.selectedDetectionType
        }
      });
    } catch (err) {
      console.error('Photo import error:', err);
      await this.showToast('Photo import cancelled or failed.', 'warning');
    }
  }

  async useCamera() {
    if (!this.selectedDetectionType) {
      await this.showToast('Please select detection type (Leaf or Fruit) first.', 'warning');
      return;
    }
    
    
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      const imageData = 'data:image/jpeg;base64,' + image.base64String;
      
      
      this.router.navigate(['/pages/verify'], {
        state: {
          image: imageData,
          detectionType: this.selectedDetectionType
        }
      });
    } catch (err) {
      console.error('Camera error:', err);
      await this.showToast('Camera cancelled or failed.', 'warning');
    }
  }
  private base64ToFile(base64: string, filename: string): File {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  navigateToHistory() {
    this.router.navigate(['/folder/History']);
  }

  navigateToReports() {
    this.router.navigate(['/folder/Reports']);
  }

  navigateToMap() {
    this.router.navigate(['/folder/Map']);
  }

  navigateToTips() {
    this.router.navigate(['/folder/Tips']);
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({ 
      message, 
      duration: 3000, 
      color,
      position: 'bottom',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  private sendPredictionRequest() {
    if (!this.selectedImageFile || !this.selectedDetectionType) {
      this.showToast('Please select an image and detection type.', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('image', this.selectedImageFile);
    formData.append('detection_type', this.selectedDetectionType); // 'leaf' or 'fruit'

    this.http.post(`${environment.apiUrl}/predict/`, formData).subscribe({
      next: (response) => {
        this.showToast('Prediction successful!', 'success');
        // do something with response
      },
      error: (err) => {
        this.showToast('Prediction failed.', 'danger');
      }
    });
  }
}