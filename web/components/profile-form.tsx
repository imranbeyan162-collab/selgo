// web/components/profile-form.tsx
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { api, ApiError, type Profile } from "../lib/api";
import { photoToAvatar } from "../lib/image";
import { CARD, INPUT, PRIMARY_BUTTON, SMALL_BUTTON } from "../lib/styles";

type Props = {
  profile: Profile;
  onSaved: (profile: Profile) => void;
};

// Name, photo and company. Starts from the saved profile and saves on submit.
export function ProfileForm({ profile, onSaved }: Props) {
  const [name, setName] = useState(profile.display_name);
  const [company, setCompany] = useState(profile.company_name ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onPickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      setAvatar(await photoToAvatar(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That photo could not be used.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.updateProfile({
        display_name: name.trim(),
        company_name: company.trim() || null,
        avatar_url: avatar,
      });
      onSaved(saved);
      setNotice("Saved.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const initial = (name.trim() || "G").charAt(0).toUpperCase();

  return (
    <form onSubmit={onSubmit} className={`${CARD} flex flex-col gap-5 p-5`}>
      <div className="flex items-center gap-4">
        {avatar ? (
          // A data URL from this browser, so Next's image optimizer isn't needed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt="Your profile photo"
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-panel-2 text-2xl font-bold text-white ring-1 ring-line">
            {initial}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={SMALL_BUTTON}>
            {avatar ? "Change photo" : "Add photo"}
          </button>
          {avatar ? (
            <button type="button" onClick={() => setAvatar(null)} className={SMALL_BUTTON}>
              Remove
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(event: ChangeEvent<HTMLInputElement>) => void onPickPhoto(event)}
          className="hidden"
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-200">Your name</span>
        <input
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          maxLength={80}
          required
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-200">Company name</span>
        <input
          value={company}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setCompany(event.target.value)}
          maxLength={160}
          placeholder="e.g. Sunrise Bakery"
          className={INPUT}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-online">{notice}</p> : null}

      <button type="submit" disabled={saving || !name.trim()} className={PRIMARY_BUTTON}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
