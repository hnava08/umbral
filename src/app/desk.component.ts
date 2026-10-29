import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NOW, RATES, mask } from './data';
import { Ledger } from './ledger.service';
import { Channel, Draft } from './model';
import { fill } from './scrub';
import { Session } from './session.service';

@Component({
  selector: 'app-desk',
  imports: [ReactiveFormsModule],
  templateUrl: './desk.component.html',
})
export class DeskComponent {
  readonly session = inject(Session);
  private readonly ledger = inject(Ledger);
  private readonly forms = inject(FormBuilder);

  readonly channels: Channel[] = ['sms', 'whatsapp', 'voice', 'rcs'];
  readonly now = NOW;
  readonly mask = mask;
  readonly queued = signal('');

  readonly form = this.forms.nonNullable.group({
    accountId: ['asha', Validators.required],
    channel: ['sms' as Channel, Validators.required],
    header: ['PROMO', Validators.required],
    body: ['Your appointment at Koregaon Park is on 2 Nov. Reply YES to confirm.', Validators.required],
    destination: ['9812345521', Validators.required],
    handset: [false],
  });

  readonly values = signal(this.form.getRawValue());
  readonly accounts = computed(() => this.session.visible());

  readonly account = computed(() => {
    const id = this.values().accountId;
    return this.accounts().find((row) => row.id === id) ?? this.accounts()[0] ?? null;
  });

  readonly tariff = computed(() => RATES[this.values().channel]);

  readonly recent = computed(() => {
    const account = this.account();
    if (!account) {
      return [];
    }
    return this.ledger
      .notices()
      .filter((row) => row.accountId === account.id)
      .slice()
      .reverse()
      .slice(0, 6);
  });

  readonly review = computed(() => {
    const account = this.account();
    const values = this.values();
    if (!account) {
      return null;
    }
    return this.ledger.review(this.draft(account.id, values));
  });

  constructor() {
    const first = this.session.visible()[0];
    if (first && this.session.account()?.role === 'client') {
      this.form.controls.accountId.setValue(first.id);
    }
    this.form.valueChanges.subscribe(() => {
      this.values.set(this.form.getRawValue());
      this.queued.set('');
    });
  }

  label(channel: Channel): string {
    if (channel === 'sms') {
      return 'SMS';
    }
    if (channel === 'whatsapp') {
      return 'WhatsApp';
    }
    if (channel === 'voice') {
      return 'Voice';
    }
    return 'RCS';
  }

  setChannel(channel: Channel): void {
    this.form.controls.channel.setValue(channel);
  }

  load(): void {
    const account = this.account();
    if (!account) {
      return;
    }
    const channel = this.form.controls.channel.value;
    const template =
      this.ledger.templates.find((row) => row.accountId === account.id && row.channel === channel) ??
      this.ledger.templates.find((row) => row.accountId === account.id);
    if (!template) {
      return;
    }
    const first = account.id === 'vega' ? 'the clutch' : 'Koregaon Park';
    this.form.patchValue({
      header: template.header,
      channel: template.channel,
      body: fill(template.body, first, '2 Nov'),
    });
  }

  send(): void {
    const account = this.account();
    if (!account) {
      return;
    }
    void this.ledger.queue(this.draft(account.id, this.form.getRawValue())).then((result) => {
      if (result.notice) {
        this.queued.set(`${result.notice.id} left the wallet. ${result.notice.note}`);
        return;
      }
      this.queued.set(result.error);
    });
  }

  private draft(accountId: string, values: ReturnType<typeof this.form.getRawValue>): Draft {
    return {
      accountId,
      channel: values.channel,
      header: values.header,
      body: values.body,
      destination: values.destination,
      handset: values.handset,
    };
  }
}
