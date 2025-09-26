import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common'; // <-- Import DatePipe
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-history',
  standalone: true, 
  imports: [IonicModule, CommonModule, DatePipe], // <-- Add DatePipe here
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {

  analysisHistory: any[] = [];
  isLoading = false;
  error: string | null = null;

  // Inject HttpClient
  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.fetchAnalysisHistory();
  }

  fetchAnalysisHistory() {
    this.isLoading = true;
    this.error = null;
    // Replace with your actual backend URL
    const apiUrl = `${environment.apiUrl}/history/`;
    this.http.get<any[]>(apiUrl).subscribe({
      next: (data) => {
        this.analysisHistory = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load analysis history.';
        this.isLoading = false;
      }
    });
  }
}
