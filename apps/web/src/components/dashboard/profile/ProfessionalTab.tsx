"use client";

import React from "react";
import {
  ProfileField,
  UnderlineInput,
  UnderlineSelect,
  UnderlineTextarea,
  ProfileSectionTitle,
  ToggleRow,
  TagInput,
} from "./profile-fields";
import type { ProfileProfessional } from "@/lib/api";

const EXPERIENCE_LEVELS = [
  "Student",
  "Entry Level",
  "Mid Level",
  "Senior Level",
  "Lead / Manager",
  "Director+",
  "Freelancer",
];
const WORK_TYPES = ["On-site", "Hybrid", "Remote"];

export function ProfessionalTab({
  professional,
  onChange,
}: {
  professional: ProfileProfessional;
  onChange: (patch: Partial<ProfileProfessional>) => void;
}) {
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
      <ProfileField label="About Me (Bio)" className="sm:col-span-2">
        <UnderlineTextarea
          value={professional.about_me}
          onChange={(e) => onChange({ about_me: e.target.value })}
          placeholder="Summarize your professional journey..."
        />
      </ProfileField>

      <ProfileField label="Current Job Role">
        <UnderlineInput
          value={professional.current_job_role}
          onChange={(e) => onChange({ current_job_role: e.target.value })}
          placeholder="Select your current role"
        />
      </ProfileField>

      <ProfileField label="Current Company">
        <UnderlineInput
          value={professional.current_company}
          onChange={(e) => onChange({ current_company: e.target.value })}
          placeholder="Where do you work?"
        />
      </ProfileField>

      <ProfileField label="Experience Level">
        <UnderlineSelect
          options={EXPERIENCE_LEVELS}
          placeholder="Select level"
          value={professional.experience_level}
          onChange={(e) => onChange({ experience_level: e.target.value })}
        />
      </ProfileField>

      <ProfileField label="Years of Experience">
        <UnderlineInput
          type="number"
          min={0}
          max={60}
          value={professional.years_of_experience}
          onChange={(e) => onChange({ years_of_experience: num(e.target.value) })}
        />
      </ProfileField>

      <ProfileField label="Current Location">
        <UnderlineInput
          value={professional.current_location}
          onChange={(e) => onChange({ current_location: e.target.value })}
          placeholder="Select base location"
        />
      </ProfileField>

      <div className="sm:col-span-2">
        <ProfileSectionTitle>Preferences & Targets</ProfileSectionTitle>
      </div>

      <ProfileField label="Preferred Roles (Target)">
        <TagInput
          values={professional.preferred_roles}
          onChange={(preferred_roles) => onChange({ preferred_roles })}
          placeholder="Select roles"
        />
      </ProfileField>

      <ProfileField label="Preferred Locations">
        <TagInput
          values={professional.preferred_locations}
          onChange={(preferred_locations) => onChange({ preferred_locations })}
          placeholder="Select locations"
        />
      </ProfileField>

      <ProfileField label="Min Salary Expectation (LPA)">
        <UnderlineInput
          type="number"
          min={0}
          value={professional.min_salary_lpa}
          onChange={(e) => onChange({ min_salary_lpa: num(e.target.value) })}
        />
      </ProfileField>

      <ProfileField label="Max Salary Expectation (LPA)">
        <UnderlineInput
          type="number"
          min={0}
          value={professional.max_salary_lpa}
          onChange={(e) => onChange({ max_salary_lpa: num(e.target.value) })}
        />
      </ProfileField>

      <ProfileField label="Preferred Work Type">
        <UnderlineSelect
          options={WORK_TYPES}
          placeholder="Select type"
          value={professional.preferred_work_type}
          onChange={(e) => onChange({ preferred_work_type: e.target.value })}
        />
      </ProfileField>

      <ProfileField label="Notice Period (Days)">
        <UnderlineInput
          type="number"
          min={0}
          max={365}
          value={professional.notice_period_days}
          onChange={(e) => onChange({ notice_period_days: num(e.target.value) })}
        />
      </ProfileField>

      <div className="sm:col-span-2 flex flex-wrap items-center gap-8 pt-1">
        <ToggleRow
          checked={professional.immediate_joiner}
          onChange={(immediate_joiner) => onChange({ immediate_joiner })}
          label="Immediate Joiner"
        />
        <ToggleRow
          checked={professional.ready_to_relocate}
          onChange={(ready_to_relocate) => onChange({ ready_to_relocate })}
          label="Ready to Relocate"
        />
      </div>

      <div className="sm:col-span-2">
        <ProfileSectionTitle>Core Skills</ProfileSectionTitle>
      </div>

      <ProfileField label="Technical Skills" className="sm:col-span-2">
        <TagInput
          values={professional.technical_skills}
          onChange={(technical_skills) => onChange({ technical_skills })}
          placeholder="Select skills"
        />
      </ProfileField>
    </div>
  );
}
