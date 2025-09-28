import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import * as EXIF from 'exif-js';

export interface ExifLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp?: Date;
  hasGps: boolean;
}

export interface LocationConsentResult {
  consentGiven: boolean;
  locationData: ExifLocationData | null;
  locationAccuracyConfirmed?: boolean; // Whether user confirmed the detected location as accurate
}

@Injectable({
  providedIn: 'root'
})
export class ExifLocationService {

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  /**
   * Extract GPS coordinates from image EXIF data
   */
  private async extractExifLocation(file: File): Promise<ExifLocationData | null> {
    return new Promise((resolve) => {
      try {
        // Check if EXIF library is available
        if (typeof EXIF === 'undefined') {
          console.warn('📍 EXIF library not available');
          resolve({
            latitude: 0,
            longitude: 0,
            hasGps: false
          });
          return;
        }

        // Set timeout for EXIF processing
        const timeout = setTimeout(() => {
          console.warn('📍 EXIF extraction timeout');
          resolve({
            latitude: 0,
            longitude: 0,
            hasGps: false
          });
        }, 5000);

        EXIF.getData(file as any, () => {
          try {
            clearTimeout(timeout);
            
            const lat = EXIF.getTag(file as any, 'GPSLatitude');
            const latRef = EXIF.getTag(file as any, 'GPSLatitudeRef');
            const lng = EXIF.getTag(file as any, 'GPSLongitude');
            const lngRef = EXIF.getTag(file as any, 'GPSLongitudeRef');
            const timestamp = EXIF.getTag(file as any, 'DateTime');
            
            console.log('🌍 EXIF GPS Data:', {
              lat, latRef, lng, lngRef, timestamp
            });

            if (lat && lng && latRef && lngRef && Array.isArray(lat) && Array.isArray(lng)) {
              // Convert GPS coordinates from DMS to decimal degrees
              const latitude = this.convertDMSToDD(lat, latRef);
              const longitude = this.convertDMSToDD(lng, lngRef);
              
              console.log('📍 Converted GPS coordinates:', { latitude, longitude });

              const locationData: ExifLocationData = {
                latitude,
                longitude,
                hasGps: true,
                timestamp: timestamp ? new Date(timestamp) : new Date()
              };

              // Try to get address using reverse geocoding
              this.reverseGeocode(latitude, longitude)
                .then(address => {
                  locationData.address = address;
                  resolve(locationData);
                })
                .catch(() => {
                  locationData.address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                  resolve(locationData);
                });
            } else {
              console.log('❌ No GPS data found in EXIF');
              resolve({
                latitude: 0,
                longitude: 0,
                hasGps: false
              });
            }
          } catch (error) {
            clearTimeout(timeout);
            console.error('❌ Error processing EXIF GPS data:', error);
            resolve({
              latitude: 0,
              longitude: 0,
              hasGps: false
            });
          }
        });
      } catch (error) {
        console.error('❌ Error in EXIF extraction setup:', error);
        resolve({
          latitude: 0,
          longitude: 0,
          hasGps: false
        });
      }
    });
  }

  /**
   * Convert DMS (Degrees, Minutes, Seconds) to Decimal Degrees
   */
  private convertDMSToDD(dms: number[], ref: string): number {
    let dd = dms[0] + (dms[1] / 60) + (dms[2] / 3600);
    if (ref === 'S' || ref === 'W') {
      dd = dd * -1;
    }
    return dd;
  }

  /**
   * Reverse geocode coordinates to address
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const data = await response.json();
      
      // Build address string
      const addressParts = [];
      if (data.locality) addressParts.push(data.locality);
      if (data.principalSubdivision) addressParts.push(data.principalSubdivision);
      if (data.countryName) addressParts.push(data.countryName);
      
      return addressParts.length > 0 ? addressParts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Show location consent popup and handle EXIF extraction
   */
  async requestLocationConsentWithExif(imageFile: File): Promise<LocationConsentResult> {
    try {
      console.log('🔍 Starting EXIF location extraction...');
      
      // TEMPORARY: Skip EXIF extraction due to library issues
      // TODO: Fix EXIF library issue and re-enable
      console.log('📍 EXIF extraction temporarily disabled due to library issues');
      
      /* COMMENTED OUT UNTIL EXIF LIBRARY ISSUE IS FIXED
      // First extract EXIF location data
      const exifLocation = await this.extractExifLocation(imageFile);
      
      console.log('🔍 EXIF Location Result:', exifLocation);

      // If no GPS data in EXIF, return early
      if (!exifLocation || !exifLocation.hasGps) {
        console.log('📍 No GPS data found in image EXIF');
        // Don't show toast for this - it's normal for many images
        return {
          consentGiven: false,
          locationData: null
        };
      }

      // Show consent popup with the extracted location
      const consent = await this.showLocationConsentAlert(exifLocation);
      
      return {
        consentGiven: consent,
        locationData: consent ? exifLocation : null
      };
      */

      // Return no location data for now
      return {
        consentGiven: false,
        locationData: null
      };

    } catch (error) {
      console.error('❌ Error in location consent process:', error);
      // Don't show toast for EXIF errors - just continue without location
      return {
        consentGiven: false,
        locationData: null
      };
    }
  }

  /**
   * Show location consent alert
   */
  private async showLocationConsentAlert(locationData: ExifLocationData): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '📍 Location Data Found',
        subHeader: 'Your photo contains GPS coordinates',
        message: `
          <div style="text-align: left; padding: 10px 0;">
            <p><strong>Location:</strong> ${locationData.address || 'Loading address...'}</p>
            <p><strong>Coordinates:</strong> ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}</p>
            <hr style="margin: 10px 0;">
            <p style="font-size: 0.9em; color: #666;">
              Would you like to share this location data to help improve our disease mapping? 
              This will help us understand disease patterns in different regions.
            </p>
          </div>
        `,
        buttons: [
          {
            text: 'Don\'t Share',
            role: 'cancel',
            handler: () => {
              console.log('🚫 User declined to share location');
              resolve(false);
            }
          },
          {
            text: 'Share Location',
            cssClass: 'primary',
            handler: () => {
              console.log('✅ User consented to share location');
              resolve(true);
            }
          }
        ],
        backdropDismiss: false
      });

      await alert.present();
    });
  }

  /**
   * Show toast message
   */
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  /**
   * Format location for display
   */
  formatLocationForDisplay(location: ExifLocationData): string {
    if (!location.hasGps) return 'No location data';
    
    if (location.address) {
      return location.address;
    }
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }
}