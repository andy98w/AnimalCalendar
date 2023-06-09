import { Injectable } from '@angular/core';
import {
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import {
  AngularFireDatabase,
  AngularFireList,
  AngularFireObject,
} from '@angular/fire/compat/database';
import { endOfDay, startOfDay } from 'date-fns';
import { EventColor } from 'calendar-utils';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CrudService {
  
  eventsRef: AngularFireList<any>;
  eventRef: AngularFireObject<any>;
  constructor(private http: HttpClient, public authService: AuthService) {}
  user = this.authService.userData;
  // Fetch Single Event Object
  GetEvent(id: string) {
    return this.http.get(
      'https://animalcalendar-82554-default-rtdb.firebaseio.com/' + this.user.uid + '/events/' + id + '.json');
  }
  // Fetch Students List
  GetEventsList() {
    return this.http.get(
      'https://animalcalendar-82554-default-rtdb.firebaseio.com/'+ this.user.uid + '/events.json')
      .pipe(map(events => {
        let eventsData: CalendarEvent[] = [];
        for(let id in events) {
          if(events[id]!=null) {
            eventsData.push({ ...events[id], id});
          }
        }
        return eventsData;
    }));
  }
  /* Update Student Object
  UpdateStudent(event: CalendarEvent) {
    this.eventRef.update({
      title: 'New event',
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
      color: colors['red'],
      draggable: true,
      resizable: {
        beforeStart: true,
        afterEnd: true
      }
    });
  }
  // Delete Student Object
  DeleteStudent(id: string) {
    this.eventRef = this.db.object('students-list/' + id);
    this.eventRef.remove();
  } */
}