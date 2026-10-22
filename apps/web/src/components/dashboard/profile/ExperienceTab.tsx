"use client";

import React, { useState } from "react";
import { validateOrToast } from "@/lib/validation";
import { z } from "zod";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  ProfileField,
  UnderlineInput,
  UnderlineSelect,
  UnderlineTextarea,
  ToggleRow,
} from "./profile-fields";
import { ListHeader, EmptyList, ItemCard, Chip, ListDialog } from "./profile-list";
import { Briefcase } from "@/components/animated-icons";
import type { ProfileExperience } from "@/lib/api";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"];

const EMPTY: ProfileExperience = {
  id: "",
  role: "",
  company: "",
  employment_type: "",
  location: "",
  start_date: "",
  end_date: "",
  current: false,
  description: "",
};

export function ExperienceTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileExperience[];
  onUpsert: (item: ProfileExperience) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileExperience>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setDraft({ ...EMPTY, id: crypto.randomUUID() });
    setOpen(true);
  };

  const openEdit = (item: ProfileExperience) => {
    setDraft({ ...item });
    setOpen(true);
  };

  const save = async () => {
    if (!validateOrToast(
      z.object({
        role: z.string().trim().min(1, "Role is required"),
        company: z.string().trim().min(1, "Company is required"),
      }),
      { role: draft.role, company: draft.company }
    )) return;
    setSaving(true);
    try {
      await onUpsert(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProfileExperience) => {
    const ok = await confirmDialog({
      title: "Delete experience",
      message: `Remove "${item.role}" at ${item.company || "unknown company"}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(item.id);
  };

  return (
    <div>
      <ListHeader count={items.length} addLabel="Add Experience" onAdd={openNew} />

      <ListDialog
        open={open}
        title={draft.id && items.some((i) => i.id === draft.id) ? "Edit Experience" : "Add Experience"}
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={() => void save()}
      >
        <ProfileField label="Role" required>
          <UnderlineInput
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            placeholder="e.g. Frontend Developer"
          />
        </ProfileField>

        <ProfileField label="Company" required>
          <UnderlineInput
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            placeholder="e.g. Google"
          />
        </ProfileField>

        <ProfileField label="Employment Type">
          <UnderlineSelect
            options={EMPLOYMENT_TYPES}
            placeholder="Select type"
            value={draft.employment_type}
            onChange={(e) => setDraft({ ...draft, employment_type: e.target.value })}
          />
        </ProfileField>

        <ProfileField label="Location">
          <UnderlineInput
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="e.g. Remote"
          />
        </ProfileField>

        <ProfileField label="Start Date">
          <UnderlineInput
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            placeholder="e.g. Jun 2023"
          />
        </ProfileField>

        <ProfileField label="End Date">
          <UnderlineInput
            value={draft.current ? "Present" : draft.end_date}
            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            disabled={draft.current}
            placeholder="e.g. Dec 2024"
          />
        </ProfileField>

        <div className="sm:col-span-2">
          <ToggleRow
            checked={draft.current}
            onChange={(current) => setDraft({ ...draft, current, end_date: current ? "" : draft.end_date })}
            label="I currently work here"
          />
        </div>

        <ProfileField label="Description" className="sm:col-span-2">
          <UnderlineTextarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What did you build or own?"
          />
        </ProfileField>
      </ListDialog>

      {items.length === 0 ? (
        <EmptyList hint="Add roles you've held — internships, jobs and freelance work." />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ItemCard
              key={item.id || item.role + item.company}
              icon={
                <div className="w-9 h-9 rounded-xl bg-surface-elevated/90 border border-line flex items-center justify-center text-muted group-hover:text-accent transition-colors shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
              }
              title={item.role}
              subtitle={item.company}
              meta={
                item.start_date && item.end_date
                  ? `${item.start_date} — ${item.end_date}`
                  : item.start_date && item.current
                    ? `${item.start_date} — Present`
                    : item.start_date
              }
              description={item.description}
              badges={
                (item.current || item.employment_type || item.location) ? (
                  <>
                    {item.current && (
                      <Chip variant="success" icon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}>
                        Current
                      </Chip>
                    )}
                    {item.employment_type && <Chip variant="default">{item.employment_type}</Chip>}
                    {item.location && <Chip variant="muted">{item.location}</Chip>}
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
