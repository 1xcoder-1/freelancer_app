"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Users,
  Plus,
  Mail,
  Phone,
  Globe,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClients, createClient, deleteClient, type Client } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, optionalEmailSchema, phoneSchema, optionalUrlSchema } from "@/lib/validation";

const clientSchema = z.object({
  name: nameSchema("Client name"),
  email: optionalEmailSchema,
  phone: z.union([z.literal(""), phoneSchema]),
  website: optionalUrlSchema,
});

export function ClientsPanel() {
  const { getToken } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const { data: clientsData, loading, refresh: loadData } = useApiData<Client[]>(
    "clients:data",
    async (token) => {
      return await getClients(token);
    },
    { reportContext: "clients" }
  );

  const clients = clientsData ?? [];

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(clientSchema, { name, email, phone, website })) return;
    try {
      const token = (await getToken()) || undefined;
      await createClient({
        name,
        company_name: companyName,
        email,
        phone,
        website,
        notes,
        status: "active"
      }, token);
      setShowCreateModal(false);
      setName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setNotes("");
      invalidateCache("dashboard:data");
      invalidateCache("invoices:data");
      loadData();
      toast.success("Client added");
    } catch (err) {
      console.error("Error creating client:", err);
      toast.error("Could not add client");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete client",
      message: "This client will be removed. Their leads and notes go with them — this cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteClient(id, token);
      invalidateCache("dashboard:data");
      invalidateCache("invoices:data");
      loadData();
      toast.success("Client deleted");
    } catch (err) {
      console.error("Error deleting client:", err);
      toast.error("Could not delete client");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Clients</h2>
            <Badge className="bg-accent-soft text-info border-accent/20 font-mono text-xs">
              {loading ? "Loading..." : `${clients.length} clients`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Everyone you work for, in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="border-line text-fg">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Clients Grid with Skeleton Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-card border-line p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="pt-3 border-t border-line flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="bg-card border-line hover:border-accent/30 transition-all p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-fg">{c.name}</h3>
                    {c.company_name && <p className="text-xs text-info font-medium">{c.company_name}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-accent-soft text-accent border-accent/20">
                    {c.status}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-faint shrink-0" />
                    <span className="truncate text-fg">{c.email}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-faint shrink-0" />
                      <span className="text-fg">{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-faint shrink-0" />
                      <span className="truncate text-fg">{c.website}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-faint">
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-faint hover:text-danger transition-colors"
                  title="Delete Client"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <Users className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg">No clients yet</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            Add the people you work with to send them invoices, proposals and contracts.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Client
          </Button>
        </Card>
      )}

      {/* Add Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-card border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-fg">Add a client</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-fg text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted">Client Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Labs"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@acmelabs.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0192"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted">Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://acme.com"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="border-line text-fg"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-accent hover:bg-accent-hi text-accent-fg">
                  Save Client
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
