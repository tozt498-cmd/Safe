// Ré-export des types système partagés + DTO côté renderer.
export type * from '../../../shared/types';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'revoked';
  hwid: string | null;
  hwidLabel: string | null;
  hwidRegisteredAt: string | null;
  createdAt: string;
  key: string | null;
  keyType: 'user' | 'admin' | null;
  plan: 'free' | 'pro';
}

export interface BroadcastPayload {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'update' | 'important';
  blocking: boolean;
  createdAt: string;
}

export interface LockdownState {
  active: boolean;
  title: string | null;
  body: string | null;
  kind: 'info' | 'update' | 'important';
}

export interface AdminKey {
  id: string;
  key: string;
  type: 'user' | 'admin';
  status: 'unused' | 'used' | 'revoked';
  note: string | null;
  created_at: string;
  used_at: string | null;
  used_by_email: string | null;
}

export interface AdminAccount {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'revoked';
  hwid: string | null;
  hwid_label: string | null;
  hwid_registered_at: string | null;
  created_at: string;
  activation_key: string | null;
}

export interface AdminStats {
  accounts: number;
  admins: number;
  keysTotal: number;
  keysUsed: number;
  keysFree: number;
  online: number;
}

export interface AdminBroadcast {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'update' | 'important';
  blocking: number;
  created_at: string;
  sender: string | null;
}
