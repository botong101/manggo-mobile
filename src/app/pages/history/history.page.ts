import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface AnalysisHistoryItem {
  id: number;
  date: string | null;
  filename: string;
  disease: string;
  result: 'Healthy' | 'Diseased';
  details: string;
  confidence: number | null;
  is_healthy: boolean;
  is_verified: boolean;
  confirmed_correct: boolean | null;
  location_address: string;
  disease_type: string;
  image_url: string | null;
}

interface AnalysisHistorySummary {
  total: number;
  healthy: number;
  diseased: number;
}

@Component({
  selector: 'app-history',
  standalone: true, 
  imports: [IonicModule, CommonModule, DatePipe, HttpClientModule],
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {

  analysisHistory: AnalysisHistoryItem[] = [];
  isLoading = false;
  error: string | null = null;
  summary: AnalysisHistorySummary = {
    total: 0,
    healthy: 0,
    diseased: 0,
  };

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.fetchAnalysisHistory();
  }

  fetchAnalysisHistory() {
    this.isLoading = true;
    this.error = null;
    const apiUrl = `${environment.apiUrl}/history/`;

    this.http.get<{ data?: { analyses?: AnalysisHistoryItem[]; summary?: AnalysisHistorySummary } }>(apiUrl).subscribe({
      next: (response) => {
        this.analysisHistory = response?.data?.analyses ?? [];
        this.summary = response?.data?.summary ?? {
          total: this.analysisHistory.length,
          healthy: this.analysisHistory.filter((item) => item.is_healthy).length,
          diseased: this.analysisHistory.filter((item) => !item.is_healthy).length,
        };
        this.isLoading = false;
      },
      error: (err) => {
        if (err?.status === 401) {
          this.error = 'Please sign in again to view your analysis history.';
        } else {
          this.error = 'Failed to load your analysis history.';
        }
        this.isLoading = false;
      }
    });
  }

  refreshHistory(): void {
    this.fetchAnalysisHistory();
  }

  getStatusColor(item: AnalysisHistoryItem): string {
    return item.is_healthy ? 'success' : 'danger';
  }

  getStatusIcon(item: AnalysisHistoryItem): string {
    return item.is_healthy ? 'shield-checkmark-outline' : 'warning-outline';
  }

  getConfidenceLabel(confidence: number | null): string {
    if (typeof confidence !== 'number') {
      return 'Confidence unavailable';
    }

    const value = confidence > 1 ? confidence : confidence * 100;
    return `${Math.round(value)}% confidence`;
  }
}
