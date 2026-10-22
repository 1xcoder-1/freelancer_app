"use client";

import React, { useState, useMemo } from "react";
import {
  ProfileField,
  UnderlineInput,
  UnderlineSelect,
  UnderlineTextarea,
  ProfileSectionTitle,
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

  const initialSalary = useMemo(() => {
    const min = professional.min_salary_lpa;
    const max = professional.max_salary_lpa;
    if (!min && !max) return "";
    if (min === max) return String(min);
    if (min && max) return `${min} - ${max}`;
    return String(min || max);
  }, [professional.min_salary_lpa, professional.max_salary_lpa]);

  const [salaryInput, setSalaryInput] = useState<string | null>(null);

  const displaySalary = salaryInput !== null ? salaryInput : initialSalary;

  const handleSalaryChange = (val: string) => {
    setSalaryInput(val);
    const cleaned = val.trim();
    if (!cleaned) {
      onChange({ min_salary_lpa: 0, max_salary_lpa: 0 });
      return;
    }
    if (cleaned.includes("-")) {
      const parts = cleaned.split("-");
      const minVal = parseFloat(parts[0]?.trim() || "") || 0;
      const maxVal = parseFloat(parts[1]?.trim() || "") || minVal;
      onChange({ min_salary_lpa: minVal, max_salary_lpa: maxVal });
    } else {
      const parsed = parseFloat(cleaned) || 0;
      onChange({ min_salary_lpa: parsed, max_salary_lpa: parsed });
    }
  };

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

      <ProfileField label="Preferred Work Type">
        <UnderlineSelect
          options={WORK_TYPES}
          placeholder="Select type"
          value={professional.preferred_work_type}
          onChange={(e) => onChange({ preferred_work_type: e.target.value })}
        />
      </ProfileField>

      <div className="sm:col-span-2">
        <ProfileSectionTitle>Preferences & Targets</ProfileSectionTitle>
      </div>

      <ProfileField label="Preferred Roles (Target)">
        <TagInput
          withLogos
          values={professional.preferred_roles}
          onChange={(preferred_roles) => onChange({ preferred_roles })}
          placeholder="e.g. Frontend Developer, AI Engineer, Cyber Security..."
        />
      </ProfileField>

      <ProfileField label="Preferred Locations">
        <TagInput
          values={professional.preferred_locations}
          onChange={(preferred_locations) => onChange({ preferred_locations })}
          placeholder="Select locations"
        />
      </ProfileField>

      <ProfileField label="Salary Expectation (LPA)" className="sm:col-span-2">
        <UnderlineInput
          value={displaySalary}
          onChange={(e) => handleSalaryChange(e.target.value)}
          placeholder="e.g. 12 or 10 - 15"
        />
      </ProfileField>

      <div className="sm:col-span-2">
        <ProfileSectionTitle>Core Skills</ProfileSectionTitle>
      </div>

      <ProfileField label="Technical Skills" className="sm:col-span-2">
        <TagInput
          withLogos
          values={professional.technical_skills}
          onChange={(technical_skills) => onChange({ technical_skills })}
          placeholder="e.g. React, Python, Docker, PostgreSQL..."
        />
      </ProfileField>
    </div>
  );
}
