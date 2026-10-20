"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Loader2, Save } from "@/components/animated-icons";
import {
  getProfile,
  updateProfile,
  type UserProfileContent,
  type ProfilePersonal,
  type ProfileProfessional,
  type ProfileExperience,
  type ProfileCertification,
  type ProfileEducation,
  type ProfileProject,
} from "@/lib/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { validateOrToast, nameSchema } from "@/lib/validation";
import { z } from "zod";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";
import { ProfileHeader } from "./ProfileHeader";
import { PersonalTab } from "./PersonalTab";
import { ProfessionalTab } from "./ProfessionalTab";
import { ExperienceTab } from "./ExperienceTab";
import { CertificationsTab } from "./CertificationsTab";
import { EducationTab } from "./EducationTab";
import { ProjectsTab } from "./ProjectsTab";
import { WorkspaceTab } from "./WorkspaceTab";

const TABS = [
  { key: "personal", label: "Personal" },
  { key: "professional", label: "Professional" },
  { key: "experience", label: "Experience" },
  { key: "certifications", label: "Certifications" },
  { key: "education", label: "Education" },
  { key: "projects", label: "Projects" },
  { key: "workspace", label: "Workspace" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function upsertIn<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = [...list];
  next[i] = item;
  return next;
}

export function ProfileSettings() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfileContent | null>(null);
  const [tab, setTab] = useState<TabKey>("personal");

  // The display name is Clerk-owned: typed here, pushed through the Clerk
  // client on save, and the sidebar updates in real time via useUser().
  const [clerkName, setClerkName] = useState("");
  const clerkNameInit = useRef(false);
  useEffect(() => {
    if (user && !clerkNameInit.current) {
      clerkNameInit.current = true;
      setClerkName(user.fullName || user.firstName || "");
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = (await getToken()) || undefined;
        const content = await getProfile(token);
        if (mounted) setProfile(content);
      } catch (err) {
        logHandledError("Failed to load profile:", err);
        if (mounted) toast.error("Could not load your profile. Please refresh.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const updatePersonal = useCallback((patch: Partial<ProfilePersonal>) => {
    setProfile((prev) => (prev ? { ...prev, personal: { ...prev.personal, ...patch } } : prev));
  }, []);

  const updateProfessional = useCallback((patch: Partial<ProfileProfessional>) => {
    setProfile((prev) => (prev ? { ...prev, professional: { ...prev.professional, ...patch } } : prev));
  }, []);

  // Merge a section into the document and persist the whole thing.
  const commitSection = useCallback(
    async (patch: Partial<UserProfileContent>) => {
      if (!profile) return;
      const next = { ...profile, ...patch };
      setProfile(next);
      try {
        const token = (await getToken()) || undefined;
        const saved = await updateProfile(next, token);
        setProfile(saved);
        toast.success("Saved");
      } catch (err) {
        logHandledError("Failed to save profile:", err);
        toast.error("Could not save. Please try again.");
      }
    },
    [profile, getToken]
  );

  // Unsaved-changes guard over the two form tabs (list tabs save instantly).
  const guardValues = useMemo(() => {
    const flat: Record<string, unknown> = { clerkName };
    if (profile) {
      for (const [k, v] of Object.entries(profile.personal)) flat[`p_${k}`] = v;
      for (const [k, v] of Object.entries(profile.professional)) flat[`pr_${k}`] = v;
    }
    return flat;
  }, [clerkName, profile]);

  const guard = useUnsavedChangesGuard({
    values: guardValues,
    enabled: !loading && profile !== null,
    draftKey: "user-profile",
    onRestoreDraft: useCallback((draft: Record<string, unknown>) => {
      if (typeof draft.clerkName === "string") setClerkName(draft.clerkName);
      setProfile((prev) => {
        if (!prev) return prev;
        const personal = { ...prev.personal } as Record<string, unknown>;
        const professional = { ...prev.professional } as Record<string, unknown>;
        for (const [k, v] of Object.entries(draft)) {
          if (k === "clerkName") continue;
          if (k.startsWith("p_") && k.slice(2) in personal) personal[k.slice(2)] = v;
          else if (k.startsWith("pr_") && k.slice(3) in professional) professional[k.slice(3)] = v;
        }
        return {
          ...prev,
          personal: personal as unknown as ProfilePersonal,
          professional: professional as unknown as ProfileProfessional,
        };
      });
    }, []),
  });

  const handleSaveProfile = async () => {
    if (!profile) return;
    if (!validateOrToast(
      z.object({
        fullName: nameSchema("Full name"),
        username: nameSchema("Username", 64),
      }),
      { fullName: clerkName, username: profile.personal.username }
    )) return;
    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      const saved = await updateProfile(profile, token);
      setProfile(saved);
      // Push the typed name through Clerk — sidebar + header update live.
      if (user && clerkName.trim() && clerkName.trim() !== (user.fullName || "").trim()) {
        const parts = clerkName.trim().split(/\s+/);
        await user.update({ firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined });
      }
      toast.success("Profile saved");
      guard.markSaved();
    } catch (err) {
      logHandledError("Failed to save profile:", err);
      toast.error("Could not save profile. Please check your input and try again.");
    } finally {
      setSaving(false);
    }
  };

  const tabIndex = TABS.findIndex((t) => t.key === tab);
  const goTab = (dir: -1 | 1) => {
    const next = Math.min(TABS.length - 1, Math.max(0, tabIndex + dir));
    setTab(TABS[next].key);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-card/40 px-6 py-16 text-center text-sm text-muted">
        Profile could not be loaded. Please refresh the page.
      </div>
    );
  }

  const showProfileSave = tab === "personal" || tab === "professional";

  return (
    <div className="space-y-6">
      <ProfileHeader username={profile.personal.username || undefined} />

      {/* Tab row — underline style, accent slide indicator */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none border-b border-line -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative px-3 sm:px-4 pb-3 pt-2 text-sm whitespace-nowrap transition-colors ${
              tab === t.key ? "text-accent font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="profile-tab-underline"
                className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-dashed border-line bg-card/40 p-5 sm:p-8">
        {tab === "personal" && (
          <PersonalTab
            fullName={clerkName}
            onFullNameChange={setClerkName}
            personal={profile.personal}
            onChange={updatePersonal}
          />
        )}
        {tab === "professional" && (
          <ProfessionalTab professional={profile.professional} onChange={updateProfessional} />
        )}
        {tab === "experience" && (
          <ExperienceTab
            items={profile.experiences}
            onUpsert={(item: ProfileExperience) =>
              commitSection({ experiences: upsertIn(profile.experiences, item) })
            }
            onDelete={(id: string) =>
              commitSection({ experiences: profile.experiences.filter((x) => x.id !== id) })
            }
          />
        )}
        {tab === "certifications" && (
          <CertificationsTab
            items={profile.certifications}
            onUpsert={(item: ProfileCertification) =>
              commitSection({ certifications: upsertIn(profile.certifications, item) })
            }
            onDelete={(id: string) =>
              commitSection({ certifications: profile.certifications.filter((x) => x.id !== id) })
            }
          />
        )}
        {tab === "education" && (
          <EducationTab
            items={profile.education}
            onUpsert={(item: ProfileEducation) =>
              commitSection({ education: upsertIn(profile.education, item) })
            }
            onDelete={(id: string) =>
              commitSection({ education: profile.education.filter((x) => x.id !== id) })
            }
          />
        )}
        {tab === "projects" && (
          <ProjectsTab
            items={profile.projects}
            onUpsert={(item: ProfileProject) =>
              commitSection({ projects: upsertIn(profile.projects, item) })
            }
            onDelete={(id: string) =>
              commitSection({ projects: profile.projects.filter((x) => x.id !== id) })
            }
          />
        )}
        {tab === "workspace" && <WorkspaceTab />}

        {/* Reference-style footer navigation. Workspace owns its save button;
            list tabs persist instantly, so Save only appears on form tabs. */}
        {tab !== "workspace" && (
          <div className="flex items-center justify-between gap-3 mt-10 pt-6 border-t border-dashed border-line">
            <Button
              variant="outline"
              onClick={() => goTab(-1)}
              disabled={tabIndex === 0}
              className="rounded-full border-line-strong text-fg hover:bg-surface"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-3">
              {showProfileSave && (
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              )}
              {tabIndex < TABS.length - 1 && (
                <Button
                  onClick={() => goTab(1)}
                  className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-full"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
