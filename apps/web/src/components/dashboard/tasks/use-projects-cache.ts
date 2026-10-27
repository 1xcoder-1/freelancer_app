"use client";

// Projects are referenced by task cards (project_id) and labelled on the
// board card faces and in the detail drawer's Project select. The list is
// fetched ONCE per SPA session and cached at module level — neither surface
// ever re-downloads it and there are no per-card fetches. Failures degrade
// gracefully: surfaces fall back to "No project"/generic labels and a later
// mount retries.

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getProjects, type Project } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";

let projectsCache: Project[] | null = null;
let projectsInflight: Promise<Project[]> | null = null;

async function loadProjects(getToken: () => Promise<string | null>): Promise<Project[]> {
  if (projectsCache) return projectsCache;
  if (!projectsInflight) {
    projectsInflight = (async () => {
      try {
        const token = (await getToken()) || undefined;
        const projects = await getProjects(token);
        projectsCache = projects;
        return projects;
      } finally {
        projectsInflight = null;
      }
    })();
  }
  return projectsInflight;
}

// Full project list for pickers (detail drawer). Null while loading/failed.
export function useProjects(): Project[] | null {
  const { getToken } = useAuth();
  // Lazy initializer reads the warm cache synchronously (instant re-mounts).
  const [projects, setProjects] = useState<Project[] | null>(projectsCache);

  useEffect(() => {
    let cancelled = false;
    // Resolves immediately (microtask) when the cache/inflight already exists;
    // React bails out when the value is identical, so this never loops.
    loadProjects(getToken)
      .then((p) => {
        if (!cancelled) setProjects(p);
      })
      .catch((err) => {
        // Never block the board/drawer: surfaces degrade to generic labels.
        logHandledError("Failed to load projects:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return projects;
}

// id → display name, for cheap chip labels on board card faces.
export function useProjectsNameMap(): Map<string, string> {
  const projects = useProjects();
  return useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.title])), [projects]);
}
