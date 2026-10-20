"use client";

import React, { useState } from "react";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { ProfileField, UnderlineInput } from "./profile-fields";
import { ListHeader, EmptyList, ItemCard, Chip, ListDialog } from "./profile-list";
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

      {items.length === 0 ? (
        <EmptyList hint="Add courses, licenses and certifications you've earned." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemCard
              key={item.id || item.name}
              title={item.name}
              subtitle={[item.issuer, item.issue_date && `Issued ${item.issue_date}`].filter(Boolean).join(" · ")}
              badges={
                <>
                  {item.credential_id && <Chip>ID: {item.credential_id}</Chip>}
                  {item.credential_url && <Chip>Verified link</Chip>}
                </>
              }
              onEdit={() => openEdit(item)}
              onDelete={() => void remove(item)}
            />
          ))}
        </div>
      )}

      <ListDialog
        open={open}
        title="Certification"
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
    </div>
  );
}
