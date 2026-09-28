# Freelance Book — Features & Libraries Master List

1. **Cash-Flow & Financial Runway Dashboard** [`recharts`, `@tanstack/react-table`, `lucide-react`, `sqlalchemy`, `asyncpg`]
   - 1.1 Cash in Bank, 14/30/60 Days Expected Cash & Overdue Breakdown
   - 1.2 Monthly Burn Rate & Visual Weeks-of-Runway Gauge
   - 1.3 Invoiced vs. Cleared Real Cash Tracker
   - 1.4 Safe-to-Spend & Vacation Cash Reserve Indicator

2. **Smart Invoicing & Client Payment Portal** [`stripe`, `inngest`, `resend`, `weasyprint`, `@radix-ui/react-tooltip`, `sonner`, `lucide-react`]
   - 2.1 1-Click Invoice Generator from Milestones, Projects & Timer Logs
   - 2.2 Custom Branding, Payment Terms & 1.5%/Month Late-Fee Penalty Engine
   - 2.3 Live Read Receipts (Client Open Timestamp & IP Tracking)
   - 2.4 Automated Reminders (Day -3 polite, Day +4 firm, Day +10 late fee addition)
   - 2.5 Online Payment Portal with Stripe, PayPal, Bank Transfer & Partial Milestone Payments

3. **Deposit Enforcer & Pay-to-Unlock Deliverable Vault** [`stripe`, `inngest`, `pillow`, `aioboto3`, `cryptography`, `file-saver`, `canvas-confetti`]
   - 3.1 Mandatory Upfront Deposit Rule (40/30/30 or 50/50 with Auto-Lock on "On Hold")
   - 3.2 Deliverable Vault with Watermarked File Previews
   - 3.3 Instant Auto-Unlock & Download Release upon Final Stripe Payment Confirmation

4. **Living Scope Document & Change Request Engine** [`@tiptap/react`, `@tiptap/starter-kit`, `react-signature-canvas`, `canvas-confetti`, `sonner`, `lucide-react`]
   - 4.1 Contract-Linked Living Scope Statement of Work (SOW)
   - 4.2 1-Click Client Change Request with Freelancer Price & Timeline Impact
   - 4.3 1-Tap Client Approval with Auto-Generated Invoice & Contract Addendum
   - 4.4 Client Revision Counter ("1 of 2 left") with Auto-Quote on Overages
   - 4.5 Sequential Phase Gate Deliverable Approvals

5. **Client CRM, Payment Health Scorecard & Retention Engine** [`@tanstack/react-table`, `@tanstack/react-query`, `framer-motion`, `inngest`, `resend`, `sonner`, `lucide-react`]
   - 5.1 Client Payment Health Scorecard (Avg Days to Pay, Overdue History & Green/Yellow/Red Risk Badges)
   - 5.2 Relationship Health & Churn Risk Monitor
   - 5.3 Automated Post-Project Nurture Sequences (Day 3 Testimonial, Day 14 Check-in, Day 45 Retainer Pitch)
   - 5.4 Ghosting Detector (Auto-Deadlines Adjustment, Polite Nudges & 10-Day Project Pause Notice)
   - 5.5 1-Click Monthly Recurring Retainer Builder & MRR Tracker

6. **Capacity-Aware Pipeline Board & Public Availability Page** [`@dnd-kit/core`, `@dnd-kit/sortable`, `recharts`, `sqlalchemy`, `asyncpg`, `lucide-react`]
   - 6.1 Drag-and-Drop Leads-to-Projects Kanban Pipeline
   - 6.2 2/4/8-Week Committed Billable Hours Heatmap with Overbooked (>40h) & Underbooked (<15h) Alerts
   - 6.3 Public Availability Calendar Badge on Portfolio ("Booking 2 Spots for Next Month")
   - 6.4 Proposal Web View Tracking (Open Receipt, Reading Duration & Pricing View)
   - 6.5 Portfolio CTA Lead Magnet Integration ("Book Audit" / "Get Rate Card" → CRM Lead)

7. **Expense Capture, Tax Jar & Accountant Export** [`react-dropzone`, `@tanstack/react-table`, `file-saver`, `weasyprint`, `pandas`, `httpx`, `pillow`, `aioboto3`]
   - 7.1 Mobile Receipt Photo Capture & Auto-Categorization (Software, Hardware, Office, Travel, Contractor)
   - 7.2 25%–30% Virtual Tax Jar Set-Aside Calculator & Quarterly Tax Countdown
   - 7.3 1-Click Audit-Ready Accountant Package Export (ZIP Bundle of Invoices CSV, Receipts & P&L PDF)

8. **Task Time Tracker & 1-Click Invoice Bridge** [`date-fns`, `lucide-react`, `sonner`, `sqlalchemy`, `asyncpg`]
   - 8.1 Floating Start/Stop Task & Project Timer
   - 8.2 1-Click Conversion of Logged Billable Hours into Itemized Invoice Line Items

9. **Weekly Business Pulse & Boundary Control Hub** [`framer-motion`, `lucide-react`, `inngest`, `date-fns`]
   - 9.1 Monday Morning Pulse Scorecard (Runway, Booked Hours, Overdue Invoices & Key Insights)
   - 9.2 Working Hours & Response Time Expectation Banner ("Replies within 4 hours during work days")
   - 9.3 After-Hours Out-of-Office Auto-Replies
   - 9.4 Freelancer Wins Logger & Consecutive Overwork (>45h/wk) Burnout Warning

10. **Category-Specific Collaboration Workspace** [`fabric`, `@excalidraw/excalidraw`, `@tiptap/react`, `cryptography`, `recharts`, `pillow`, `aioboto3`]
    - 10.1 Designers: Visual Canvas Proofing (Pin Comments on Mockups) & Brand Kit Locker
    - 10.2 Developers: Technical Spec Lock, Acceptance Criteria Checklist & Encrypted Credential Vault
    - 10.3 Writers & Marketers: Structured Brief Builder, 5-Item Feedback Constraint & Campaign ROI Tracker
    - 10.4 Consultants: Live Session Notes Sync & Automated Follow-Up Task Generator


11. Analysis: The Daily Focus & Capacity Planner Page
The Core Problem Freelancers Face
Most freelancers juggle 3–5 active clients simultaneously. Traditional to-do apps fail them because:

Tasks are disconnected from billable time tracking and financial milestones.
Freelancers overcommit their working hours because they cannot visualize real capacity vs. deadline promises.
Project assets, client briefs, and review links are scattered across Notion, Slack, Drive, and email.
How the Planner Page Solves This
The Daily Focus & Capacity Planner acts as the freelancer's daily mission control:

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📅 TODAY: Oct 24, 2026               🟢 Capacity: 5.5h / 6.0h Target        │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ 🎯 Top 3 High-Impact Priorities   │ ⏱️ Time-Blocked Schedule (Visual Flow) │
│ [x] Stripe Checkout Fix (Acme Co) │ 09:00 - 11:30 [Deep Work] Stripe API    │
│ [ ] Figma Wireframes v2 (Nike)    │ 11:30 - 12:00 [Client Review] Sync      │
│ [ ] Send Invoice #1042 ($2,500)   │ 13:00 - 15:30 [Design] Figma Mobile UI  │
├───────────────────────────────────┴─────────────────────────────────────────┤
│ 🔗 Quick-Attached Assets & Files (One-click launch to Figma, Repo, R2 Vault)│
└─────────────────────────────────────────────────────────────────────────────┘
Billable vs. Non-Billable Time Blocking: Direct 1-click timer launch from planned blocks with automatic milestone linking.
Overcommitment Alert: Visual warning when booked hours exceed sustainable daily capacity (e.g. > 6.5h billable).
Asset Quick-Dock: Attaches active files, GitHub branches, and Figma frames directly to the daily plan so there is zero search friction.


12. 🔐 Pay-to-Unlock Deliverable & Asset Vault
Freelancer Problem: Clients taking high-resolution final assets (source code, Figma files, 4K exports) and ghosting on final payment (Net-30 turns into Net-90 or non-payment).
The Solution: A secure deliverable hub where clients can inspect watermarked/low-res previews or sandboxed code demos. The raw assets auto-unlock and generate instant download links only when Stripe confirms final payment.
Key Components: Watermarking engine, Cloudflare R2 signed download tokens, Stripe webhook auto-release.
13. 🗄️ Client Brand Kit & Production Asset Locker
Freelancer Problem: Constantly asking clients for SVG logos, brand guidelines, typography licenses, color hex codes, and production assets buried in long email chains.
The Solution: A dedicated workspace per client storing all verified logos, hex palettes, typography files, copy decks, and media assets with quick copy-to-clipboard for hex/CSS tokens and asset version history.
Key Components: Asset categorization (Logos, Fonts, Media, Guidelines), one-click CDN asset share links, color swatch palette viewer.
14. 🛡️ Scope-Creep Shield & Change Request Hub
Freelancer Problem: Clients requesting "quick small tweaks" that blow project timelines and budgets by 40% without formal compensation.
The Solution: A live Statement of Work (SOW) tracker displaying the agreed deliverables, remaining revisions (e.g., “1 of 3 revisions used”), and a 1-click client change request form that automatically calculates price/timeline impact and requires client digital signature before work starts.
Key Components: Revision counter, TipTap contract viewer, signature pad, instant invoice addendum generator.
15. 🔑 Encrypted Client Credential & Secret Keychain
Freelancer Problem: Receiving production passwords, API keys, staging server credentials, and WordPress logins over unencrypted WhatsApp or Slack messages.
The Solution: A zero-knowledge encrypted vault where clients and freelancers securely share SSH keys, env variables, CMS logins, and API tokens with 1-click expiry dates and copy-to-clipboard obfuscation.
Key Components: Client-side AES-GCM encryption, secret masking, one-time viewing links, role-based access logs.
16. 🗓️ Capacity-Aware Availability & Rate-Card Portal
Freelancer Problem: Inquiries coming in when overbooked, resulting in rushed deadlines or frantic back-and-forth emails negotiating rates and start dates.
The Solution: A clean, public-facing booking page displaying verified real-time availability (e.g., “Booking 2 project slots for Next Month”), baseline rate cards, project intake questionnaire, and upfront deposit payment collection before booking discovery calls.
Key Components: Dynamic slot availability badge, custom intake form builder, Stripe deposit checkout integration.
17. 🎨 Visual Proofing & Interactive Canvas Review Hub
Freelancer Problem: Feedback given as messy, unstructured bullet points (e.g., "Make the top header bigger and change the red button"), causing multiple iterations of misunderstandings.
The Solution: An interactive review canvas where clients can pin comments, draw arrows, and annotate directly on design mockups, PDF drafts, or video timestamps with status tags (To Do, In Progress, Resolved).
Key Components: Canvas annotation layer, timestamp video proofing, comment resolution threads with email notifications.
18. 🚦 Phase-Gated Deliverable & Deposit Enforcer
Freelancer Problem: Starting work without a deposit, or working on Phase 3 before the client has formally approved and paid for Phase 1.
The Solution: A milestone workflow engine enforcing sequential phase gates: Phase 2 cannot be unlocked or delivered until Phase 1 deliverables are marked as approved and the milestone invoice is settled.
Key Components: Visual milestone pipeline, milestone approval sign-off modal, automatic invoice generation upon milestone sign-off.
19. 📊 Virtual Tax Jar & 1-Click Accountant Export Hub
Freelancer Problem: Reaching tax season in panic with unorganized business expenses, lost PDF receipts, and unexpected tax bills.
The Solution: Automatically routes 25%–30% of incoming revenue to a virtual "Tax Jar" reserve gauge, categorizes expense receipts via camera capture, and generates a 1-click ZIP bundle containing CSV ledgers, categorized receipts, and a P&L summary for the accountant.
Key Components: Tax estimation engine, receipt upload with auto-tagging, PDF & ZIP report generator.
20. 📡 Client Health & Ghosting Detection Radar
Freelancer Problem: Clients disappearing for weeks mid-project, leaving projects in limbo and wrecking the freelancer's schedule.
The Solution: An automated CRM tracker calculating a Client Health Score based on average payment delay, feedback turnaround time, and communication gaps. If a client is inactive for >7 days, it automatically drafts polite check-in nudges and pauses project milestone deadlines.
Key Components: Inactivity countdown timer, automatic deadline adjustment rules, pre-written nudge email sequences.
10. 📜 Offboarding, Rights Transfer & Retainer Pitch Engine
Freelancer Problem: Project wraps up, but freelancer forgets to collect testimonials, transfer formal intellectual property (IP) rights, or upsell the client into recurring monthly maintenance/retainer contracts.
The Solution: A structured project completion workflow that generates a formal IP Rights Transfer Certificate upon final payment, collects a star rating & video/text testimonial, and presents a 1-click monthly retainer proposal (e.g. "$500/mo for 10h support & maintenance").
Key Components: PDF certificate generator, testimonial submission form with embeddable widget, recurring retainer contract build