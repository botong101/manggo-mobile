import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiService } from 'src/app/services/apiservice.service';

@Component({
  selector: 'app-verify',
  standalone: true, 
  imports: [IonicModule, CommonModule],
  templateUrl: './verify.page.html',
  styleUrls: ['./verify.page.scss'],
})
export class VerifyPage implements OnInit {
  imageData: string | null = null;
  detectionType: string | null = null;
  isProcessing = false;

  constructor(
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    const nav = window.history.state;
    this.imageData = nav.image || null;
    this.detectionType = nav.detectionType || null;
    if (!this.imageData) {
      this.showToast('No image provided. Please take or select a photo.', 'warning');
      this.goBack();
    }
  }

  goBack() {
    this.router.navigate(['/pages/home']);
  }

  async confirm() {
    if (!this.imageData) {
      this.showToast('No image to process.', 'warning');
      return;
    }
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    const loading = await this.loadingCtrl.create({ 
      message: 'Analyzing mango disease...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      // Convert base64 to File
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });
      
      console.log('Processing image with location extraction...');
      
      // Use ApiService method that handles location extraction and prediction
      const result = await this.apiService.predictImageWithLocation(
        file, 
        (this.detectionType as 'fruit' | 'leaf') || 'leaf'
      );
      
      await loading.dismiss();
      this.isProcessing = false;
      
      console.log('Image processed successfully with location data:', result);
      
      // Navigate to results with the processed result and original image
      this.router.navigate(['/pages/results'], { 
        state: { 
          result: result,
          image: this.imageData,
          imageFile: file  // Pass the File object for any additional processing
        } 
      });
    } catch (error) {
      await loading.dismiss();
      this.isProcessing = false;
      console.error('Image processing error:', error);
      
      let errorMessage = 'Analysis failed. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connect')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (error.message.includes('format') || error.message.includes('415')) {
          errorMessage = 'Image format not supported. Please try a different image.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      this.showToast(errorMessage, 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'danger') {
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