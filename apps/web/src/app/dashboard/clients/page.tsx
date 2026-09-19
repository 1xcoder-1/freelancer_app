"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Users,
  Plus,
  Mail,
  Phone,
  Globe,
  Building,
  Trash2,
  RefreshCw,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClients, createClient, deleteClient, type Client } from "@/lib/api";

export default function ClientsPage() {
  const { getToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const res = await getClients(token);
      setClients(res);
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadData();
    } catch (err) {
      console.error("Error creating client:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteClient(id, token);
      loadData();
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Clients CRM</h1>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono text-xs">
              {loading ? "Syncing..." : `${clients.length} Clients`}
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Manage your client directory, contact history, and lifetime client value.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-white/10 text-slate-300">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Client
          </Button>
        </div>
      </div>

      {/* Clients Grid with Skeleton Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-slate-900/40 border-white/5 p-5 space-y-4">
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
              <div className="pt-3 border-t border-white/5 flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="bg-slate-900/40 border-white/10 hover:border-cyan-500/30 transition-all p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{c.name}</h3>
                    {c.company_name && <p className="text-xs text-cyan-400 font-medium">{c.company_name}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {c.status}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate text-slate-300">{c.email}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-300">{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-300">{c.website}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
                <span>Health Score: 100%</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  title="Delete Client"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-200">No Clients Added Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Add your clients to start sending invoices, proposals, contracts, and tracking project deliverables.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Client
          </Button>
        </Card>
      )}

      {/* Add Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-slate-900 border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Add New Client</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Client Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Labs"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@acmelabs.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0192"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://acme.com"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white">
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
