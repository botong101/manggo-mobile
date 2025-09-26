import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetectPage } from './detect.page';

describe('DetectPage', () => {
  let component: DetectPage;
  let fixture: ComponentFixture<DetectPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetectPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
