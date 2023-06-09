import { Observable } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { Component, OnInit } from '@angular/core';
import { AppUser } from '../../shared/model/app-user';

@Component({
  selector: 'navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  appUser: AppUser;
  constructor(public authService: AuthService) {}
  ngOnInit(): void {}
}