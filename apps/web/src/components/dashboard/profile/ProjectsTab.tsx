"use client";

import React, { useState } from "react";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  ProfileField,
  UnderlineInput,
  UnderlineTextarea,
  TagInput,
} from "./profile-fields";
import { ListHeader, EmptyList, ItemCard, Chip, ListDialog } from "./profile-list";
import type { ProfileProject } from "@/lib/api";

const EMPTY: ProfileProject = {
  id: "",
  name: "",
  description: "",
  tech_stack: [],
  link: "",
  year: "",
};

export function ProjectsTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileProject[];
  onUpsert: (item: ProfileProject) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileProject>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setDraft({ ...EMPTY, id: crypto.randomUUID() });
    setOpen(true);
  };

  const openEdit = (item: ProfileProject) => {
    setDraft({ ...item });
    setOpen(true);
  };

  const save = async () => {
    if (!validateOrToast(
      z.object({ name: z.string().trim().min(1, "Project name is required") }),
      { name: draft.name }
    )) return;
    setSaving(true);
    try {
      await onUpsert(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProfileProject) => {
    const ok = await confirmDialog({
      title: "Delete project",
      message: `Remove "${item.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(item.id);
  };

  return (
    <div>
      <ListHeader count={items.length} addLabel="Add Project" onAdd={openNew} />

      {items.length === 0 ? (
        <EmptyList hint="Showcase projects you've built — with the stack behind each." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemCard
              key={item.id || item.name}
              title={item.name}
              subtitle={item.description}
              badges={
                <>
                  {item.tech_stack.slice(0, 4).map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                  {item.tech_stack.length > 4 && <Chip>+{item.tech_stack.length - 4}</Chip>}
                  {item.year && <Chip>{item.year}</Chip>}
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
        title="Project"
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={() => void save()}
      >
        <ProfileField label="Name" required>
          <UnderlineInput
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Freelance Book"
          />
        </ProfileField>

        <ProfileField label="Year">
          <UnderlineInput
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
            placeholder="e.g. 2026"
          />
        </ProfileField>

        <ProfileField label="Link">
          <UnderlineInput
            type="url"
            value={draft.link}
            onChange={(e) => setDraft({ ...draft, link: e.target.value })}
            placeholder="https://project-link"
          />
        </ProfileField>

        <ProfileField label="Tech Stack">
          <TagInput
            values={draft.tech_stack}
            onChange={(tech_stack) => setDraft({ ...draft, tech_stack })}
            placeholder="e.g. Next.js"
          />
        </ProfileField>

        <ProfileField label="Description" className="sm:col-span-2">
          <UnderlineTextarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What does it do, and what did you build?"
          />
        </ProfileField>
      </ListDialog>
    </div>
  );
}
