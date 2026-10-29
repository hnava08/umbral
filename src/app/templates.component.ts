import { Component, computed, inject } from '@angular/core';
import { ACCOUNTS } from './data';
import { Ledger } from './ledger.service';
import { Session } from './session.service';

@Component({
  selector: 'app-templates',
  templateUrl: './templates.component.html',
})
export class TemplatesComponent {
  private readonly session = inject(Session);
  private readonly ledger = inject(Ledger);

  readonly rows = computed(() => {
    const ids = new Set(this.session.visible().map((row) => row.id));
    return this.ledger.templates
      .filter((row) => ids.has(row.accountId))
      .map((row) => ({
        ...row,
        account: ACCOUNTS.find((account) => account.id === row.accountId)?.name ?? '',
      }));
  });
}
