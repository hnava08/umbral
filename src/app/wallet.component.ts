import { Component, computed, inject } from '@angular/core';
import { Ledger } from './ledger.service';
import { Session } from './session.service';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  private readonly session = inject(Session);
  private readonly ledger = inject(Ledger);

  readonly role = computed(() => this.session.account()?.role);
  readonly clients = computed(() => this.session.visible());
  readonly sold = computed(() => this.clients().reduce((sum, row) => sum + row.loaded, 0));
  readonly bought = computed(() => this.ledger.account('deccan')?.loaded ?? 0);
  readonly extra = computed(() => this.sold() - this.bought());
  readonly short = computed(() => this.clients().find((row) => row.credits < row.lowAt) ?? null);

  readonly bills = computed(() => {
    const ids = new Set(this.clients().map((row) => row.id));
    if (this.role() !== 'client') {
      ids.add('deccan');
    }
    return this.ledger.invoices().filter((row) => ids.has(row.accountId));
  });

  readonly billTotal = computed(() => this.bills().reduce((sum, row) => sum + row.credits, 0));

  name(id: string): string {
    return this.ledger.account(id)?.name ?? id;
  }

  sell(): void {
    const row = this.short();
    if (!row || this.role() === 'client') {
      return;
    }
    this.ledger.sell(row.id, 200);
  }
}
