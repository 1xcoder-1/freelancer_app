"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Loader2, Save, Check } from "@/components/animated-icons";
import {
  getProfile,
  updateProfile,
  updateWorkspaceSettings,
  type UserProfileContent,
  type ProfilePersonal,
  type ProfileProfessional,
  type ProfileExperience,
  type ProfileCertification,
  type ProfileEducation,
  type ProfileProject,
} from "@/lib/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { validateOrToast, nameSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
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
  const { ready: flagsReady, isOwner } = useFeatureFlags();
  const { currency, setCurrency, ready: currencyReady } = useWorkspaceCurrency();
  const [currencySaving, setCurrencySaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfileContent | null>(null);
  const [tab, setTab] = useState<TabKey>("personal");
  const [justSaved, setJustSaved] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSavedSuccess = useCallback(() => {
    setJustSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setJustSaved(false);
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Workspace is the owner's control room (billing defaults, integrations and
  // page access). Everyone else edits only the profile tabs. Until the flags
  // resolve, keep it out of the tab row so it can never flash for a test user.
  const tabs = useMemo(
    () => TABS.filter((t) => t.key !== "workspace" || (flagsReady && isOwner)),
    [flagsReady, isOwner]
  );
  // Derived, not synced through an effect: if ownership or readiness changes
  // while Workspace is selected, the page falls back without a render cascade.
  const activeTab: TabKey = tabs.some((t) => t.key === tab) ? tab : "personal";

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

  // Currency is workspace-level (every amount in the app), so it saves on
  // change rather than with the profile document. The context updates every
  // mounted page instantly; a failed save reverts the switch.
  const handleCurrencyChange = useCallback(
    async (next: string) => {
      if (next === currency || currencySaving) return;
      const previous = currency;
      setCurrency(next);
      setCurrencySaving(true);
      try {
        const token = (await getToken()) || undefined;
        await updateWorkspaceSettings({ currency: next }, token);
        toast.success("Currency updated for the whole app");
      } catch (err) {
        logHandledError("Failed to update currency:", err);
        setCurrency(previous);
        toast.error("Could not update currency. Please try again.");
      } finally {
        setCurrencySaving(false);
      }
    },
    [currency, currencySaving, setCurrency, getToken]
  );

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
        triggerSavedSuccess();
      } catch (err) {
        logHandledError("Failed to save profile:", err);
        toast.error("Could not save. Please try again.");
      }
    },
    [profile, getToken, triggerSavedSuccess]
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
      triggerSavedSuccess();
    } catch (err) {
      logHandledError("Failed to save profile:", err);
      toast.error("Could not save profile. Please check your input and try again.");
    } finally {
      setSaving(false);
    }
  };

  const tabIndex = tabs.findIndex((t) => t.key === activeTab);
  const goTab = (dir: -1 | 1) => {
    const next = Math.min(tabs.length - 1, Math.max(0, tabIndex + dir));
    setTab(tabs[next].key);
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-8 sm:pb-10 animate-pulse">
        {/* Profile Header skeleton */}
        <div className="flex items-center gap-5 sm:gap-6">
          <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shrink-0" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md hidden sm:block opacity-60" />
          </div>
        </div>

        {/* Tab row skeleton */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-none border-b border-line pb-3 -mx-1 px-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-18 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>

        {/* Content Card skeleton */}
        <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-[#121214]/60 p-6 sm:p-8 pb-7 sm:pb-8 space-y-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 sm:gap-x-12 gap-y-7 sm:gap-y-8">
            {/* Full Name */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Bio */}
            <div className="sm:col-span-2 space-y-2">
              <Skeleton className="h-3.5 w-12 rounded-md" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Job Title */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Institution */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* App Currency */}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            <div className="hidden sm:block" />

            {/* Social & Professional Links Section */}
            <div className="sm:col-span-2 pt-2 space-y-6">
              <Skeleton className="h-4 w-44 rounded-md" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 sm:gap-x-12 gap-y-7 sm:gap-y-8">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer action buttons skeleton */}
          <div className="flex items-center justify-between gap-3 mt-8">
            <Skeleton className="h-9 w-24 rounded-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
          </div>
        </div>
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

  const showProfileSave = activeTab !== "workspace";

  return (
    <div className="space-y-6 pb-8 sm:pb-10">
      <ProfileHeader username={profile.personal.username || undefined} />

      {/* Tab row — underline style, accent slide indicator */}
      <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto scrollbar-none border-b border-neutral-800/80 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative px-2 sm:px-3 pb-3 pt-2 text-sm whitespace-nowrap transition-colors ${
              activeTab === t.key ? "text-amber-500 font-semibold" : "text-neutral-400 hover:text-neutral-200 font-normal"
            }`}
          >
            {t.label}
            {activeTab === t.key && (
              <motion.span
                layoutId="profile-tab-underline"
                className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-amber-500"
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            )}
          </button>
        ))}
      </div>

      <div
        className={
          ["experience", "projects", "certifications", "education"].includes(activeTab)
            ? "space-y-6"
            : "rounded-2xl border border-dashed border-neutral-800/80 bg-[#121214]/60 backdrop-blur-sm p-6 sm:p-8 pb-7 sm:pb-8 shadow-xl shadow-black/20"
        }
      >
        {activeTab === "personal" && (
          <PersonalTab
            fullName={clerkName}
            onFullNameChange={setClerkName}
            personal={profile.personal}
            onChange={updatePersonal}
            currency={currency}
            currencyReady={currencyReady}
            currencySaving={currencySaving}
            onCurrencyChange={(next) => void handleCurrencyChange(next)}
          />
        )}
        {activeTab === "professional" && (
          <ProfessionalTab professional={profile.professional} onChange={updateProfessional} />
        )}
        {activeTab === "experience" && (
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
        {activeTab === "certifications" && (
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
        {activeTab === "education" && (
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
        {activeTab === "projects" && (
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
        {activeTab === "workspace" && flagsReady && isOwner && <WorkspaceTab />}

        {/* Reference-style footer navigation — no top line, matching Image 2 pill buttons */}
        {activeTab !== "workspace" && (
          <div className="flex items-center justify-between gap-3 mt-8">
            <div>
              {tabIndex > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => goTab(-1)}
                  className="h-9 px-5 rounded-full text-xs sm:text-[13px] font-medium text-neutral-400 hover:text-white bg-[#1c1c1f] hover:bg-[#252529] border border-neutral-800 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
              ) : (
                <div />
              )}
            </div>
            <div className="flex items-center gap-3">
              {tabIndex < tabs.length - 1 && (
                <button
                  type="button"
                  onClick={() => goTab(1)}
                  className="h-9 px-6 rounded-full bg-[#3d2914] hover:bg-[#4d3419] border border-[#5a3818]/40 text-[#f59e0b] hover:text-[#fbbf24] text-xs sm:text-[13px] font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                  Next
                </button>
              )}

              {/* Show Save actions on form tabs or whenever there are unsaved edits/feedback */}
              {(activeTab === "personal" || activeTab === "professional" || guard.dirty || saving || justSaved) && (
                saving ? (
                  <button
                    type="button"
                    disabled
                    className="h-9 px-6 rounded-full bg-[#0d2a1b] border border-[#1b5232]/40 text-[#34d399]/70 text-xs sm:text-[13px] font-semibold tracking-wide shadow-sm cursor-wait flex items-center justify-center gap-1.5"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </button>
                ) : justSaved ? (
                  <div className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-[#0d2a1b] border border-[#1b5232]/50 text-[#34d399] text-xs sm:text-[13px] font-semibold tracking-wide animate-in fade-in zoom-in-95 duration-200">
                    <Check className="w-3.5 h-3.5 text-[#34d399]" />
                    Saved
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="h-9 px-6 rounded-full bg-[#0f3320] hover:bg-[#15452b] border border-[#1b5232]/40 text-[#22c55e] hover:text-[#4ade80] text-xs sm:text-[13px] font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    Submit
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
