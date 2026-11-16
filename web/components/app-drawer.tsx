// web/components/app-drawer.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { api, CHATS_CHANGED_EVENT, hasClientId, type ChatSessionSummary } from "../lib/api";
import { Logo } from "./logo";

const NAV_LINKS = [
  { href: "/", label: "Selgo AI Mentor" },
  { href: "/market", label: "Agent Market" },
  { href: "/business", label: "My Business Agents (ROI)" },
  { href: "/account", label: "Account & Settings" },
];

function TwoLines() {
  return (
    <>
      <span className="h-0.5 w-5 rounded bg-white" />
      <span className="h-0.5 w-5 rounded bg-white" />
    </>
  );
}

// The top bar with the two-line (=) button, and the slide-out drawer it opens.
export function AppDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ChatSessionSummary[]>([]);

  const loadChats = useCallback(async () => {
    if (!hasClientId()) {
      setChats([]);
      return;
    }
    try {
      setChats(await api.chatSessions());
    } catch {
      setChats([]);
    }
  }, []);

  // Load saved chats now, and again whenever the mentor saves or deletes one.
  useEffect(() => {
    const onChange = () => {
      void loadChats();
    };
    onChange();
    window.addEventListener(CHATS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHATS_CHANGED_EVENT, onChange);
  }, [loadChats]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg px-3">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg transition hover:bg-panel"
        >
          <TwoLines />
        </button>
        <Link href="/" aria-label="Selgo home">
          <Logo />
        </Link>
      </header>

      {/* Dark layer behind the drawer. Tapping it closes the drawer. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg transition hover:bg-panel-2"
          >
            <TwoLines />
          </button>
          <Logo />
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => go("/")}
            className="flex w-full items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white transition hover:bg-panel-2"
          >
            <span className="text-lg leading-none text-brand-soft">+</span>
            New Chat
          </button>
        </div>

        <nav className="px-3 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm transition hover:bg-panel-2 ${
                pathname === link.href ? "bg-panel-2 font-semibold text-white" : "text-slate-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-line px-3 py-3">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Saved chats
          </p>
          {chats.length > 0 ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => go(`/?chat=${chat.id}`)}
                className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-panel-2"
              >
                {chat.title}
              </button>
            ))
          ) : (
            <p className="px-3 text-sm text-muted">Your mentor chats will appear here.</p>
          )}
        </div>
      </aside>
    </>
  );
}
