import { useParams } from "wouter";
import { useGetPublicUserProfile, getGetPublicUserProfileQueryKey } from "@workspace/api-client-react";
import { Briefcase, Phone, Shield, User } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  client: "Client",
  company: "Company",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLOR: Record<string, string> = {
  superuser: "bg-violet-100 text-violet-700",
  admin: "bg-slate-100 text-slate-700",
  client: "bg-sky-100 text-sky-700",
  company: "bg-emerald-100 text-emerald-700",
  employee: "bg-amber-100 text-amber-700",
  agent: "bg-pink-100 text-pink-700",
};

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const id = parseInt(userId ?? "", 10);

  const { data: profile, isLoading, isError } = useGetPublicUserProfile(id, {
    query: { queryKey: getGetPublicUserProfileQueryKey(id), enabled: !isNaN(id) && id > 0 },
  });

  if (isNaN(id) || id < 1) {
    return <ErrorView message="Invalid profile link." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !profile) {
    return <ErrorView message="Profile not found." />;
  }

  const initials = (profile.name ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase();

  const roleLabel = ROLE_LABEL[profile.role ?? ""] ?? (profile.role ?? "");
  const roleColor = ROLE_COLOR[profile.role ?? ""] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        <div className="p-8 flex flex-col items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 shadow-inner">
            <span className="text-3xl font-bold text-white">{initials}</span>
          </div>

          {/* Name */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">{profile.name}</h1>
            {profile.designation && (
              <p className="mt-1 text-sm text-emerald-300">{profile.designation}</p>
            )}
            <span className={`mt-2 inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${roleColor}`}>
              {roleLabel}
            </span>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-white/10" />

          {/* Details */}
          <div className="w-full flex flex-col gap-3">
            {profile.companyName && (
              <Row icon={<Briefcase size={15} className="text-emerald-400" />} label="Company" value={profile.companyName} />
            )}
            {profile.phone && (
              <Row icon={<Phone size={15} className="text-emerald-400" />} label="Phone" value={profile.phone} />
            )}
            <Row icon={<Shield size={15} className="text-emerald-400" />} label="Role" value={roleLabel} />
            <Row icon={<User size={15} className="text-emerald-400" />} label="ID" value={`#${String(profile.id).padStart(4, "0")}`} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 flex justify-center">
          <span className="text-xs text-white/30">Sky Office · LEO OS</span>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5">
      <div className="shrink-0">{icon}</div>
      <span className="text-xs text-white/40 w-16 shrink-0">{label}</span>
      <span className="text-sm text-white/80 font-medium truncate">{value}</span>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-white/60 text-sm">{message}</p>
        <p className="mt-1 text-white/30 text-xs">Sky Office · LEO OS</p>
      </div>
    </div>
  );
}
