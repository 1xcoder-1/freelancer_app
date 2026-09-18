"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"];
    const captured: Record<string, string> = {};

    utmKeys.forEach((key) => {
      const val = searchParams.get(key);
      if (val) {
        captured[key] = val;
      }
    });

    if (Object.keys(captured).length > 0) {
      try {
        sessionStorage.setItem("freelance_book_utm", JSON.stringify(captured));
      } catch {
        // Safe fallback
      }
    }
  }, [searchParams]);

  return null;
}

export function UtmTracker() {
  return (
    <Suspense fallback={null}>
      <UtmCapture />
    </Suspense>
  );
}
