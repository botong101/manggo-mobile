// src/app/services/address.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private jsonPath = 'assets/ph-address.json';

  constructor(private http: HttpClient) {}

  // Provinces as objects
  getProvinces(): Observable<{ name: string }[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => Object.keys(data).map(prov => ({ name: prov })))
    );
  }

  // Cities as objects
  getCities(province: string): Observable<{ name: string }[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => Object.keys(data[province] || {}).map(city => ({ name: city })))
    );
  }

  // Barangays can stay strings
  getBarangays(province: string, city: string): Observable<string[]> {
    return this.http.get<{ [province: string]: any }>(this.jsonPath).pipe(
      map(data => data[province]?.[city] || [])
    );
  }
}
