import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DetectPageRoutingModule } from './detect-routing.module';

import { DetectPage } from './detect.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DetectPageRoutingModule,
    DetectPage
  ],
})
export class DetectPageModule {}
