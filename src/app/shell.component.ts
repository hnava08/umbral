import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Session } from './session.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly account = this.session.account;
  readonly screen = signal('Desk');

  constructor() {
    const name = (url: string) => {
      if (url.includes('wallet')) return 'Wallet';
      if (url.includes('report')) return 'Report';
      if (url.includes('templates')) return 'Templates';
      return 'Desk';
    };
    this.screen.set(name(this.router.url));
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.screen.set(name((event as NavigationEnd).urlAfterRedirects));
    });
  }

  close(): void {
    this.menuOpen.set(false);
  }

  leave(): void {
    this.session.leave();
    void this.router.navigateByUrl('/sign-in');
  }
}
