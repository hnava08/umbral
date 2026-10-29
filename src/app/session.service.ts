import { Injectable, computed, signal } from '@angular/core';
import { ACCOUNTS } from './data';
import { Account } from './model';
import { Ledger } from './ledger.service';

const KEY = 'umbral_account';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly id = signal<string | null>(sessionStorage.getItem(KEY));

  readonly account = computed(() => {
    const id = this.id();
    return id ? this.ledger.account(id) : null;
  });

  readonly visible = computed(() => {
    const current = this.account();
    if (!current) {
      return [] as Account[];
    }
    if (current.role === 'admin') {
      return ACCOUNTS.filter((row) => row.role === 'client').map((row) => this.ledger.account(row.id)!);
    }
    if (current.role === 'reseller') {
      return ACCOUNTS.filter((row) => row.resellerId === current.id).map((row) => this.ledger.account(row.id)!);
    }
    return [current];
  });

  constructor(private readonly ledger: Ledger) {
    if (this.id() && !sessionStorage.getItem('umbral_token')) {
      this.leave();
    }
  }

  async enter(email: string, password: string): Promise<string | null> {
    try {
      const response = await fetch('http://127.0.0.1:8050/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        return 'That email or password does not match.';
      }
      const body = (await response.json()) as { token: string; accountId: string };
      this.id.set(body.accountId);
      sessionStorage.setItem(KEY, body.accountId);
      sessionStorage.setItem('umbral_token', body.token);
      await this.ledger.hydrate();
      return null;
    } catch {
      return 'The gateway on port 8050 is not answering.';
    }
  }

  leave(): void {
    this.id.set(null);
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem('umbral_token');
  }
}
