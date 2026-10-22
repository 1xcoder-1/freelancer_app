"use client";

import React, { useState } from "react";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  ProfileField,
  UnderlineInput,
  UnderlineTextarea,
} from "./profile-fields";
import { ListHeader, EmptyList, ItemCard, Chip, ListDialog } from "./profile-list";
import { GraduationCap } from "lucide-react";
import type { ProfileEducation } from "@/lib/api";

const EMPTY: ProfileEducation = {
  id: "",
  institution: "",
  degree: "",
  field_of_study: "",
  start_year: "",
  end_year: "",
  grade: "",
  description: "",
};

export function EducationTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileEducation[];
  onUpsert: (item: ProfileEducation) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileEducation>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setDraft({ ...EMPTY, id: crypto.randomUUID() });
    setOpen(true);
  };

  const openEdit = (item: ProfileEducation) => {
    setDraft({ ...item });
    setOpen(true);
  };

  const save = async () => {
    if (!validateOrToast(
      z.object({
        institution: z.string().trim().min(1, "Institution is required"),
        degree: z.string().trim().min(1, "Degree is required"),
      }),
      { institution: draft.institution, degree: draft.degree }
    )) return;
    setSaving(true);
    try {
      await onUpsert(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProfileEducation) => {
    const ok = await confirmDialog({
      title: "Delete education",
      message: `Remove "${item.degree}" at ${item.institution}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(item.id);
  };

  return (
    <div>
      <ListHeader count={items.length} addLabel="Add Education" onAdd={openNew} />

      <ListDialog
        open={open}
        title={draft.id && items.some((i) => i.id === draft.id) ? "Edit Education" : "Add Education"}
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={() => void save()}
      >
        <ProfileField label="Institution" required>
          <UnderlineInput
            value={draft.institution}
            onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
            placeholder="e.g. IIT Delhi"
          />
        </ProfileField>

        <ProfileField label="Degree" required>
          <UnderlineInput
            value={draft.degree}
            onChange={(e) => setDraft({ ...draft, degree: e.target.value })}
            placeholder="e.g. B.Tech"
          />
        </ProfileField>

        <ProfileField label="Field of Study">
          <UnderlineInput
            value={draft.field_of_study}
            onChange={(e) => setDraft({ ...draft, field_of_study: e.target.value })}
            placeholder="e.g. Computer Science"
          />
        </ProfileField>

        <ProfileField label="Grade">
          <UnderlineInput
            value={draft.grade}
            onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
            placeholder="e.g. 8.7 CGPA"
          />
        </ProfileField>

        <ProfileField label="Start Year">
          <UnderlineInput
            value={draft.start_year}
            onChange={(e) => setDraft({ ...draft, start_year: e.target.value })}
            placeholder="e.g. 2021"
          />
        </ProfileField>

        <ProfileField label="End Year">
          <UnderlineInput
            value={draft.end_year}
            onChange={(e) => setDraft({ ...draft, end_year: e.target.value })}
            placeholder="e.g. 2025"
          />
        </ProfileField>

        <ProfileField label="Description" className="sm:col-span-2">
          <UnderlineTextarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Societies, coursework, achievements…"
          />
        </ProfileField>
      </ListDialog>

      {items.length === 0 ? (
        <EmptyList hint="Add your degrees, schools and study periods." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ItemCard
              key={item.id || item.institution}
              icon={
                <div className="w-9 h-9 rounded-xl bg-surface-elevated/90 border border-line flex items-center justify-center text-muted group-hover:text-indigo-400 transition-colors shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
              }
              title={item.degree + (item.field_of_study ? ` in ${item.field_of_study}` : "")}
              subtitle={item.institution}
              meta={[item.start_year, item.end_year].filter(Boolean).join(" — ")}
              description={item.description}
              badges={
                item.grade ? (
                  <Chip variant="success">Grade: {item.grade}</Chip>
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
