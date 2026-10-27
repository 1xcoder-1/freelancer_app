"use client";

import { useParams } from "next/navigation";
import { TaskBoard } from "@/components/dashboard/tasks/TaskBoard";

// Full-page task kanban (NOT a popup) — mirrors the sketch board page: the
// dashboard layout gives this route a full-height, un-padded area so the
// columns own the screen. Params are read client-side to keep the shared
// layout lightweight.
export default function TaskBoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params?.boardId;
  if (!boardId) return null;
  return <TaskBoard boardId={boardId} />;
}
