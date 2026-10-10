"use client";

import * as React from "react";
import {
  AccentButton,
  AppSubTabs,
  AppVisualCard,
  Fraction,
  GroupHeading,
  IconButton,
  PanelHeader,
  Pill,
} from "./primitives";

/* Projects panel (ProjectsPanel.tsx) */
export function ProjectsView() {
  return (
    <div className="space-y-6">
      <PanelHeader
        title="Projects & Deliverables"
        badge="7 Total Projects"
        subtitle="Run each job seamlessly: deliverables, milestones, budget burn, and e-signatures."
        actions={
          <>
            <IconButton label="Refresh" />
            <AccentButton>
              <span>Add Project</span>
            </AccentButton>
          </>
        }
      />

      <AppSubTabs
        active={0}
        tabs={[
          { label: "Active Projects", count: 5 },
          { label: "Archived", count: 2 },
        ]}
      />

      <div className="space-y-4">
        <GroupHeading>Fullstack Web Apps</GroupHeading>
        <div className="grid grid-cols-2 gap-5">
          <AppVisualCard
            title="Website redesign"
            subtitle="By Acme Corp"
            badge={<Fraction current={3} total={5} />}
            tags={
              <>
                <Pill tone="sky">In Progress</Pill>
                <Pill tone="accent" mono>
                  $4,500
                </Pill>
                <Pill tone="warn" mono>
                  6d left
                </Pill>
                <Pill tone="accent" mono>
                  12h unbilled
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Booking flow"
            subtitle="By Nova Studio"
            badge={<Fraction current={1} total={4} />}
            tags={
              <>
                <Pill tone="amber">Planning</Pill>
                <Pill tone="accent" mono>
                  $2,800
                </Pill>
                <Pill tone="danger" mono>
                  2d overdue
                </Pill>
              </>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Ongoing Retainers</GroupHeading>
        <div className="grid grid-cols-2 gap-5">
          <AppVisualCard
            title="Design system v2"
            subtitle="By Helio Media"
            badge={<Fraction current={4} total={4} />}
            tags={
              <>
                <Pill tone="emerald">Completed</Pill>
                <Pill tone="accent" mono>
                  $1,500
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Monthly support"
            subtitle="By Orbit Press"
            badge={<Fraction current={2} total={6} />}
            tags={
              <>
                <Pill tone="sky">In Progress</Pill>
                <Pill tone="accent" mono>
                  $900
                </Pill>
                <Pill tone="accent" mono>
                  4h unbilled
                </Pill>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* Contracts panel (ContractsPanel.tsx) — the versioned-document surface. */
export function ContractsView() {
  return (
    <div className="space-y-6">
      <PanelHeader
        title="Contracts"
        badge="6 Total Contracts"
        subtitle="Send legally binding proposals, agreements, and contracts with real-time signature audit logs."
        actions={
          <>
            <IconButton label="Refresh" />
            <AccentButton>
              <span>Draft Contract</span>
            </AccentButton>
          </>
        }
      />

      <div className="space-y-4">
        <GroupHeading>Awaiting Signature</GroupHeading>
        <div className="grid grid-cols-2 gap-4">
          <AppVisualCard
            title="Brand refresh SOW"
            subtitle="By Client: Acme Corp"
            badge={<Fraction current="★" total="Signed" />}
            tags={
              <>
                <Pill tone="emerald" strong>
                  ★ Executed
                </Pill>
                <Pill tone="accent" mono>
                  v3
                </Pill>
                <Pill tone="neutral" mono>
                  awaiting 2d
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Retainer agreement"
            subtitle="By Client: Nova Studio"
            badge={<Fraction current={1} total="Viewed" />}
            tags={
              <>
                <Pill tone="warn">Viewed by Client</Pill>
                <Pill tone="warn" mono strong>
                  expires in 2d
                </Pill>
                <Pill tone="accent" mono>
                  v2
                </Pill>
              </>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Featured</GroupHeading>
        <div className="grid grid-cols-2 gap-4">
          <AppVisualCard
            title="Master service agreement"
            subtitle="By Client: Helio Media"
            badge={<Fraction current={0} total="Sent" />}
            tags={
              <>
                <Pill tone="sky">Sent</Pill>
                <Pill tone="neutral" mono>
                  awaiting 5d
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Scope add-on"
            subtitle="By Client: Kite Legal"
            badge={<Fraction current={0} total="Draft" />}
            tags={<Pill tone="neutral">Draft</Pill>}
          />
        </div>
      </div>
    </div>
  );
}
