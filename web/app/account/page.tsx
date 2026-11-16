// web/app/account/page.tsx
"use client";

import { ProfileForm } from "../../components/profile-form";
import { useProfile } from "../../lib/use-profile";

export default function AccountPage() {
  const { profile, setProfile, loading, error } = useProfile();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Account & Settings</h1>
      <p className="mt-2 text-sm text-muted">
        Your Selgo profile is kept in this browser. Clearing your browser data starts a new profile.
      </p>

      <div className="mt-6">
        {loading ? <p className="text-sm text-muted">Loading your profile…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {profile ? <ProfileForm key={profile.id} profile={profile} onSaved={setProfile} /> : null}
      </div>
    </div>
  );
}
