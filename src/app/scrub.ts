import { RATES } from './data';
import { Account, Draft, Notice, Review, Template } from './model';

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matches(template: string, text: string): boolean {
  const parts = template.split('{#var#}').map(escape);
  const expression = new RegExp(`^${parts.join('(.{1,30}?)')}$`);
  const found = text.trim().match(expression);
  if (!found) {
    return false;
  }
  return found.slice(1).every((variable) => {
    const clean = variable.trim();
    return clean.length > 0 && clean.length <= 30 && !clean.includes('{#');
  });
}

export function fill(body: string, first: string, second: string): string {
  return body.replace('{#var#}', first).replace('{#var#}', second);
}

function sessionOpen(notices: Notice[], accountId: string, destination: string): boolean {
  return notices.some(
    (row) =>
      row.accountId === accountId &&
      row.channel === 'whatsapp' &&
      row.state === 'delivered' &&
      row.destination === destination,
  );
}

export function scrub(input: {
  draft: Draft;
  account: Account;
  templates: Template[];
  notices: Notice[];
  balance: number;
}): Review {
  const header = input.draft.header.trim().toUpperCase();
  const body = input.draft.body.trim();
  const destination = input.draft.destination.replace(/\D/g, '');
  const channel = input.draft.channel;
  const names: Record<typeof channel, string> = {
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    voice: 'voice',
    rcs: 'RCS',
  };
  const allowed = input.account.headers.join(' or ');
  const steps = [
    {
      text: `${input.account.name} in ${input.account.city}. The register lists entity ${input.account.entityId} and header ${allowed}.`,
      seal: false,
    },
  ];

  const fail = (text: string): Review => {
    steps.push({ text, seal: true });
    return { clear: false, steps, templateName: '', cost: 0, fallback: false };
  };

  if (!header || !input.account.headers.includes(header)) {
    return fail(
      `${header || 'A blank header'} cannot leave this account. ${input.account.name} may send only as ${allowed}.`,
    );
  }
  steps.push({ text: `${header} is on that register.`, seal: false });

  if (!/^[6-9]\d{9}$/.test(destination)) {
    return fail(
      `An Indian mobile is 10 digits and starts with 6, 7, 8 or 9. ${destination || 'This field'} is not one.`,
    );
  }
  steps.push({ text: `${destination} is a 10-digit mobile.`, seal: false });

  if (!body) {
    return fail('The message box is empty, so there is nothing to match against an approved text.');
  }

  const own = input.templates.filter(
    (row) => row.accountId === input.account.id && row.channel === channel && row.header === header,
  );
  const found = own.find((row) => matches(row.body, body));
  const open =
    channel === 'whatsapp' && sessionOpen(input.notices, input.account.id, destination);
  let templateName = '';

  if (found) {
    templateName = found.name;
    steps.push({
      text: `The words match the approved text “${found.name}” (${found.id}) on ${header}.`,
      seal: false,
    });
  } else if (open) {
    templateName = 'Session';
    steps.push({
      text: `${destination} already has a delivered WhatsApp from ${input.account.name}, so this reply can go without a new template.`,
      seal: false,
    });
  } else {
    return fail(`These words are not an approved ${names[channel]} text on ${header}.`);
  }

  const fallback = channel === 'rcs' && !input.draft.handset;
  const cost = fallback || templateName === 'Session' ? RATES.sms : RATES[channel];

  if (fallback) {
    steps.push({
      text: `This handset is not marked for RCS. If the text clears, it leaves as SMS and costs ${RATES.sms} credit.`,
      seal: false,
    });
  }

  if (input.balance < cost) {
    return fail(`${input.account.name} has ${input.balance} credits left. This send needs ${cost}.`);
  }

  const leaving = fallback ? 'SMS' : templateName === 'Session' ? 'the open WhatsApp session' : names[channel];
  steps.push({
    text: `Clear to queue. ${cost} credit${cost === 1 ? '' : 's'} leave the wallet, sent as ${leaving}.`,
    seal: true,
  });
  return { clear: true, steps, templateName, cost, fallback };
}
