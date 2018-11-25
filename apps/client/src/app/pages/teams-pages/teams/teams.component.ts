import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { TeamsFacade } from '../../../modules/teams/+state/teams.facade';
import { Observable, BehaviorSubject } from 'rxjs';
import { Team } from '../../../model/team/team';
import { NzMessageService, NzModalService } from 'ng-zorro-antd';
import { TranslateService } from '@ngx-translate/core';
import { NameQuestionPopupComponent } from '../../../modules/name-question-popup/name-question-popup/name-question-popup.component';
import { filter, map, first, tap, switchMap, catchError } from 'rxjs/operators';
import { AuthFacade } from '../../../+state/auth.facade';
import { TeamInvite } from '../../../model/team/team-invite';
import { DiscordWebhookService } from '../../../core/discord/discord-webhook.service';

@Component({
  selector: 'app-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsComponent implements OnInit {

  myTeams$: Observable<Team[]> = this.teamsFacade.myTeams$;

  loading$: Observable<boolean> = this.teamsFacade.loading$;

  userId$: Observable<string> = this.authFacade.userId$;

  errorCode$: BehaviorSubject<string> = new BehaviorSubject(undefined);

  private teamInvitesCache: { [indexx: string]: Observable<TeamInvite[]> } = {};

  private redirectUri: string;

  public params: any;

  constructor(private teamsFacade: TeamsFacade, private dialog: NzModalService, private translate: TranslateService,
              private authFacade: AuthFacade, private discordWebhook: DiscordWebhookService,
              private message: NzMessageService, private route: ActivatedRoute, private router: Router,
              private http: HttpClient) {
    this.teamsFacade.loadMyTeams();
  }

  ngOnInit(): void {
    this.params = this.route.snapshot.queryParams;
    this.redirectUri = window.location.href.replace(/\?.*/, '');

    if (this.params.code && this.params.state) {
      this.http.get(`https://us-central1-ffxivteamcraft.cloudfunctions.net/create-webhook?code=${this.params.code}&redirect_uri=${this.redirectUri}`)
        .pipe(
          switchMap(response => {
            return this.myTeams$.pipe(
              map(teams => teams.find(team => team.$key === this.params.state)),
              first(team => team !== undefined),
              map((team: Team) => {
                team.webhook = response['webhook']['url'];
                this.updateTeam(team);
                this.testHook(team);
                this.router.navigate([]);
              })
            )
          })
        ).subscribe(() => {}, (error => this.errorCode$.next(error.error))
      );
    }
  }

  createTeam(): void {
    this.dialog.create({
      nzContent: NameQuestionPopupComponent,
      nzFooter: null,
      nzTitle: this.translate.instant('TEAMS.Create_team')
    }).afterClose.pipe(
      filter(name => name !== undefined),
      map(name => {
        const team = new Team();
        team.name = name;
        this.teamsFacade.createTeam(team);
      })
    ).subscribe();
  }

  getInvites(team: Team): Observable<TeamInvite[]> {
    if (this.teamInvitesCache[team.$key] === undefined) {
      this.teamInvitesCache[team.$key] = this.teamsFacade.getTeamInvites(team);
    }
    return this.teamInvitesCache[team.$key];
  }

  deleteInvite(invite: TeamInvite): void {
    this.teamsFacade.removeTeamInvite(invite.$key);
  }

  createInvite(team: Team, infinite: boolean): void {
    return this.teamsFacade.createTeamInvite(team, infinite);
  }

  testHook(team: Team): void {
    if (team.webhook !== undefined) {
      this.discordWebhook.sendMessage(team, 'TEAMS.NOTIFICATIONS.Webhook_setup_complete', { teamName: team.name });
    }
  }

  clearHook(team: Team): void {
    delete team.webhook;
    this.updateTeam(team);
  }

  renameTeam(team: Team): void {
    this.dialog.create({
      nzContent: NameQuestionPopupComponent,
      nzFooter: null,
      nzComponentParams: { baseName: team.name },
      nzTitle: this.translate.instant('TEAMS.Create_team')
    }).afterClose.pipe(
      filter(name => name !== undefined),
      map(name => {
        if (team.webhook !== undefined) {
          this.discordWebhook.sendMessage(team, 'TEAMS.NOTIFICATIONS.Name_changed', {
            oldName: team.name,
            newName: name
          });
        }
        team.name = name;
        this.teamsFacade.updateTeam(team);
      })
    ).subscribe();
  }

  removeMember(team: Team, memberId: string): void {
    team.members = team.members.filter(member => member !== memberId);
    if (team.webhook !== undefined) {
      this.discordWebhook.notifyMemberKicked(team, memberId);
    }
    this.updateTeam(team);
  }

  updateTeam(team: Team): void {
    this.teamsFacade.updateTeam(team);
  }

  deleteTeam(team: Team): void {
    this.teamsFacade.deleteTeam(team.$key);
  }

  success(message: string): void {
    this.message.success(this.translate.instant(message));
  }

  trackByTeam(index: number, team: Team): string {
    return team.$key;
  }

  oauthUrl(team: Team): string {
    return this.discordWebhook.oauthUrl(team.$key, this.redirectUri);
  }
}