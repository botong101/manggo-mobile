import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-heatmap',
  standalone: true, 
  imports: [IonicModule],
  templateUrl: './heatmap.page.html',
  styleUrls: ['./heatmap.page.scss'],
})
export class HeatmapPage implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {
  }

}
