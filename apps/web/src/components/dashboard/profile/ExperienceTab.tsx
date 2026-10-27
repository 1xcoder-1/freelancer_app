"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { validateOrToast } from "@/lib/validation";
import { z } from "zod";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  ProfileField,
  UnderlineInput,
  UnderlineSelect,
  UnderlineTextarea,
  TagInput,
} from "./profile-fields";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Paperclip,
  Calendar,
  Loader2,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage } from "@/lib/image-compressor";
import { uploadFileToCloudinary, type ProfileExperience } from "@/lib/api";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

const EMPLOYMENT_TYPES = [
  { value: "FULL TIME", label: "FULL TIME" },
  { value: "PART TIME", label: "PART TIME" },
  { value: "CONTRACT", label: "CONTRACT" },
  { value: "FREELANCE", label: "FREELANCE" },
  { value: "INTERNSHIP", label: "INTERNSHIP" },
];

const LOCATION_TYPES = [
  { value: "ONSITE", label: "ONSITE" },
  { value: "HYBRID", label: "HYBRID" },
  { value: "REMOTE", label: "REMOTE" },
];

export function getOptimizedImageUrl(url?: string, width = 600): string {
  if (!url) return "";
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url;
}

const EMPTY: ProfileExperience = {
  id: "",
  role: "",
  company: "",
  employment_type: "FULL TIME",
  location: "",
  location_type: "ONSITE",
  start_date: "",
  end_date: "",
  current: false,
  description: "",
  skills: [],
  attachments: [],
};

function formatEmploymentType(type?: string): string {
  if (!type) return "";
  const upper = type.toUpperCase().trim();
  if (upper === "FULL TIME" || upper === "FULL-TIME") return "Full-Time";
  if (upper === "PART TIME" || upper === "PART-TIME") return "Part-Time";
  if (upper === "CONTRACT") return "Contract";
  if (upper === "FREELANCE") return "Freelance";
  if (upper === "INTERNSHIP") return "Internship";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function parseDateParts(str: string): { date: Date; formatted: string } | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Handle dd/mm/yyyy or dd-mm-yyyy
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { date: d, formatted };
    }
  }

  // Handle mm/yyyy or yyyy-mm
  const myMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10) - 1;
    const year = parseInt(myMatch[2], 10);
    const d = new Date(year, month, 1);
    if (!isNaN(d.getTime())) {
      const formatted = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { date: d, formatted };
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const formatted = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { date: d, formatted };
  }

  return { date: new Date(), formatted: trimmed };
}

function calculateDuration(startDate: Date, endDate: Date): string {
  let months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  if (months <= 0) months = 1;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0) {
    if (remainingMonths > 0) {
      return `${years} yr${years > 1 ? "s" : ""} ${remainingMonths} mo${
        remainingMonths > 1 ? "s" : ""
      }`;
    }
    return `${years} yr${years > 1 ? "s" : ""}`;
  }
  return `${months} mo${months > 1 ? "s" : ""}`;
}

function formatExperienceTimeline(
  startStr: string,
  endStr: string,
  current: boolean
): string {
  if (!startStr) return "";
  const start = parseDateParts(startStr);
  const end = current ? { date: new Date(), formatted: "Present" } : parseDateParts(endStr);

  const startLabel = start ? start.formatted : startStr;
  const endLabel = current ? "Present" : end ? end.formatted : endStr || "Present";

  let durationText = "";
  if (start && (current || end)) {
    const endDateObj = current ? new Date() : end?.date || new Date();
    durationText = ` · ${calculateDuration(start.date, endDateObj)}`;
  }

  return `${startLabel} - ${endLabel}${durationText}`;
}

function parseCustomDate(str: string): Date | null {
  if (!str) return null;
  const cleaned = str.replace(/\s+/g, "");
  const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatToInputDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
}

function DatePickerInput({
  value,
  onChange,
  placeholder = "dd / mm / yyyy",
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedDate = parseCustomDate(value);
  const [viewDate, setViewDate] = useState<Date>(parsedDate || new Date());

  useEffect(() => {
    if (open) {
      const p = parseCustomDate(value);
      if (p) setViewDate(p);
    }
  }, [open, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const totalDaysCurrent = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const days: Array<{
    dayNumber: number;
    isCurrentMonth: boolean;
    date: Date;
  }> = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      date: new Date(year, month - 1, d),
    });
  }

  for (let i = 1; i <= totalDaysCurrent; i++) {
    days.push({
      dayNumber: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      dayNumber: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });

  const handleSelectDay = (date: Date) => {
    onChange(formatToInputDate(date));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="relative cursor-pointer"
      >
        <UnderlineInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-7 cursor-pointer"
        />
        <Calendar className="w-4 h-4 text-neutral-400 absolute right-1 top-2.5 pointer-events-none" />
      </div>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 sm:right-0 sm:left-auto mt-2 z-[200] w-[290px] sm:w-[310px] rounded-2xl border border-neutral-800 bg-[#141416] p-4 shadow-2xl shadow-black/95 select-none"
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-800/60">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-neutral-800/80 cursor-pointer text-sm font-semibold text-neutral-100 transition-colors">
                <span>{`${monthName} ${year}`}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((dayName, idx) => (
                <span
                  key={idx}
                  className="text-xs font-medium text-neutral-400 py-1"
                >
                  {dayName}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {days.map((item, idx) => {
                const isSelected =
                  parsedDate &&
                  parsedDate.getDate() === item.date.getDate() &&
                  parsedDate.getMonth() === item.date.getMonth() &&
                  parsedDate.getFullYear() === item.date.getFullYear();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(item.date)}
                    className={`w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0070f3] text-white font-bold shadow-md shadow-blue-500/30"
                        : item.isCurrentMonth
                        ? "text-neutral-100 hover:bg-neutral-800 hover:text-white font-medium"
                        : "text-neutral-600 hover:bg-neutral-800/50 hover:text-neutral-400"
                    }`}
                  >
                    {item.dayNumber}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExperienceTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileExperience[];
  onUpsert: (item: ProfileExperience) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { getToken } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileExperience>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openNew = () => {
    setDraft({ ...EMPTY, id: crypto.randomUUID() });
    setDrawerOpen(true);
  };

  const openEdit = (item: ProfileExperience) => {
    setDraft({
      ...item,
      employment_type: item.employment_type || "FULL TIME",
      location_type: item.location_type || "ONSITE",
      skills: item.skills || [],
      attachments: item.attachments || [],
    });
    setDrawerOpen(true);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const currentAttachments = draft.attachments || [];
    if (currentAttachments.length >= 2) {
      toast.error("Maximum 2 attachments allowed.");
      return;
    }

    const availableSlots = 2 - currentAttachments.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    setUploadingImage(true);
    try {
      const token = (await getToken()) || undefined;
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file.`);
          continue;
        }
        const { blob, fileName } = await compressImage(file, 900, 0.82);
        const res = await uploadFileToCloudinary(blob, "uploads", token, fileName);
        if (res.url) {
          uploadedUrls.push(res.url);
        }
      }

      if (uploadedUrls.length > 0) {
        setDraft((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), ...uploadedUrls],
        }));
        toast.success("Attachment uploaded successfully");
      }
    } catch (err) {
      logHandledError("Attachment upload failed:", err);
      toast.error("Failed to upload attachment. Please try again.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setDraft((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const save = async () => {
    if (
      !validateOrToast(
        z.object({
          role: z.string().trim().min(1, "Job title/role is required"),
          company: z.string().trim().min(1, "Company is required"),
        }),
        { role: draft.role, company: draft.company }
      )
    )
      return;

    setSaving(true);
    try {
      await onUpsert(draft);
      setDrawerOpen(false);
      setExpandedId(draft.id);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProfileExperience) => {
    const ok = await confirmDialog({
      title: "Delete experience",
      message: `Remove "${item.role}" at ${item.company || "company"}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await onDelete(item.id);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row matching Image 3 */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-400 font-normal">
          Showcase your professional timeline and roles.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="h-8.5 px-4 rounded-full bg-[#1c1c1f] hover:bg-[#27272a] border border-neutral-800 text-neutral-200 hover:text-white text-xs sm:text-[13px] font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-neutral-300" />
          Add Experience
        </button>
      </div>

      {/* Experience List Cards matching Image 3 & 4 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-[#121214]/60 px-6 py-12 text-center">
          <p className="text-sm text-neutral-400">
            No experiences added yet. Click &quot;+ Add Experience&quot; to showcase your career timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const companyInitial = (item.company || "C").charAt(0).toUpperCase();
            const timelineText = formatExperienceTimeline(
              item.start_date,
              item.end_date,
              item.current
            );
            const employmentTypeFormatted = formatEmploymentType(item.employment_type);

            return (
              <div
                key={item.id}
                onClick={() => toggleExpand(item.id)}
                className="rounded-2xl border border-dashed border-neutral-800 hover:border-neutral-700 bg-transparent p-5 sm:p-6 transition-colors cursor-pointer select-none"
              >
                {/* Header info row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Company Initial / Logo Badge */}
                    <div className="w-12 h-12 rounded-xl bg-[#1c1c1f] border border-neutral-800 flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-inner">
                      {companyInitial}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-semibold text-white tracking-tight truncate">
                        {item.role || "Developer"}
                      </h4>
                      <p className="text-xs sm:text-[13px] text-neutral-300 font-medium mt-0.5 truncate">
                        {item.company}
                        {employmentTypeFormatted && ` · ${employmentTypeFormatted}`}
                      </p>
                      {timelineText && (
                        <p className="text-xs sm:text-[13px] text-neutral-400 font-normal mt-1">
                          {timelineText}
                        </p>
                      )}
                      {item.location_type && (
                        <p className="text-xs sm:text-[13px] text-neutral-400 font-normal mt-0.5 capitalize">
                          {item.location_type.toLowerCase()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(item);
                      }}
                      className="p-1.5 text-[#f43f5e] hover:text-[#fb7185] transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.id);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded content matching Image 4 */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-3.5">
                        {item.description && (
                          <p className="text-xs sm:text-[13px] text-neutral-300 font-normal leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {item.skills && item.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-300"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.attachments && item.attachments.length > 0 && (
                          <div className="pt-2">
                            <div className="flex flex-wrap gap-3">
                              {item.attachments.map((imgUrl, idx) => (
                                <a
                                  key={idx}
                                  href={imgUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="group relative block rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-md hover:border-neutral-600 transition-all"
                                >
                                  <img
                                    src={getOptimizedImageUrl(imgUrl, 600)}
                                    alt="Attachment"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-32 h-20 object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Over Drawer matching Image 2 portaled to body */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {drawerOpen && (
              <div className="fixed inset-0 z-[999] overflow-hidden flex justify-end">
                {/* Dark semi-transparent backdrop covering entire screen */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => !saving && setDrawerOpen(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-xs cursor-pointer"
                />

                {/* Slide-over panel container */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="relative z-10 w-full sm:max-w-2xl bg-[#111113] border-l border-neutral-800/80 shadow-2xl flex flex-col justify-between h-full overflow-hidden"
                >
                  {/* Drawer Top Header */}
                  <div className="flex items-center justify-between p-6 sm:p-7 border-b border-neutral-800/80 shrink-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {draft.id && items.some((i) => i.id === draft.id)
                        ? "Edit Experience"
                        : "Add Experience"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      disabled={saving}
                      className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drawer Form Body */}
                  <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Job Title / Role */}
                    <ProfileField label="Job Title / Role" required>
                      <div className="relative">
                        <UnderlineInput
                          value={draft.role}
                          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                          placeholder="e.g. Software Engineer"
                          className="pr-6"
                        />
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                      </div>
                    </ProfileField>

                    {/* Employment Type & Company */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Employment Type" required>
                        <UnderlineSelect
                          options={EMPLOYMENT_TYPES}
                          value={draft.employment_type || "FULL TIME"}
                          onChange={(e) =>
                            setDraft({ ...draft, employment_type: e.target.value })
                          }
                        />
                      </ProfileField>

                      <ProfileField label="Company" required>
                        <div className="relative">
                          <UnderlineInput
                            value={draft.company}
                            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                            placeholder="Ex: Google"
                            className="pr-6"
                          />
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                        </div>
                      </ProfileField>
                    </div>

                    {/* Location & Location Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Location">
                        <div className="relative">
                          <UnderlineInput
                            value={draft.location}
                            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                            placeholder="Ex: Bangalore"
                            className="pr-6"
                          />
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                        </div>
                      </ProfileField>

                      <ProfileField label="Location Type" required>
                        <UnderlineSelect
                          options={LOCATION_TYPES}
                          value={draft.location_type || "ONSITE"}
                          onChange={(e) =>
                            setDraft({ ...draft, location_type: e.target.value })
                          }
                        />
                      </ProfileField>
                    </div>

                    {/* Currently working toggle */}
                    <div className="pt-1">
                      <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.current}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              current: !draft.current,
                              end_date: !draft.current ? "" : draft.end_date,
                            })
                          }
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                            draft.current ? "bg-amber-600" : "bg-neutral-800 border border-neutral-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                              draft.current ? "translate-x-5" : ""
                            }`}
                          />
                        </button>
                        <span className="text-xs sm:text-sm font-normal text-neutral-200">
                          I am currently working in this role
                        </span>
                      </label>
                    </div>

                    {/* Start Date & End Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Start Date" required>
                        <DatePickerInput
                          value={draft.start_date}
                          onChange={(val) => setDraft({ ...draft, start_date: val })}
                          placeholder="dd / mm / yyyy"
                        />
                      </ProfileField>

                      <ProfileField label="End Date" required={!draft.current}>
                        <DatePickerInput
                          value={draft.current ? "Present" : draft.end_date}
                          onChange={(val) => setDraft({ ...draft, end_date: val })}
                          disabled={draft.current}
                          placeholder="dd / mm / yyyy"
                        />
                      </ProfileField>
                    </div>

                    {/* Description */}
                    <ProfileField label="Description">
                      <UnderlineTextarea
                        rows={3}
                        value={draft.description}
                        onChange={(e) =>
                          setDraft({ ...draft, description: e.target.value })
                        }
                        placeholder="Describe your responsibilities and achievements..."
                      />
                    </ProfileField>

                    {/* Skills Used (Optional) */}
                    <ProfileField label="Skills Used (Optional)">
                      <div className="relative">
                        <TagInput
                          values={draft.skills || []}
                          onChange={(skills) => setDraft({ ...draft, skills })}
                          placeholder="Select skills"
                        />
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                      </div>
                    </ProfileField>

                    {/* Attachments (Max 4) */}
                    <div className="space-y-3 pt-1">
                      <label className="text-xs sm:text-[13px] font-medium text-neutral-200 block">
                        Attachments (Max 2)
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Drag & Drop Upload Box */}
                        {(draft.attachments || []).length < 2 && (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              void handleFileUpload(e.dataTransfer.files);
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-36 h-22 sm:w-40 sm:h-24 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isDragging
                                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                                : "border-neutral-700/80 hover:border-neutral-500 bg-neutral-900/40 hover:bg-neutral-900/70 text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            {uploadingImage ? (
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                              <Paperclip className="w-4 h-4 text-neutral-400" />
                            )}
                            <span className="text-xs font-normal">
                              {uploadingImage ? "Uploading…" : "Upload File"}
                            </span>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => void handleFileUpload(e.target.files)}
                        />

                        {/* Uploaded thumbnails */}
                        {(draft.attachments || []).map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="relative w-36 h-22 sm:w-40 sm:h-24 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 group"
                          >
                            <img
                              src={getOptimizedImageUrl(imgUrl, 400)}
                              alt="Preview"
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-rose-950 text-white hover:text-rose-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer Actions matching Image 2 */}
                  <div className="p-6 sm:p-7 border-t border-neutral-800/80 flex items-center justify-end gap-3 bg-[#111113] shrink-0">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      disabled={saving}
                      className="h-9 px-5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs sm:text-[13px] font-medium transition-all cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={saving}
                      className="h-9 px-6 rounded-full bg-[#0a381e] hover:bg-[#0f4e2b] border border-[#1b5232]/50 text-[#22c55e] hover:text-[#4ade80] text-xs sm:text-[13px] font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {draft.id && items.some((i) => i.id === draft.id)
                        ? "Save"
                        : "Create"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
