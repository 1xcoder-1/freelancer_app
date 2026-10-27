"use client";

import { toast } from "sonner";

let hasShownForSession = false;

export function resetWelcomeSession() {
  hasShownForSession = false;
}

export function showWelcomeToast(userName?: string) {
  if (hasShownForSession) return;
  hasShownForSession = true;

  const now = new Date();
  const hour = now.getHours();

  let salutation: string;
  let tagline: string;

  if (hour >= 5 && hour < 12) {
    salutation = "Good morning";
    tagline = "Have a focused, productive day";
  } else if (hour >= 12 && hour < 17) {
    salutation = "Good afternoon";
    tagline = "Track your projects & daily progress";
  } else if (hour >= 17 && hour < 22) {
    salutation = "Good evening";
    tagline = "Review today's accomplishments";
  } else {
    salutation = "Good night";
    tagline = "Quiet hours focus session";
  }

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const name = userName?.trim();
  const greeting = name ? `👋 ${salutation}, ${name}` : `👋 ${salutation}`;

  toast(greeting, {
    description: `${dateStr} · ${tagline}`,
    duration: 4500,
  });
}
