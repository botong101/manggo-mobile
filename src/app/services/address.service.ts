// address helper service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private jsonPath = 'assets/ph-address.json';

  constructor(private http: HttpClient) {}

  // get provinces list
  getProvinces(): Observable<{ name: string }[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => Object.keys(data).map(prov => ({ name: prov })))
    );
  }

  // get cities in province
  getCities(province: string): Observable<{ name: string }[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => Object.keys(data[province] || {}).map(city => ({ name: city })))
    );
  }

  // get barangays in city
  getBarangays(province: string, city: string): Observable<string[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => data[province]?.[city] || [])
    );
  }
}
