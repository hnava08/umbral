export type Role = 'admin' | 'reseller' | 'client';
export type Channel = 'sms' | 'whatsapp' | 'voice' | 'rcs';
export type Delivery = 'delivered' | 'failed' | 'pending';

export interface Account {
  id: string;
  email: string;
  password: string;
  role: Role;
  name: string;
  city: string;
  entityId: string;
  headers: string[];
  credits: number;
  loaded: number;
  lowAt: number;
  resellerId?: string;
  cli: string;
}

export interface Template {
  id: string;
  accountId: string;
  name: string;
  channel: Channel;
  header: string;
  body: string;
}

export interface Notice {
  id: string;
  accountId: string;
  at: string;
  channel: Channel;
  header: string;
  destination: string;
  state: Delivery;
  clicks: number;
  note: string;
}

export interface Invoice {
  id: string;
  accountId: string;
  on: string;
  credits: number;
  from: string;
}

export interface Step {
  text: string;
  seal: boolean;
}

export interface Review {
  clear: boolean;
  steps: Step[];
  templateName: string;
  cost: number;
  fallback: boolean;
}

export interface Draft {
  accountId: string;
  channel: Channel;
  header: string;
  body: string;
  destination: string;
  handset: boolean;
}
