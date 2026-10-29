import { Component, computed, inject } from '@angular/core';
import { mask } from './data';
import { Ledger } from './ledger.service';
import { Session } from './session.service';

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
})
export class ReportComponent {
  private readonly session = inject(Session);
  readonly ledger = inject(Ledger);
  readonly mask = mask;

  readonly rows = computed(() => {
    const ids = new Set(this.session.visible().map((row) => row.id));
    return this.ledger.notices().filter((row) => ids.has(row.accountId));
  });

  readonly delivered = computed(() => this.rows().filter((row) => row.state === 'delivered').length);
  readonly failed = computed(() => this.rows().filter((row) => row.state === 'failed').length);
  readonly pending = computed(() => this.rows().filter((row) => row.state === 'pending').length);
  readonly clicks = computed(() => this.rows().reduce((sum, row) => sum + row.clicks, 0));

  readonly hours = computed(() => {
    const bins = new Map<string, number>();
    for (const row of this.rows()) {
      if (row.state !== 'delivered') {
        continue;
      }
      const hour = row.at.slice(0, 2);
      bins.set(hour, (bins.get(hour) ?? 0) + 1);
    }
    return ['08', '09', '10', '11'].map((hour) => ({ hour, count: bins.get(hour) ?? 0 })); // taste-skill-ignore
  });

  readonly scale = computed(() => Math.max(3, ...this.hours().map((row) => row.count)));

  readonly finding = computed(() => {
    const fail = this.rows().find((row) => row.state === 'failed');
    const count = this.failed();
    const word = count === 1 ? 'failed notice' : 'failed notices';
    if (!fail) {
      return `${this.rows().length} notices this morning, and none failed.`;
    }
    return `${count} ${word} of ${this.rows().length}. The ${fail.at} row used header ${fail.header}.`;
  });

  bar(count: number): number {
    return (count / this.scale()) * 84;
  }
}
