import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, Type } from '@angular/core';
import { ListRow } from '../../../modules/list/model/list-row';
import { ListsFacade } from '../../../modules/list/+state/lists.facade';
import { AlarmsFacade } from '../../../core/alarms/+state/alarms.facade';
import { AlarmDisplay } from '../../../core/alarms/alarm-display';
import { AlarmGroup } from '../../../core/alarms/alarm-group';
import { combineLatest, Observable, Subject } from 'rxjs';
import { Alarm } from '../../../core/alarms/alarm';
import { NzMessageService, NzModalService } from 'ng-zorro-antd';
import { TranslateService } from '@ngx-translate/core';
import { LocalizedDataService } from '../../../core/data/localized-data.service';
import { I18nToolsService } from '../../../core/tools/i18n-tools.service';
import { ItemDetailsPopup } from '../item-details/item-details-popup';
import { GatheredByComponent } from '../item-details/gathered-by/gathered-by.component';
import { filter, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { HuntingComponent } from '../item-details/hunting/hunting.component';
import { InstancesComponent } from '../item-details/instances/instances.component';
import { ReducedFromComponent } from '../item-details/reduced-from/reduced-from.component';
import { VendorsComponent } from '../item-details/vendors/vendors.component';
import { VenturesComponent } from '../item-details/ventures/ventures.component';
import { VoyagesComponent } from '../item-details/voyages/voyages.component';
import { TradesComponent } from '../item-details/trades/trades.component';
import { PermissionLevel } from '../../../core/database/permissions/permission-level.enum';
import { Character, XivapiService } from '@xivapi/angular-client';
import { UserService } from '../../../core/database/user.service';
import { AuthFacade } from '../../../+state/auth.facade';
import { RelationshipsComponent } from '../item-details/relationships/relationships.component';

@Component({
  selector: 'app-item-row',
  templateUrl: './item-row.component.html',
  styleUrls: ['./item-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemRowComponent implements OnInit {

  private _item: ListRow;

  @Input()
  public set item(item: ListRow) {
    this._item = item;
    this.item$.next(item);
  }

  public get item(): ListRow {
    return this._item;
  }

  private item$: Subject<ListRow> = new Subject<ListRow>();

  @Input()
  finalItem = false;

  @Input()
  odd = false;

  canBeCrafted$: Observable<boolean>;

  hasAllBaseIngredients$: Observable<boolean>;

  permissionLevel$: Observable<PermissionLevel> = this.listsFacade.selectedListPermissionLevel$;

  alarmGroups$: Observable<AlarmGroup[]> = this.alarmsFacade.allGroups$;

  userId$: Observable<string>;

  loggedIn$: Observable<boolean>;

  constructor(private listsFacade: ListsFacade, private alarmsFacade: AlarmsFacade,
              private messageService: NzMessageService, private translate: TranslateService,
              private modal: NzModalService, private l12n: LocalizedDataService,
              private i18n: I18nToolsService, private cdRef: ChangeDetectorRef,
              private userService: UserService, private xivapi: XivapiService,
              private authFacade: AuthFacade) {
    this.canBeCrafted$ = this.listsFacade.selectedList$.pipe(
      tap(() => this.cdRef.detectChanges()),
      map(list => list.canBeCrafted(this.item)),
      shareReplay(1)
    );

    this.userId$ = this.authFacade.userId$;
    this.loggedIn$ = this.authFacade.loggedIn$;

    this.hasAllBaseIngredients$ = combineLatest(this.canBeCrafted$, this.listsFacade.selectedList$
      .pipe(
        map(list => list.hasAllBaseIngredients(this.item))
      )
    ).pipe(
      map(([craftable, allIngredients]) => !craftable && this.item.amount > this.item.done && allIngredients)
    );
  }

  ngOnInit(): void {
    setTimeout(() => {
      this.cdRef.detectChanges();
    });
  }

  removeWorkingOnIt(): void {
    delete this.item.workingOnIt;
    this.listsFacade.updateItem(this.item, this.finalItem);
  }

  setWorkingOnIt(uid: string): void {
    this.item.workingOnIt = uid;
    this.listsFacade.updateItem(this.item, this.finalItem);
  }

  itemDoneChanged(newValue: number): void {
    this.listsFacade.setItemDone(this.item.id, this.item.icon, this.finalItem, newValue - this.item.done);
  }

  markAsDone(): void {
    this.listsFacade.setItemDone(this.item.id, this.item.icon, this.finalItem, this.item.amount - this.item.done);
  }

  toggleAlarm(display: AlarmDisplay): void {
    if (display.registered) {
      this.alarmsFacade.deleteAlarm(display.alarm);
    } else {
      this.alarmsFacade.addAlarms(display.alarm);
    }
  }

  success(key: string, args?: any): void {
    this.messageService.success(this.translate.instant(key, args));
  }

  addAlarmWithGroup(alarm: Alarm, group: AlarmGroup) {
    alarm.groupId = group.$key;
    this.alarmsFacade.addAlarms(alarm);
  }

  public openGatheredByPopup(): void {
    this.openDetailsPopup(GatheredByComponent);
  }

  public openHuntingPopup(): void {
    this.openDetailsPopup(HuntingComponent);
  }

  public openInstancesPopup(): void {
    this.openDetailsPopup(InstancesComponent);
  }

  public openReducedFromPopup(): void {
    this.openDetailsPopup(ReducedFromComponent);
  }

  public openVendorsPopup(): void {
    this.openDetailsPopup(VendorsComponent);
  }

  public openVenturesPopup(): void {
    this.openDetailsPopup(VenturesComponent);
  }

  public openVoyagesPopup(): void {
    this.openDetailsPopup(VoyagesComponent);
  }

  public openTradesPopup(): void {
    this.openDetailsPopup(TradesComponent);
  }

  public openRequirementsPopup(): void {
    this.openDetailsPopup(RelationshipsComponent);
  }

  private openDetailsPopup(component: Type<ItemDetailsPopup>): void {
    this.modal.create({
      nzTitle: this.i18n.getName(this.l12n.getItem(this.item.id)),
      nzContent: component,
      nzComponentParams: { item: this.item },
      nzFooter: null
    });
  }
}