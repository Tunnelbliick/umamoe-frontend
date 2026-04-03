import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RaceSchedulerComponent } from './race-scheduler.component';

describe('RaceSchedulerComponent', () => {
  let component: RaceSchedulerComponent;
  let fixture: ComponentFixture<RaceSchedulerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RaceSchedulerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RaceSchedulerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
