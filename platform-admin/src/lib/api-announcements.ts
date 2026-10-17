// Platform announcements to stores (PBI 10-46). Mirrors routes/platform/announcements.js.
import { http, unwrapData as d } from './api';

export type TextPair = { ar: string; en: string };
export type AnnouncementTarget = { target: 'all' } | { target: 'tenant'; tenantId: string };
export interface AnnouncementChannels {
  app: boolean;
  email: boolean;
}

export interface Audience {
  stores: number;
  recipients: number;
  app: number;
  devices: number;
  email: number;
  pushReady: boolean;
  emailReady: boolean;
}

export interface Announcement {
  id: string;
  title: TextPair;
  body: TextPair;
  link: string | null;
  channels: AnnouncementChannels;
  target: 'all' | 'tenant';
  tenantId: string | null;
  tenantName: string | null;
  status: 'sending' | 'sent' | 'failed';
  audience: { stores: number; recipients: number; app: number; devices: number; email: number };
  delivered: { stores: number; app: number; email: number; failed: number };
  error: string | null;
  createdByEmail: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export const announcementsApi = {
  list: () => d<{ announcements: Announcement[] }>(http.get('/announcements')),
  audience: (t: AnnouncementTarget) => d<Audience>(http.get('/announcements/audience', { params: t })),
  send: (body: AnnouncementTarget & { title: TextPair; body: TextPair; link: string | null; channels: AnnouncementChannels }) =>
    d<Announcement>(http.post('/announcements', body)),
};
