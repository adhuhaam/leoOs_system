import { useState, useEffect, useCallback } from "react";
import {
  useListPermissions,
  useUpdatePermissions,
  getListPermissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["admin", "company", "client", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

const MODULES = [
  { id: "masterlist", label: "Master List" },
  { id: "companies", label: "Companies" },
  { id: "clients", label: "Clients" },
  { id: "loa", label: "LOA" },
  { id: "billing", label: "Billing" },
  { id: "expenses", label: "Expenses" },
  { id: "passwords", label: "Passwords" },
  { id: "upload", label: "Upload" },
] as const;
type Module = (typeof MODULES)[number]["id"];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  company: "Company",
  client: "Client",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  company: "bg-teal-100 text-teal-700 border-teal-200",
  client: "bg-cyan-100 text-cyan-700 border-cyan-200",
  employee: "bg-lime-100 text-lime-700 border-lime-200",
  agent: "bg-amber-100 text-amber-700 border-amber-200",
};

type PermKey = `${Role}:${Module}`;
type PermEntry = { canView: boolean; canEdit: boolean; canDelete: boolean };
type Matrix = Map<PermKey, PermEntry>;

function key(role: Role, module: Module): PermKey {
  return `${role}:${module}` as PermKey;
}

function buildMatrix(permissions: { role: string; module: string; canView: boolean; canEdit: boolean; canDelete: boolean }[]): Matrix {
  const m = new Map<PermKey, PermEntry>();
  for (const p of permissions) {
    const role = p.role as Role;
    const module = p.module as Module;
    if (!ROLES.includes(role) || !MODULES.some((mod) => mod.id === module)) continue;
    m.set(key(role, module), {
      canView: p.canView,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    });
  }
  for (const role of ROLES) {
    for (const { id: module } of MODULES) {
      const k = key(role, module as Module);
      if (!m.has(k)) m.set(k, { canView: false, canEdit: false, canDelete: false });
    }
  }
  return m;
}

export default function PermissionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: permissions, isLoading } = useListPermissions();
  const updateMutation = useUpdatePermissions();

  const [matrix, setMatrix] = useState<Matrix>(new Map());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!permissions) return;
    setMatrix(buildMatrix(permissions));
    setDirty(false);
  }, [permissions]);

  const toggle = useCallback(
    (role: Role, module: Module, field: keyof PermEntry) => {
      setMatrix((prev) => {
        const next = new Map(prev);
        const k = key(role, module);
        const cur = next.get(k) ?? {
          canView: false,
          canEdit: false,
          canDelete: false,
        };
        next.set(k, { ...cur, [field]: !cur[field] });
        return next;
      });
      setDirty(true);
    },
    []
  );

  async function handleSave() {
    setSaving(true);
    const payload: { role: string; module: string; canView: boolean; canEdit: boolean; canDelete: boolean }[] = [];
    for (const role of ROLES) {
      for (const { id: module } of MODULES) {
        const entry = matrix.get(key(role, module as Module));
        if (entry) payload.push({ role, module, ...entry });
      }
    }
    try {
      await updateMutation.mutateAsync({ data: payload });
      await qc.invalidateQueries({ queryKey: getListPermissionsQueryKey() });
      setDirty(false);
      toast({ title: "Permissions saved", description: "Access rules are now live." });
    } catch {
      toast({
        title: "Failed to save",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!permissions) return;
    setMatrix(buildMatrix(permissions));
    setDirty(false);
  }

  const entry = (role: Role, module: Module) =>
    matrix.get(key(role, module)) ?? {
      canView: false,
      canEdit: false,
      canDelete: false,
    };

  return (
    <div className="max-w-full">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Configure module access per role. Superuser always has full access.
            </p>
          </div>
        </div>
        {dirty && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save changes
            </Button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-700">
            <Eye className="h-3 w-3" />
          </span>
          View
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-blue-700">
            <Pencil className="h-3 w-3" />
          </span>
          Edit / Create
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-rose-100 text-rose-700">
            <Trash2 className="h-3 w-3" />
          </span>
          Delete
        </span>
        <span className="text-muted-foreground/60 ml-1">
          Click any icon to toggle.
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider sticky left-0 bg-muted/40 z-10 min-w-[120px]">
                    Role
                  </th>
                  {MODULES.map((mod) => (
                    <th
                      key={mod.id}
                      className="px-2 py-3 text-center font-semibold text-muted-foreground uppercase text-[11px] tracking-wider min-w-[90px]"
                    >
                      {mod.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROLES.map((role) => (
                  <tr
                    key={role}
                    className="hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-4 sticky left-0 bg-card z-10 border-r border-border">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${ROLE_COLORS[role]}`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    </td>
                    {MODULES.map(({ id: module }) => {
                      const e = entry(role, module as Module);
                      return (
                        <td key={module} className="px-2 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="View"
                              onClick={() =>
                                toggle(role, module as Module, "canView")
                              }
                              className={`h-6 w-6 rounded flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                                e.canView
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-muted text-muted-foreground/25 hover:bg-muted/70"
                              }`}
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              title="Edit / Create"
                              onClick={() =>
                                toggle(role, module as Module, "canEdit")
                              }
                              className={`h-6 w-6 rounded flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                e.canEdit
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "bg-muted text-muted-foreground/25 hover:bg-muted/70"
                              }`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              title="Delete"
                              onClick={() =>
                                toggle(role, module as Module, "canDelete")
                              }
                              className={`h-6 w-6 rounded flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 ${
                                e.canDelete
                                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                  : "bg-muted text-muted-foreground/25 hover:bg-muted/70"
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dirty && (
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={saving}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Discard
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save changes
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
