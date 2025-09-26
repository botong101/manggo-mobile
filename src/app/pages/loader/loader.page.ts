import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';


@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './loader.page.html',
  styleUrls: ['./loader.page.scss'],
})
export class LoaderPage implements OnInit {

   constructor(private router: Router, private menuController: MenuController) {}

  ngOnInit() {
    this.menuController.enable(false); // Hide the menu when loader page loads
    setTimeout(() => {
      this.router.navigateByUrl('pages/first-page'); // redirect after 5s
    }, 5000);
  }

  ionViewWillLeave() {
    this.menuController.enable(true); // Re-enable menu when leaving loader page
  }

}
