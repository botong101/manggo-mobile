import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { MenuController } from '@ionic/angular';

@Component({
  selector: 'app-first-page',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './first-page.page.html',
  styleUrls: ['./first-page.page.scss'],
})
export class FirstPagePage implements OnInit {

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private menuController: MenuController
  ) {}

  ngOnInit() {
      this.menuController.enable(false); // Hide the menu when login page loads
    }
    ionViewWillEnter() {
      this.menuController.enable(false); // Ensure menu is hidden when entering this page
    }
    ionViewWillLeave() {
      this.menuController.enable(true); // Re-enable menu when leaving login page
    }
  
    
    goToLogin() {
      this.router.navigate(['/pages/login']);
    }

    goToRegister() {
      this.router.navigate(['/pages/register']);
    } 
}
