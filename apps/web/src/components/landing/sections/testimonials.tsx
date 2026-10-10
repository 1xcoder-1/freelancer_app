"use client";

import { Container, Eyebrow, Section } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ========================== TESTIMONIALS ==========================
   Masterji-style wall of quiet cards scrolling vertically: three
   columns, each a seamless CSS marquee (.mk-y-col) moving on the Y
   axis at its own speed/direction, paused on hover, edge-faded.
=================================================================== */

type Testimonial = { name: string; role: string; text: string };

const testimonialColumns: {
  dur: string;
  delay: string;
  reverse?: boolean;
  items: Testimonial[];
}[] = [
  {
    dur: "42s",
    delay: "0s",
    items: [
      {
        name: "Maya Farouk",
        role: "Product designer, Cairo",
        text: "I stopped losing invoices in email threads. Time → invoice in one click pays me a week earlier every month.",
      },
      {
        name: "Tomás Rivera",
        role: "Motion designer, Mexico City",
        text: "Pomodoro and time entries in one place. I finally know my real hourly rate — and I raised it.",
      },
      {
        name: "Jonas Weber",
        role: "Dev contractor, Vienna",
        text: "Replaced Toggl, Notion and FreshBooks. One subscription less, zero tabs lost.",
      },
      {
        name: "Ingrid Halvorsen",
        role: "UX consultant, Oslo",
        text: "The invoice status chips are addicting. Sent, Viewed, Paid — I stopped writing “just checking in” emails entirely.",
      },
      {
        name: "Lucia Moretti",
        role: "Copywriter, Milan",
        text: "The Report Card showed my effective hourly rate. I raised my rates 25% and clients didn't blink.",
      },
    ],
  },
  {
    dur: "55s",
    delay: "-18s",
    reverse: true,
    items: [
      {
        name: "Dan Kowalski",
        role: "Full-stack contractor, Kraków",
        text: "The client book remembers everything I forget. Intake forms alone saved the first hour of every project.",
      },
      {
        name: "Amelie Fontaine",
        role: "Illustrator, Lyon",
        text: "Sent my first invoice in under a minute. My client paid the same day.",
      },
      {
        name: "Sara Haddad",
        role: "Copywriter, Dubai",
        text: "The Report Card showed I was undercharging by 30%. New rates went out the same week.",
      },
      {
        name: "Omar Reyes",
        role: "Web developer, Manila",
        text: "Booking pages and intake forms mean clients sell themselves before the first call. My Sunday-night admin block is gone.",
      },
      {
        name: "Alex Dubeau",
        role: "Video editor, Montréal",
        text: "Time entries turn into invoices without a spreadsheet in sight. Setup took one coffee.",
      },
    ],
  },
  {
    dur: "48s",
    delay: "-31s",
    items: [
      {
        name: "Lukas Meyer",
        role: "Agency of one, Berlin",
        text: "It feels like Notion met an accountant. Slim, fast, and nothing glows at me for no reason.",
      },
      {
        name: "Priya Nair",
        role: "Brand strategist, Bengaluru",
        text: "Book AI drafts proposals that sound like me — and my win rate went from 40% to 65% in a quarter.",
      },
      {
        name: "Nina Petrova",
        role: "Photographer, Sofia",
        text: "Share links with view logs — clients approve contracts without a single email thread.",
      },
      {
        name: "Caleb Mwangi",
        role: "Brand photographer, Nairobi",
        text: "Proposals became contracts in two clicks and the client signed on their phone the same evening.",
      },
      {
        name: "Yuki Tanaka",
        role: "Front-end dev, Osaka",
        text: "Everything is one keystroke away. I live in Ctrl+K now.",
      },
    ],
  },
];

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="w-full rounded-lg border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-mono text-[12px] font-semibold text-fg/80">
          {t.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{t.name}</span>
          <span className="block truncate text-sm text-muted">{t.role}</span>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-fg/90">{t.text}</p>
    </div>
  );
}

export function Testimonials() {
  return (
    <Section id="reviews">
      <Container>
        <Stagger className="max-w-2xl">
          <StaggerItem>
            <Eyebrow>Testimonials</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <h2 className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
              Loved by freelancers
            </h2>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 text-base text-muted sm:text-lg">
              What the book feels like, day to day, for the people who run on it.
            </p>
          </StaggerItem>
        </Stagger>
      </Container>
      <Rise className="relative mt-12 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] sm:mt-16">
        <div className="mx-auto grid h-[540px] max-w-7xl grid-cols-1 gap-4 overflow-hidden px-6 sm:h-[600px] sm:px-8 lg:h-[720px] lg:grid-cols-3">
          {testimonialColumns.map((col, i) => (
            <div
              key={i}
              className={cn(
                "min-w-0 overflow-hidden",
                i === 1 && "hidden sm:block",
                i === 2 && "hidden lg:block"
              )}
            >
              <div
                className="mk-y-col flex flex-col items-stretch gap-4"
                style={{
                  animationDuration: col.dur,
                  animationDelay: col.delay,
                  animationDirection: col.reverse ? "reverse" : "normal",
                }}
              >
                {[...col.items, ...col.items].map((t, j) => (
                  <TestimonialCard key={`${t.name}-${j}`} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Rise>
    </Section>
  );
}
