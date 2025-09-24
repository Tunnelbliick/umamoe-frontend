import { TestBed } from '@angular/core/testing';
import { DomainMigrationService } from './domain-migration.service';

describe('DomainMigrationService', () => {
  let service: DomainMigrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DomainMigrationService);
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show popup on first visit', () => {
    expect(service.shouldShowPopup()).toBe(true);
  });

  it('should not show popup after being marked as shown', () => {
    service.markPopupAsShown();
    expect(service.shouldShowPopup()).toBe(false);
  });

  it('should show popup again after reset', () => {
    service.markPopupAsShown();
    expect(service.shouldShowPopup()).toBe(false);
    
    service.resetPopup();
    expect(service.shouldShowPopup()).toBe(true);
  });
});
