import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-detect',
  standalone: true, 
  imports: [IonicModule],
  templateUrl: './detect.page.html',
  styleUrls: ['./detect.page.scss'],
})
export class DetectPage implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {
  }

}
