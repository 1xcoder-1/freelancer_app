"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { validateOrToast } from "@/lib/validation";
import { z } from "zod";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { ProfileField, UnderlineInput } from "./profile-fields";
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
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage } from "@/lib/image-compressor";
import { uploadFileToCloudinary, type ProfileCertification } from "@/lib/api";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

const EMPTY: ProfileCertification = {
  id: "",
  name: "",
  issuer: "",
  issue_date: "",
  expiry_date: "",
  credential_id: "",
  credential_url: "",
  does_not_expire: false,
  attachments: [],
};

export function getOptimizedImageUrl(url?: string, width = 600): string {
  if (!url) return "";
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url;
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

function formatDisplayMonthYear(str: string): string {
  if (!str) return "";
  const d = parseCustomDate(str);
  if (d) {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return str;
}

function formatCertificationTimeline(
  issueStr: string,
  expiryStr: string,
  doesNotExpire?: boolean
): string {
  const issueFormatted = formatDisplayMonthYear(issueStr);
  const expiryFormatted = formatDisplayMonthYear(expiryStr);

  if (issueFormatted) {
    if (doesNotExpire) {
      return `Issued ${issueFormatted} · No Expiration`;
    }
    if (expiryFormatted) {
      return `Issued ${issueFormatted} · Expires ${expiryFormatted}`;
    }
    return `Issued ${issueFormatted}`;
  }

  if (doesNotExpire) {
    return "No Expiration";
  }

  if (expiryFormatted) {
    return `Expires ${expiryFormatted}`;
  }

  return "";
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

  // Monday = 0, Sunday = 6
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
            {/* Calendar Header matching Image 2 */}
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

            {/* Weekday headers M T W T F S S */}
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

            {/* Days grid with blue active selection */}
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

export function CertificationsTab({
  items,
  onUpsert,
  onDelete,
}: {
  items: ProfileCertification[];
  onUpsert: (item: ProfileCertification) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { getToken } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileCertification>(EMPTY);
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

  const openEdit = (item: ProfileCertification) => {
    setDraft({
      ...item,
      does_not_expire: item.does_not_expire ?? false,
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
          name: z.string().trim().min(1, "Certification name is required"),
          issuer: z.string().trim().min(1, "Issuing organization is required"),
        }),
        { name: draft.name, issuer: draft.issuer }
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

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row matching Image 1 */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-400 font-normal">
          Showcase your verified professional credentials.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="h-8.5 px-4 rounded-full bg-[#1c1c1f] hover:bg-[#27272a] border border-neutral-800 text-neutral-200 hover:text-white text-xs sm:text-[13px] font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-neutral-300" />
          Add Certification
        </button>
      </div>

      {/* Certifications List Cards matching Image 1, 4 & 5 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800/80 bg-[#121214]/40 px-6 py-12 text-center">
          <p className="text-sm text-neutral-400 font-normal">No certifications added</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const certInitial = (item.name || "C").charAt(0).toUpperCase();
            const timelineText = formatCertificationTimeline(
              item.issue_date,
              item.expiry_date,
              item.does_not_expire
            );

            return (
              <div
                key={item.id}
                onClick={() => toggleExpand(item.id)}
                className="rounded-2xl border border-dashed border-neutral-800 hover:border-neutral-700 bg-transparent p-5 sm:p-6 transition-colors cursor-pointer select-none"
              >
                {/* Header info row matching Image 4 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Badge */}
                    <div className="w-12 h-12 rounded-xl bg-[#1c1c1f] border border-neutral-800 flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-inner">
                      {certInitial}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-semibold text-white tracking-tight truncate">
                        {item.name || "Certification"}
                      </h4>
                      <p className="text-xs sm:text-[13px] text-neutral-300 font-medium mt-0.5 truncate">
                        {item.issuer}
                      </p>
                      {timelineText && (
                        <p className="text-xs sm:text-[13px] text-neutral-400 font-normal mt-1">
                          {timelineText}
                        </p>
                      )}
                      {item.credential_id && (
                        <p className="text-xs sm:text-[13px] text-neutral-400 font-normal mt-0.5">
                          Credential ID {item.credential_id}
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

                {/* Expanded content matching Image 5 */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-4">
                        {/* Show credential button */}
                        {item.credential_url && (
                          <div className="pt-1">
                            <a
                              href={item.credential_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700/80 bg-neutral-900/80 hover:bg-neutral-800 text-xs text-neutral-200 hover:text-white font-medium transition-all shadow-xs"
                            >
                              <span>Show credential</span>
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                            </a>
                          </div>
                        )}

                        {/* Attachments thumbnails */}
                        {item.attachments && item.attachments.length > 0 && (
                          <div className="pt-1">
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
                                    className="w-36 h-22 sm:w-40 sm:h-24 object-cover transition-transform duration-300 group-hover:scale-105"
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

      {/* Slide-Over Drawer matching Image 2 & 3 portaled to document.body */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {drawerOpen && (
              <div className="fixed inset-0 z-[999] overflow-hidden flex justify-end">
                {/* Dark semi-transparent backdrop */}
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
                        ? "Edit Certification"
                        : "Add Certification"}
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
                    {/* Row 1: Certification Name & Issuing Organization */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Certification Name" required>
                        <div className="relative">
                          <UnderlineInput
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            placeholder="Ex: AWS Certified Solutions Architect"
                            className="pr-6"
                          />
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                        </div>
                      </ProfileField>

                      <ProfileField label="Issuing Organization" required>
                        <div className="relative">
                          <UnderlineInput
                            value={draft.issuer}
                            onChange={(e) =>
                              setDraft({ ...draft, issuer: e.target.value })
                            }
                            placeholder="Ex: Amazon Web Services (AWS)"
                            className="pr-6"
                          />
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-1 top-3 pointer-events-none" />
                        </div>
                      </ProfileField>
                    </div>

                    {/* Row 2: Credential ID & Credential URL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Credential ID">
                        <UnderlineInput
                          value={draft.credential_id}
                          onChange={(e) =>
                            setDraft({ ...draft, credential_id: e.target.value })
                          }
                          placeholder="Enter credential ID"
                        />
                      </ProfileField>

                      <ProfileField label="Credential URL">
                        <UnderlineInput
                          type="url"
                          value={draft.credential_url}
                          onChange={(e) =>
                            setDraft({ ...draft, credential_url: e.target.value })
                          }
                          placeholder="https://"
                        />
                      </ProfileField>
                    </div>

                    {/* Row 3: This credential does not expire toggle */}
                    <div className="pt-1">
                      <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.does_not_expire}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              does_not_expire: !draft.does_not_expire,
                              expiry_date: !draft.does_not_expire ? "" : draft.expiry_date,
                            })
                          }
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                            draft.does_not_expire
                              ? "bg-amber-600"
                              : "bg-neutral-800 border border-neutral-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                              draft.does_not_expire ? "translate-x-5" : ""
                            }`}
                          />
                        </button>
                        <span className="text-xs sm:text-sm font-normal text-neutral-200">
                          This credential does not expire
                        </span>
                      </label>
                    </div>

                    {/* Row 4: Issue Date & Expiration Date with Popover Calendar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <ProfileField label="Issue Date" required>
                        <DatePickerInput
                          value={draft.issue_date}
                          onChange={(val) => setDraft({ ...draft, issue_date: val })}
                          placeholder="dd / mm / yyyy"
                        />
                      </ProfileField>

                      <ProfileField
                        label="Expiration Date"
                        required={!draft.does_not_expire}
                      >
                        <DatePickerInput
                          value={draft.does_not_expire ? "" : draft.expiry_date}
                          onChange={(val) => setDraft({ ...draft, expiry_date: val })}
                          placeholder="dd / mm / yyyy"
                          disabled={draft.does_not_expire}
                        />
                      </ProfileField>
                    </div>

                    {/* Row 5: Attachments (Max 2) with Drag & Drop Upload */}
                    <div className="space-y-3 pt-1">
                      <label className="text-xs sm:text-[13px] font-medium text-neutral-200 block">
                        Attachments (Max 2)
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Drag & Drop Upload box */}
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
