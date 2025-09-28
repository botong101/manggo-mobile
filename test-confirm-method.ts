// Quick test file - you can use this to test the basic functionality
// Replace the confirm() method in verify.page.ts temporarily with this version:

export class TestConfirmMethod {
  private imageData: any;
  private isProcessing: boolean = false;
  private detectionType: string = 'leaf';
  private loadingCtrl: any;
  private apiService: any;
  private router: any;

  async confirm() {
    console.log('🔍 Starting confirm method...');
    
    if (!(this as any).imageData) {
      (this as any).showToast('No image to process.', 'warning');
      return;
    }

    if ((this as any).isProcessing) {
      console.log('🚫 Already processing, skipping...');
      return;
    }
    
    console.log('✅ Basic checks passed, starting processing...');
    (this as any).isProcessing = true;
    
    const loading = await (this as any).loadingCtrl.create({ 
      message: 'Analyzing mango disease...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      // Convert base64 to File
      console.log('🔄 Converting base64 to File...');
      const base64 = (this as any).imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });
      
      console.log('✅ File created:', file.name, file.size, 'bytes');
      
      // Skip EXIF for now - just do basic prediction
      console.log('🔄 Calling API without EXIF...');
      const result = await (this as any).apiService.predictImageWithLocation(
        file, 
        ((this as any).detectionType as 'fruit' | 'leaf') || 'leaf'
      );
      
      await loading.dismiss();
      (this as any).isProcessing = false;
      
      console.log('✅ Image processed successfully:', result);
      
      // Navigate to results
      (this as any).router.navigate(['/pages/results'], { 
        state: { 
          result: result,
          image: (this as any).imageData,
          imageFile: file
        } 
      });
      
    } catch (error) {
      console.error('❌ Error in confirm method:', error);
      await loading.dismiss();
      (this as any).isProcessing = false;
      
      let errorMessage = 'Analysis failed. Please try again.';
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message, error.stack);
        if (error.message.includes('network') || error.message.includes('connect')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (error.message.includes('format') || error.message.includes('415')) {
          errorMessage = 'Image format not supported. Please try a different image.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      (this as any).showToast(errorMessage, 'danger');
    }
  }

  private showToast(message: string, color: string) {
    console.log(`Toast: ${message} (${color})`);
  }
}