import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  TemplateRef,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import {
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  endOfMonth,
  isSameDay,
  isSameMonth,
  addHours,
} from 'date-fns';
import { Subject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import { CrudService } from '../../shared/services/crud.service';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: [
    '../../../../node_modules/bootstrap/dist/css/bootstrap.min.css',
    "../../../../node_modules/angular-calendar/css/angular-calendar.css",
    "../../../../node_modules/flatpickr/dist/flatpickr.min.css",
    'calendar.component.scss',
  ],
  templateUrl: './calendar.component.html',
  })
export class CalendarComponent implements OnInit {
  @ViewChild('modalContent', { static: true }) modalContent: TemplateRef<any>;
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = new Date();
  events: CalendarEvent[] = []; 
  error = '';
  constructor(private modal: NgbModal, private crudService: CrudService, private detector: ChangeDetectorRef) {}
  ngOnInit(): void {
    this.crudService.GetEventsList().subscribe({ next: data => {
      this.events = data;
      this.error = '';
      this.detector.markForCheck();
      this.refresh.next();
    }, error: error => { this.error = error.message; this.detector.markForCheck(); this.refresh.next(); } });
  }
  modalData: {
    action: string;
    event: CalendarEvent;
  };
  refresh = new Subject<void>();
  activeDayIsOpen: boolean = true;
  public eventForm: FormGroup;

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (isSameMonth(date, this.viewDate)) {
      if (
        (isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
      }
      this.viewDate = date;
    }
  }

  eventTimesChanged({
    event,
    newStart,
    newEnd,
  }: CalendarEventTimesChangedEvent): void {
    this.persist({ ...event, start: newStart, end: newEnd });
  }

  handleEvent(action: string, event: CalendarEvent): void {
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  deleteEvent(eventToDelete: CalendarEvent) {
    this.persist(eventToDelete, true);
  }

  private async persist(event: CalendarEvent, deleted = false) {
    try {
      const saved = await this.crudService.saveEvent(event, deleted);
      this.events = deleted ? this.events.filter(item => item.id !== event.id)
        : this.events.map(item => item.id === event.id ? saved : item);
      this.error = '';
    } catch (error: any) { this.error = error.message; }
    this.detector.markForCheck();
    this.refresh.next();
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  closeOpenMonthViewDay() {
    this.activeDayIsOpen = false;
  }
  
}
