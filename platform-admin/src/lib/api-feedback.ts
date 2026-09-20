// Merchant → platform feedback queue (platform side). Owner: B3.
import { http } from './api';

export const FEEDBACK_TYPES = ['bug', 'feature_request', 'question', 'ux', 'other'] as const;
export const FEEDBACK_STATUSES = ['open', 'investigating', 'planned', 'in_progress', 'resolved', 'wont_fix'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackNote {
  _id: string;
  by: string;
  byEmail?: string | null;
  at: string;
  text: string;
}

export interface FeedbackRow {
  _id: string;
  tenantId: string;
  tenant?: { name: string; slug: string } | null;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  type: FeedbackType;
  status: FeedbackStatus;
  subject: string;
  message: string;
  page?: string | null;
  browser?: string | null;
  attachments: string[];
  internalNotes?: FeedbackNote[];
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackQuery {
  type?: FeedbackType;
  status?: FeedbackStatus;
  tenantId?: string;
  page?: number;
  limit?: number;
}

export const feedbackApi = {
  list: async (params: FeedbackQuery = {}) => {
    const res = await http.get('/feedback', { params });
    return res.data.data as {
      items: FeedbackRow[];
      pagination: { total: number; page: number; pages: number; limit: number };
      counts: Partial<Record<FeedbackStatus, number>>;
    };
  },
  get: async (id: string) => {
    const res = await http.get(`/feedback/${id}`);
    return res.data.data as FeedbackRow;
  },
  updateStatus: async (
    id: string,
    body: { status: FeedbackStatus; resolution?: string; reason?: string; notifyMerchant?: boolean },
  ) => {
    const res = await http.patch(`/feedback/${id}/status`, body);
    return res.data.data as FeedbackRow;
  },
  addNote: async (id: string, text: string) => {
    const res = await http.post(`/feedback/${id}/notes`, { text });
    return res.data.data as FeedbackRow;
  },
};

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature_request: 'Feature request',
  question: 'Question',
  ux: 'UX feedback',
  other: 'Other',
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  planned: 'Planned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  wont_fix: "Won't fix",
};
