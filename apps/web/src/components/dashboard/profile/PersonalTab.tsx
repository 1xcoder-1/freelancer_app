"use client";

import React from "react";
import {
  ProfileField,
  UnderlineInput,
  UnderlineTextarea,
  ProfileSectionTitle,
} from "./profile-fields";
import type { ProfilePersonal } from "@/lib/api";

export function PersonalTab({
  fullName,
  onFullNameChange,
  personal,
  onChange,
}: {
  fullName: string;
  onFullNameChange: (next: string) => void;
  personal: ProfilePersonal;
  onChange: (patch: Partial<ProfilePersonal>) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
      <ProfileField label="Full Name" required>
        <UnderlineInput
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          placeholder="Your name"
        />
      </ProfileField>

      <ProfileField label="Username" required>
        <UnderlineInput
          value={personal.username}
          onChange={(e) => onChange({ username: e.target.value })}
          placeholder="e.g. abdullah_dev"
        />
      </ProfileField>

      <ProfileField label="Bio" className="sm:col-span-2">
        <UnderlineTextarea
          value={personal.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder="Tell us something about yourself"
        />
      </ProfileField>

      <ProfileField label="Company">
        <UnderlineInput
          value={personal.company}
          onChange={(e) => onChange({ company: e.target.value })}
          placeholder="Enter your company"
        />
      </ProfileField>

      <ProfileField label="Job Title">
        <UnderlineInput
          value={personal.job_title}
          onChange={(e) => onChange({ job_title: e.target.value })}
          placeholder="Enter your job title"
        />
      </ProfileField>

      <ProfileField label="Location">
        <UnderlineInput
          value={personal.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="City, Country (e.g., Jaipur, India)"
        />
      </ProfileField>

      <ProfileField label="Institution">
        <UnderlineInput
          value={personal.institution}
          onChange={(e) => onChange({ institution: e.target.value })}
          placeholder="Enter your college/university"
        />
      </ProfileField>

      <div className="sm:col-span-2">
        <ProfileSectionTitle>Social & Professional Links</ProfileSectionTitle>
      </div>

      <ProfileField label="Website">
        <UnderlineInput
          value={personal.website}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://example.com"
          type="url"
        />
      </ProfileField>

      <ProfileField label="GitHub">
        <UnderlineInput
          value={personal.github}
          onChange={(e) => onChange({ github: e.target.value })}
          placeholder="https://github.com/username"
          type="url"
        />
      </ProfileField>

      <ProfileField label="LinkedIn">
        <UnderlineInput
          value={personal.linkedin}
          onChange={(e) => onChange({ linkedin: e.target.value })}
          placeholder="https://linkedin.com/in/username"
          type="url"
        />
      </ProfileField>

      <ProfileField label="Twitter / X">
        <UnderlineInput
          value={personal.twitter}
          onChange={(e) => onChange({ twitter: e.target.value })}
          placeholder="https://twitter.com/username"
          type="url"
        />
      </ProfileField>
    </div>
  );
}
