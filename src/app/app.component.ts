import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Database } from '@angular/fire/database';

@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'calender';
  viewMode = 'cat';
  loggedIn = false;
  users: any;

}
