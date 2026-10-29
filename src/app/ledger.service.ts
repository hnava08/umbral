import { Injectable, computed, signal } from '@angular/core';
import { ACCOUNTS, INVOICES, NOTICES, TEMPLATES } from './data';
import { Account, Draft, Invoice, Notice, Review, Template } from './model';
import { scrub } from './scrub';

interface State {
  balances: Record<string, number>;
  loaded: Record<string, number>;
  notices: Notice[];
  invoices: Invoice[];
  seq: number;
  invoiceSeq: number;
}

const API = 'http://127.0.0.1:8050';

function seed(): State {
  return {
    balances: Object.fromEntries(ACCOUNTS.map((row) => [row.id, row.credits])),
    loaded: Object.fromEntries(ACCOUNTS.map((row) => [row.id, row.loaded])),
    notices: NOTICES.map((row) => ({ ...row })),
    invoices: INVOICES.map((row) => ({ ...row })),
    seq: 110,
    invoiceSeq: 23,
  };
}

@Injectable({ providedIn: 'root' })
export class Ledger {
  private readonly state = signal<State>(seed());

  readonly notices = computed(() => this.state().notices);
  readonly invoices = computed(() => this.state().invoices);
  readonly templates: Template[] = TEMPLATES;

  constructor() {
    void this.hydrate();
  }

  async hydrate(): Promise<void> {
    try {
      const response = await fetch(`${API}/api/state`);
      if (!response.ok) {
        return;
      }
      this.state.set((await response.json()) as State);
    } catch {
      return;
    }
  }

  account(id: string): Account | null {
    const base = ACCOUNTS.find((row) => row.id === id);
    if (!base) {
      return null;
    }
    const current = this.state();
    return {
      ...base,
      credits: current.balances[id] ?? base.credits,
      loaded: current.loaded[id] ?? base.loaded,
    };
  }

  review(draft: Draft): Review | null {
    const account = this.account(draft.accountId);
    if (!account) {
      return null;
    }
    return scrub({
      draft,
      account,
      templates: this.templates,
      notices: this.state().notices,
      balance: account.credits,
    });
  }

  async queue(draft: Draft): Promise<{ notice: Notice | null; error: string }> {
    const review = this.review(draft);
    if (!review) {
      return { notice: null, error: 'That account is not on this desk.' };
    }
    if (!review.clear) {
      const seal = review.steps.find((step) => step.seal);
      return { notice: null, error: seal?.text ?? 'Held.' };
    }
    try {
      const response = await fetch(`${API}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('umbral_token') ?? ''}`,
        },
        body: JSON.stringify(draft),
      });
      const body = (await response.json()) as { notice: Notice | null; error?: string; state?: State };
      if (body.state) {
        this.state.set(body.state);
      }
      return { notice: body.notice ?? null, error: body.error || (response.ok ? '' : 'The gateway refused the message.') };
    } catch {
      return { notice: null, error: 'The gateway on port 8050 is not answering.' };
    }
  }

  async sell(clientId: string, amount: number): Promise<string | null> {
    try {
      const response = await fetch(`${API}/api/wallet/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('umbral_token') ?? ''}`,
        },
        body: JSON.stringify({ clientId, amount }),
      });
      const body = (await response.json()) as { error?: string | null; state?: State };
      if (body.state) {
        this.state.set(body.state);
      }
      return body.error || null;
    } catch {
      return 'The gateway on port 8050 is not answering.';
    }
  }

  async click(id: string): Promise<void> {
    try {
      const response = await fetch(`${API}/api/notices/${id}/click`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('umbral_token') ?? ''}` },
      });
      const body = (await response.json()) as { state?: State };
      if (body.state) {
        this.state.set(body.state);
      }
    } catch {
      return;
    }
  }
}
