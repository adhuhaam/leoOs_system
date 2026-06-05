import { useMemo, useState } from "react";
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey,
  getListPassportsQueryKey,
} from "@workspace/api-client-react";
import type { Client } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building, Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Mail, Phone } from "lucide-react";

interface ClientFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  tin: string;
  notes: string;
}

const EMPTY_FORM: ClientFormState = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  notes: "",
};

function clientToForm(c: Client): ClientFormState {
  return {
    name: c.name,
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    tin: c.tin ?? "",
    notes: c.notes ?? "",
  };
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useListClients();

  // Cheap client-side search across the few fields the user is likely to recall.
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            Clients
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Companies and sites where candidates get placed. Use the &ldquo;Allocation&rdquo; field on a candidate to link them here.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-client">
          <Plus className="h-4 w-4 mr-1" /> Add client
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, email, phone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-clients"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{clients.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">TIN</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      {clients.length === 0
                        ? "No clients yet — click Add client to create your first one."
                        : "No clients match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} data-testid={`row-client-${c.id}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {c.contactPerson || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                        {c.tin || <span className="font-sans">—</span>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              data-testid={`button-actions-client-${c.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setEditClient(c)}
                              data-testid={`menu-edit-client-${c.id}`}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteClient(c)}
                              data-testid={`menu-delete-client-${c.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ClientFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} />
      {editClient && (
        <ClientFormDialog
          mode="edit"
          client={editClient}
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
        />
      )}
      {deleteClient && (
        <DeleteClientDialog
          client={deleteClient}
          open={!!deleteClient}
          onOpenChange={(o) => !o && setDeleteClient(null)}
        />
      )}
    </div>
  );
}

function ClientFormDialog(
  props:
    | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void }
    | { mode: "edit"; client: Client; open: boolean; onOpenChange: (o: boolean) => void },
) {
  const { mode, open, onOpenChange } = props;
  // Snapshot the initial form when the dialog opens (or when the target client
  // changes) so we never carry stale state between adds/edits.
  const initialKey = mode === "edit" ? `edit-${props.client.id}` : "create";
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const wantedKey = open ? initialKey : null;
  if (snapshotKey !== wantedKey) {
    setSnapshotKey(wantedKey);
    setForm(mode === "edit" ? clientToForm(props.client) : EMPTY_FORM);
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const onDone = (msg: string) => {
      toast({ title: msg });
      queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
      // Master List shows clientName via join — refresh it so renames propagate.
      queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
      onOpenChange(false);
    };

    if (mode === "create") {
      // On create, only send fields the user actually filled in — keeps the
      // generated payload small and avoids sending "" for fields they skipped.
      const createPayload: Record<string, string> = { name };
      (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
        const v = form[k].trim();
        if (v) createPayload[k] = v;
      });
      createMutation.mutate(
        { data: createPayload as unknown as Parameters<typeof createMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Client added"),
          onError: () => toast({ title: "Failed to add client", variant: "destructive" }),
        },
      );
    } else {
      // On update, send nullable fields explicitly so blanking an input
      // actually clears the stored value (server treats null as "set to null").
      const updatePayload: Record<string, string | null> = { name };
      (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
        const v = form[k].trim();
        updatePayload[k] = v === "" ? null : v;
      });
      updateMutation.mutate(
        { id: props.client.id, data: updatePayload as unknown as Parameters<typeof updateMutation.mutate>[0]["data"] },
        {
          onSuccess: () => onDone("Client updated"),
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add client" : "Edit client"}</DialogTitle>
          <DialogDescription>
            Clients are the companies, sites, or sponsors a candidate is allocated to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                data-testid="input-client-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((s) => ({ ...s, contactPerson: e.target.value }))}
                data-testid="input-client-contact"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                data-testid="input-client-phone"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                data-testid="input-client-email"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                data-testid="input-client-address"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>TIN (Tax Identification Number)</Label>
              <Input
                placeholder="e.g. 1009905GST001"
                value={form.tin}
                onChange={(e) => setForm((s) => ({ ...s, tin: e.target.value }))}
                data-testid="input-client-tin"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                data-testid="input-client-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-client">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add client" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteClient();

  const onConfirm = () => {
    deleteMutation.mutate(
      { id: client.id },
      {
        onSuccess: () => {
          toast({ title: `${client.name} deleted` });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          // Allocated candidates get unlinked server-side — refresh master list.
          queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{client.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Any candidate currently allocated to this client will be unlinked
            (their other details are kept). This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete-client"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
