import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-heatmap',
  standalone: true, 
  imports: [IonicModule],
  templateUrl: './heatmap.page.html',
  styleUrls: ['./heatmap.page.scss'],
})
export class HeatmapPage {

  constructor(private router: Router) {}

  openReports(): void {
    this.router.navigate(['/folder/Reports']);
  }

  openHistory(): void {
    this.router.navigate(['/pages/history']);
  }

}
