import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-snow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="snow-container">
      <div class="snowflake" *ngFor="let i of snowflakes"></div>
    </div>
  `,
  styleUrls: ['./snow.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SnowComponent {
  snowflakes = new Array(30); // Reduced number of snowflakes for performance
}
