import { useParams } from "wouter";
import { useGetPublicUserProfile, getGetPublicUserProfileQueryKey } from "@workspace/api-client-react";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const id = parseInt(userId ?? "", 10);

  const { data: profile, isLoading, isError } = useGetPublicUserProfile(id, {
    query: { queryKey: getGetPublicUserProfileQueryKey(id), enabled: !isNaN(id) && id > 0 },
  });

  if (isNaN(id) || id < 1) return <Shell><ErrorMsg text="Invalid profile link." /></Shell>;
  if (isLoading) return <Shell><Spinner /></Shell>;
  if (isError || !profile) return <Shell><ErrorMsg text="Profile not found." /></Shell>;

  const initials = (profile.name ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase();

  function saveContact() {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile!.name ?? ""}`,
      profile!.designation ? `TITLE:${profile!.designation}` : "",
      profile!.companyName ? `ORG:${profile!.companyName}` : "",
      profile!.phone ? `TEL;TYPE=CELL:${profile!.phone}` : "",
    ].filter(Boolean);
    lines.push("END:VCARD");

    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile!.name ?? "contact").replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell>
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        {/* Avatar */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl"
          style={{ background: "linear-gradient(135deg,#1a5c4a,#2e9e7a)" }}
        >
          {initials}
        </div>

        {/* Name + designation */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{profile.name}</h1>
          {profile.designation && (
            <p className="mt-1 text-emerald-300 text-sm">{profile.designation}</p>
          )}
        </div>

        {/* Info rows */}
        <div className="w-full flex flex-col gap-3">
          {profile.companyName && <InfoRow icon="🏢" value={profile.companyName} />}
          {profile.phone && <InfoRow icon="📞" value={profile.phone} href={`tel:${profile.phone}`} />}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/10" />

        {/* Save Contact button */}
        <button
          onClick={saveContact}
          className="w-full py-4 rounded-2xl font-semibold text-sm tracking-wide text-white shadow-lg active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg,#1a5c4a,#2e9e7a)" }}
        >
          Save Contact
        </button>

        <p className="text-white/20 text-xs">Sky Office · LEO OS</p>
      </div>
    </Shell>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(160deg,#0a1612 0%,#0f2d23 50%,#0a1612 100%)" }}
    >
      {children}
    </div>
  );
}

function InfoRow({ icon, value, href }: { icon: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
      <span className="text-base shrink-0">{icon}</span>
      <span className="text-sm text-white/75 font-medium truncate">{value}</span>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function Spinner() {
  return <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />;
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div className="text-center">
      <p className="text-white/50 text-sm">{text}</p>
      <p className="mt-1 text-white/25 text-xs">Sky Office · LEO OS</p>
    </div>
  );
}
