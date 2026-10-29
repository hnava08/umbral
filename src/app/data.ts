import { Account, Invoice, Notice, Template } from './model';

export const NOW = '11:52';

export const RATES: Record<'sms' | 'whatsapp' | 'voice' | 'rcs', number> = {
  sms: 1,
  whatsapp: 2,
  voice: 3,
  rcs: 2,
};

export const ACCOUNTS: Account[] = [
  {
    id: 'sagar',
    email: 'meera@sagar.demo',
    password: 'umbral',
    role: 'admin',
    name: 'Sagar Telemedia',
    city: 'Mumbai',
    entityId: '1201100000000001',
    headers: ['SAGART'],
    credits: 50000,
    loaded: 50000,
    lowAt: 1000,
    cli: '+91 22 4890 1100',
  },
  {
    id: 'deccan',
    email: 'arjun@deccan.demo',
    password: 'umbral',
    role: 'reseller',
    name: 'Deccan Relay',
    city: 'Pune',
    entityId: '1201100000000002',
    headers: ['DECCAN'],
    credits: 6000,
    loaded: 6000,
    lowAt: 500,
    cli: '+91 20 6761 1000',
  },
  {
    id: 'asha',
    email: 'ananya@asha.demo',
    password: 'umbral',
    role: 'client',
    name: 'Asha Clinic',
    city: 'Pune',
    entityId: '1201159876543210',
    headers: ['ASHA01'],
    credits: 1840,
    loaded: 5000,
    lowAt: 500,
    resellerId: 'deccan',
    cli: '+91 20 6761 1400',
  },
  {
    id: 'vega',
    email: 'karthik@vega.demo',
    password: 'umbral',
    role: 'client',
    name: 'Vega Motors',
    city: 'Kochi',
    entityId: '1201161234567890',
    headers: ['VEGA01'],
    credits: 420,
    loaded: 2000,
    lowAt: 500,
    resellerId: 'deccan',
    cli: '+91 484 401 2200',
  },
];

export const TEMPLATES: Template[] = [
  {
    id: 'T-14',
    accountId: 'asha',
    name: 'Appointment',
    channel: 'sms',
    header: 'ASHA01',
    body: 'Your appointment at {#var#} is on {#var#}. Reply YES to confirm.',
  },
  {
    id: 'T-15',
    accountId: 'asha',
    name: 'Report ready',
    channel: 'whatsapp',
    header: 'ASHA01',
    body: 'Hello {#var#}, your report is ready at {#var#}.',
  },
  {
    id: 'T-18',
    accountId: 'asha',
    name: 'Visit confirmed',
    channel: 'rcs',
    header: 'ASHA01',
    body: 'Asha Clinic. {#var#}, your visit on {#var#} is confirmed.',
  },
  {
    id: 'T-21',
    accountId: 'vega',
    name: 'Collection',
    channel: 'sms',
    header: 'VEGA01',
    body: 'Your job {#var#} can be collected on {#var#}.',
  },
  {
    id: 'T-22',
    accountId: 'vega',
    name: 'Vehicle ready',
    channel: 'voice',
    header: 'VEGA01',
    body: 'Vega Motors. Your vehicle {#var#} is ready on {#var#}.',
  },
];

export const NOTICES: Notice[] = [
  { id: 'N-101', accountId: 'asha', at: '08:14', channel: 'sms', header: 'ASHA01', destination: '9812345521', state: 'delivered', clicks: 0, note: '' },
  { id: 'N-102', accountId: 'asha', at: '08:41', channel: 'sms', header: 'ASHA01', destination: '9844012244', state: 'delivered', clicks: 2, note: 'umbral.in/a41' },
  { id: 'N-103', accountId: 'asha', at: '08:55', channel: 'whatsapp', header: 'ASHA01', destination: '9812345521', state: 'delivered', clicks: 0, note: 'Session opened' },
  { id: 'N-104', accountId: 'asha', at: '09:02', channel: 'sms', header: 'PROMO', destination: '9812345521', state: 'failed', clicks: 0, note: 'Header not approved' },
  { id: 'N-105', accountId: 'vega', at: '09:18', channel: 'sms', header: 'VEGA01', destination: '9895012290', state: 'delivered', clicks: 0, note: '' },
  { id: 'N-106', accountId: 'asha', at: '10:05', channel: 'whatsapp', header: 'ASHA01', destination: '9822011217', state: 'pending', clicks: 0, note: 'Waiting on the handset' },
  { id: 'N-107', accountId: 'asha', at: '10:22', channel: 'sms', header: 'ASHA01', destination: '9812345521', state: 'delivered', clicks: 0, note: '' },
  { id: 'N-108', accountId: 'vega', at: '11:10', channel: 'voice', header: 'VEGA01', destination: '9847012203', state: 'failed', clicks: 0, note: 'No answer' },
  { id: 'N-109', accountId: 'asha', at: '11:40', channel: 'rcs', header: 'ASHA01', destination: '9844012244', state: 'delivered', clicks: 1, note: 'umbral.in/r40' },
];

export const INVOICES: Invoice[] = [
  { id: 'INV-19', accountId: 'deccan', on: '2 Oct 2026', credits: 6000, from: 'Sagar Telemedia' },
  { id: 'INV-21', accountId: 'asha', on: '4 Oct 2026', credits: 5000, from: 'Deccan Relay' },
  { id: 'INV-22', accountId: 'vega', on: '6 Oct 2026', credits: 2000, from: 'Deccan Relay' },
];

export function mask(destination: string): string {
  const digits = destination.replace(/\D/g, '');
  if (digits.length < 4) {
    return destination;
  }
  return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
}

function deliveredByHour(rows: Notice[]): number[] {
  const bins = [0, 0, 0, 0];
  const hours = ['08', '09', '10', '11']; // taste-skill-ignore
  for (const row of rows) {
    if (row.state !== 'delivered') {
      continue;
    }
    const index = hours.indexOf(row.at.slice(0, 2));
    if (index >= 0) {
      bins[index] += 1;
    }
  }
  return bins;
}

const delivered = NOTICES.filter((row) => row.state === 'delivered');
const bins = deliveredByHour(NOTICES);
console.assert(bins.reduce((sum, value) => sum + value, 0) === delivered.length);
console.assert(NOTICES.filter((row) => row.state === 'failed').length === 2);
console.assert(NOTICES.filter((row) => row.state === 'pending').length === 1);
console.assert(NOTICES.reduce((sum, row) => sum + row.clicks, 0) === 3);
const sold = ACCOUNTS.filter((row) => row.resellerId === 'deccan').reduce((sum, row) => sum + row.loaded, 0);
const bought = ACCOUNTS.find((row) => row.id === 'deccan')?.loaded ?? 0;
console.assert(sold - bought === 1000);
console.assert(INVOICES.filter((row) => row.accountId !== 'deccan').reduce((sum, row) => sum + row.credits, 0) === sold);
