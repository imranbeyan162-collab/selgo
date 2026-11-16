// web/lib/api.ts
// Every call to the Selgo API goes through here. It sends the visitor's
// client ID (there is no login), turns API errors into readable messages,
// and gives each response a type.

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const CLIENT_ID_KEY = "selgo_client_id";

// Fired on this window whenever the list of saved chats changes.
export const CHATS_CHANGED_EVENT = "selgo-chats-changed";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------- Client ID (who this browser is) ----------

let memoryClientId: string | null = null; // used only if the browser blocks storage

function newClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID is missing on plain-http addresses (like testing on a phone over Wi-Fi).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLIENT_ID_KEY) ?? memoryClientId;
  } catch {
    return memoryClientId;
  }
}

// True once this browser has saved anything (chats, likes...). Before that we
// don't ask the API for saved data, so plain visits don't create profiles.
export function hasClientId(): boolean {
  return readClientId() !== null;
}

function getOrCreateClientId(): string {
  const existing = readClientId();
  if (existing) return existing;
  const created = newClientId();
  memoryClientId = created;
  try {
    window.localStorage.setItem(CLIENT_ID_KEY, created);
  } catch {
    // Storage is blocked (private mode). The ID lasts until the tab closes.
  }
  return created;
}

// ---------- Types (they mirror api/app/schemas.py) ----------

export type Message = { ok: boolean; message: string };

export type Profile = {
  id: number;
  display_name: string;
  avatar_url: string | null;
  company_name: string | null;
  created_at: string;
};

export type ChatRole = "user" | "assistant";

export type ChatTurn = { role: ChatRole; content: string };

export type MentorReply = { reply: string; session_id: number; title: string };

export type ChatSessionSummary = { id: number; title: string; updated_at: string };

export type ChatMessage = { id: number; role: ChatRole; content: string; created_at: string };

export type ChatSessionDetail = ChatSessionSummary & { messages: ChatMessage[] };

// ---------- Fetch wrapper ----------

type RequestOptions = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown };
        if (typeof first.msg === "string") return first.msg.replace(/^Value error, /, "");
      }
    }
  } catch {
    // The error had no JSON body. Fall through to the generic message.
  }
  return `Request failed (${response.status}).`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Client-ID": getOrCreateClientId() };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the Selgo server. Check your connection and try again.");
  }

  if (!response.ok) throw new ApiError(response.status, await readError(response));
  return (await response.json()) as T;
}

// ---------- API calls ----------

export const api = {
  // Profile
  profile: () => request<Profile>("/profile/me"),

  updateProfile: (body: {
    display_name?: string;
    company_name?: string | null;
    avatar_url?: string | null;
  }) => request<Profile>("/profile/me", { method: "PATCH", body }),

  // Mentor
  mentorChat: (message: string, sessionId: number | null) =>
    request<MentorReply>("/mentor/chat", {
      method: "POST",
      body: { message, session_id: sessionId },
    }),

  chatSessions: () => request<ChatSessionSummary[]>("/mentor/sessions"),

  chatSession: (id: number) => request<ChatSessionDetail>(`/mentor/sessions/${id}`),

  deleteChatSession: (id: number) =>
    request<Message>(`/mentor/sessions/${id}`, { method: "DELETE" }),
};
