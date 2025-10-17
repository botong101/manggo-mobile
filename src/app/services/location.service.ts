import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

export interface LocationPermissionResult {
  granted: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  
  constructor() {}

  /**
   * Request location permission from user
   */
  async requestLocationPermission(): Promise<LocationPermissionResult> {
    try {
      const permissions = await Geolocation.requestPermissions();
      
      if (permissions.location === 'granted') {
        return {
          granted: true,
          message: 'Location permission granted'
        };
      } else {
        return {
          granted: false,
          message: 'Location permission denied. You can still use the app, but location data won\'t be saved.'
        };
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return {
        granted: false,
        message: 'Error requesting location permission. Location features will be disabled.'
      };
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      // Check if we have permission first
      const permissions = await Geolocation.checkPermissions();
      
      if (permissions.location !== 'granted') {
        return null;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      // Try to get address using reverse geocoding
      try {
        const address = await this.reverseGeocode(locationData.latitude, locationData.longitude);
        locationData.address = address;
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed:', geocodeError);
        locationData.address = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
      }

      return locationData;
      
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      // Use a public geocoding service (you can replace with your preferred service)
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
      // Fallback to coordinates
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Check if device supports location services
   */
  async isLocationAvailable(): Promise<boolean> {
    try {
      const deviceInfo = await Device.getInfo();
      // Location is available on most mobile platforms
      return deviceInfo.platform !== 'web';
    } catch (error) {
      console.error('Error checking device info:', error);
      return false;
    }
  }

  /**
   * Format location for display
   */
  formatLocationForDisplay(location: LocationData): string {
    if (location.address) {
      return location.address;
    }
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (±${location.accuracy.toFixed(0)}m)`;
  }
}
