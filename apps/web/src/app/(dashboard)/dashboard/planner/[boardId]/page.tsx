"use client";

import { useParams } from "next/navigation";
import { PlannerBoardEditor } from "@/components/dashboard/PlannerBoardEditor";

// Full-page board editor (NOT a popup). The dashboard layout gives this route
// a full-height, un-padded area so the canvas owns the screen. Params are read
// client-side to keep the shared layout lightweight.
export default function PlannerBoardPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = params?.boardId;
  if (!boardId) return null;
  return <PlannerBoardEditor boardId={boardId} />;
}
