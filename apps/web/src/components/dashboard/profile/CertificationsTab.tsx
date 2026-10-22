"use client";

import React, { useState } from "react";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { ProfileField, UnderlineInput } from "./profile-fields";
import { ListHeader, EmptyList, ItemCard, Chip, ListDialog } from "./profile-list";
import { Award, ExternalLink } from "lucide-react";
import type { ProfileCertification } from "@/lib/api";

const EMPTY: ProfileCertification = {
  id: "",
  name: "",
  issuer: "",
  issue_date: "",
  expiry_date: "",
  credential_id: "",
  credential_url: "",
};

export function CertificationsTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileCertification[];
  onUpsert: (item: ProfileCertification) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileCertification>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setDraft({ ...EMPTY, id: crypto.randomUUID() });
    setOpen(true);
  };

  const openEdit = (item: ProfileCertification) => {
    setDraft({ ...item });
    setOpen(true);
  };

  const save = async () => {
    if (!validateOrToast(
      z.object({
        name: z.string().trim().min(1, "Certification name is required"),
        issuer: z.string().trim().min(1, "Issuer is required"),
      }),
      { name: draft.name, issuer: draft.issuer }
    )) return;
    setSaving(true);
    try {
      await onUpsert(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProfileCertification) => {
    const ok = await confirmDialog({
      title: "Delete certification",
      message: `Remove "${item.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(item.id);
  };

  return (
    <div>
      <ListHeader count={items.length} addLabel="Add Certification" onAdd={openNew} />

      <ListDialog
        open={open}
        title={draft.id && items.some((i) => i.id === draft.id) ? "Edit Certification" : "Add Certification"}
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={() => void save()}
      >
        <ProfileField label="Name" required>
          <UnderlineInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. AWS Solutions Architect"
          />
        </ProfileField>

        <ProfileField label="Issuer" required>
          <UnderlineInput
            value={draft.issuer}
            onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
            placeholder="e.g. Amazon Web Services"
          />
        </ProfileField>

        <ProfileField label="Issue Date">
          <UnderlineInput
            value={draft.issue_date}
            onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })}
            placeholder="e.g. Mar 2024"
          />
        </ProfileField>

        <ProfileField label="Expiry Date">
          <UnderlineInput
            value={draft.expiry_date}
            onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
            placeholder="Leave empty if it never expires"
          />
        </ProfileField>

        <ProfileField label="Credential ID">
          <UnderlineInput
            value={draft.credential_id}
            onChange={(e) => setDraft({ ...draft, credential_id: e.target.value })}
            placeholder="e.g. AWS-PSA-12345"
          />
        </ProfileField>

        <ProfileField label="Credential URL">
          <UnderlineInput
            type="url"
            value={draft.credential_url}
            onChange={(e) => setDraft({ ...draft, credential_url: e.target.value })}
            placeholder="https://credential-link"
          />
        </ProfileField>
      </ListDialog>

      {items.length === 0 ? (
        <EmptyList hint="Add courses, licenses and certifications you've earned." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ItemCard
              key={item.id || item.name}
              icon={
                <div className="w-9 h-9 rounded-xl bg-surface-elevated/90 border border-line flex items-center justify-center text-muted group-hover:text-amber-400 transition-colors shrink-0">
                  <Award className="w-4 h-4" />
                </div>
              }
              title={item.name}
              subtitle={item.issuer}
              meta={
                item.issue_date
                  ? `Issued ${item.issue_date}${item.expiry_date ? ` · Expires ${item.expiry_date}` : " · No Expiration"}`
                  : item.expiry_date
                    ? `Expires ${item.expiry_date}`
                    : undefined
              }
              action={
                item.credential_url ? (
                  <a
                    href={item.credential_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-elevated transition-colors"
                    title="View Credential"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : undefined
              }
              badges={
                (item.credential_url || item.credential_id) ? (
                  <>
                    {item.credential_url && (
                      <Chip variant="amber" icon={<Award className="w-3 h-3 text-amber-400" />}>
                        Verified
                      </Chip>
                    )}
                    {item.credential_id && (
                      <Chip variant="muted">
                        <span className="font-mono text-[10px]">ID: {item.credential_id}</span>
                      </Chip>
                    )}
                  </>
                ) : undefined
              }
              onEdit={() => openEdit(item)}
              onDelete={() => void remove(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
