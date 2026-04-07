const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("sakanmatch_token");
}

async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_ORIGIN}${BASE}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.error || "Request failed");
  }

  return res.json() as Promise<T>;
}

export interface UserProfileData {
  fullName?: string | null;
  age?: number | null;
  gender?: "male" | "female" | "other" | null;
  occupation?: string | null;
  cleanlinessLevel?: "very_clean" | "clean" | "moderate" | "relaxed" | null;
  sleepSchedule?: "early_bird" | "night_owl" | "flexible" | null;
  noiseTolerance?: "quiet" | "moderate" | "loud" | null;
  guestPreference?: "rarely" | "sometimes" | "often" | null;
  petPreference?: "love_pets" | "no_pets" | "no_preference" | null;
  bio?: string | null;
  moveInDate?: string | null;
  avatarUrl?: string | null;
}

export interface UserProfileResponse {
  id: number;
  userId: number;
  fullName: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  cleanlinessLevel: string | null;
  sleepSchedule: string | null;
  noiseTolerance: string | null;
  guestPreference: string | null;
  petPreference: string | null;
  bio: string | null;
  moveInDate: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

export interface FullProfileResponse {
  profile: UserProfileResponse | null;
  preferences: PreferencesResponse | null;
}

export interface PublicProfileResponse {
  user: { id: number; name: string | null; email: string; isPremium?: boolean; role?: string };
  profile: UserProfileResponse | null;
  preferences: PreferencesResponse | null;
}

export interface PeopleMatchResult {
  userId: number;
  name: string | null;
  email: string;
  profile: {
    fullName: string | null;
    age: number | null;
    gender: string | null;
    occupation: string | null;
    cleanlinessLevel: string | null;
    sleepSchedule: string | null;
    noiseTolerance: string | null;
    guestPreference: string | null;
    petPreference: string | null;
    bio: string | null;
    moveInDate: string | null;
    avatarUrl: string | null;
  };
  preferences: {
    city: string | null;
    budgetMin: string | null;
    budgetMax: string | null;
    lifestyle: string | null;
    smoking: string | null;
    genderPref: string | null;
  };
  score: number;
  matchReasons: string[];
}

export interface PreferencesPayload {
  city?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  lifestyle?: string | null;
  smoking?: string | null;
  genderPref?: string | null;
  wantedAmenities?: string[];
}

export interface PreferencesResponse {
  id: number;
  userId: number;
  city: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  lifestyle: string | null;
  smoking: string | null;
  genderPref: string | null;
  wantedAmenities: string[];
  updatedAt: string;
}

export interface FavoriteListing {
  id: number;
  title: string;
  price: number;
  city: string;
  images: string[] | null;
  ownerId: number;
  ownerEmail: string | null;
  ownerName: string | null;
  createdAt: string;
}

export interface RequestItem {
  id: number;
  seekerId: number;
  listingId: number;
  status: "pending" | "accepted" | "declined";
  message: string | null;
  createdAt: string;
  updatedAt: string;
  seekerEmail: string | null;
  seekerName: string | null;
  listingTitle: string | null;
  listingCity: string | null;
}

export interface Conversation {
  otherId: number;
  otherEmail: string | null;
  otherName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface MessageItem {
  id: number;
  senderId: number;
  receiverId: number;
  listingId: number | null;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface ChatRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  updatedAt: string;
  senderName: string | null;
  senderAvatar: string | null;
  receiverName: string | null;
  receiverAvatar: string | null;
}

export const api = {
  getPreferences: () => apiFetch<PreferencesResponse | null>("/preferences"),
  updatePreferences: (data: PreferencesPayload) =>
    apiFetch<PreferencesResponse>("/preferences", { method: "PUT", body: JSON.stringify(data) }),

  getFavorites: () => apiFetch<FavoriteListing[]>("/favorites"),
  getFavoriteIds: () => apiFetch<number[]>("/favorites/ids"),
  addFavorite: (listingId: number) => apiFetch(`/favorites/${listingId}`, { method: "POST" }),
  removeFavorite: (listingId: number) => apiFetch(`/favorites/${listingId}`, { method: "DELETE" }),

  getRequests: () => apiFetch<RequestItem[]>("/requests"),
  sendRequest: (data: { listingId: number; message?: string }) =>
    apiFetch<RequestItem>("/requests", { method: "POST", body: JSON.stringify(data) }),
  updateRequestStatus: (id: number, status: "accepted" | "declined") =>
    apiFetch<RequestItem>(`/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getConversations: () => apiFetch<Conversation[]>("/messages/conversations"),
  getThread: (otherId: number) => apiFetch<MessageItem[]>(`/messages/thread/${otherId}`),
  sendMessage: (data: { receiverId: number; listingId?: number; body: string }) =>
    apiFetch<MessageItem>("/messages", { method: "POST", body: JSON.stringify(data) }),

  getProfile: () => apiFetch<FullProfileResponse>("/profile"),
  updateProfile: (data: UserProfileData) =>
    apiFetch<FullProfileResponse>("/profile", { method: "PUT", body: JSON.stringify(data) }),
  getPublicProfile: (userId: number) => apiFetch<PublicProfileResponse>(`/profile/${userId}`),

  getPeopleMatches: (filters?: { city?: string; lifestyle?: string }) => {
    const params = new URLSearchParams();
    if (filters?.city) params.set("city", filters.city);
    if (filters?.lifestyle) params.set("lifestyle", filters.lifestyle);
    const qs = params.toString();
    return apiFetch<PeopleMatchResult[]>(`/matches/people${qs ? `?${qs}` : ""}`);
  },

  sendChatRequest: (receiverId: number) =>
    apiFetch<ChatRequest>("/chat-requests", { method: "POST", body: JSON.stringify({ receiverId }) }),
  getIncomingChatRequests: () =>
    apiFetch<ChatRequest[]>("/chat-requests/incoming"),
  getOutgoingChatRequests: () =>
    apiFetch<ChatRequest[]>("/chat-requests/outgoing"),
  getChatRequestBetween: (otherId: number) =>
    apiFetch<ChatRequest | null>(`/chat-requests/between/${otherId}`),
  acceptChatRequest: (id: number) =>
    apiFetch<ChatRequest>(`/chat-requests/${id}/accept`, { method: "PATCH" }),
  declineChatRequest: (id: number) =>
    apiFetch<{ ok: boolean }>(`/chat-requests/${id}/decline`, { method: "PATCH" }),
  cancelChatRequest: (id: number) =>
    apiFetch<{ ok: boolean }>(`/chat-requests/${id}/cancel`, { method: "PATCH" }),

  getListings: (params?: { city?: string; minPrice?: number; maxPrice?: number }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set("city", params.city);
    if (params?.minPrice !== undefined) qs.set("minPrice", String(params.minPrice));
    if (params?.maxPrice !== undefined) qs.set("maxPrice", String(params.maxPrice));
    const q = qs.toString();
    return apiFetch<import("@workspace/api-client-react").ListingResponse[]>(`/listings${q ? `?${q}` : ""}`);
  },

  reportListing: (listingId: number, reason: string) =>
    apiFetch<{ ok: boolean }>(`/listings/${listingId}/report`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export async function uploadFile(file: File): Promise<{ objectPath: string }> {
  const token = localStorage.getItem("sakanmatch_token");
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${BASE}/api/storage/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json() as Promise<{ objectPath: string }>;
}
