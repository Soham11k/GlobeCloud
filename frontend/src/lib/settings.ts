import { api } from "./api";

export type BillingStatus = {
  plan_tier: string;
  status: string;
  period_end: string | null;
};

export type ApiKeyRow = {
  id: string;
  label: string;
  created_at: string | null;
  last_used_at: string | null;
};

export type OrgMember = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  joined_at: string | null;
};

export type OrgInvite = {
  id: string;
  email: string;
  role: string;
  created_at: string | null;
  expires_at: string | null;
};

export function fetchBillingStatus() {
  return api<BillingStatus>("/billing/status");
}

export function startCheckout(plan: string) {
  return api<{ checkout_url: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export function openBillingPortal() {
  return api<{ portal_url: string }>("/billing/portal", { method: "POST" });
}

export function fetchApiKeys() {
  return api<{ keys: ApiKeyRow[] }>("/settings/api-keys");
}

export function createApiKey(label: string) {
  return api<{ id: string; label: string; key: string; message: string }>("/settings/api-keys", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function revokeApiKey(keyId: string) {
  return api<{ ok: boolean }>(`/settings/api-keys/${keyId}`, { method: "DELETE" });
}

export function fetchMembers() {
  return api<{ members: OrgMember[]; invites: OrgInvite[] }>("/settings/members");
}

export function inviteMember(email: string, role: string) {
  return api<{ ok: boolean; message: string }>("/settings/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function updateMemberRole(memberId: string, role: string) {
  return api<{ ok: boolean }>(`/settings/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeMember(memberId: string) {
  return api<{ ok: boolean }>(`/settings/members/${memberId}`, { method: "DELETE" });
}
