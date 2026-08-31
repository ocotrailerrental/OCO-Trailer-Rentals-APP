import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { OcoLockup } from "@/components/OcoLogo";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [{ title: "Frequently asked questions · OCO Trailer Rentals" }],
  }),
  component: FaqPage,
});

const questions = [
  [
    "When is my reservation confirmed?",
    "Submitting the form creates a reservation request. The local OCO team reviews availability and changes the status to confirmed before pickup.",
  ],
  [
    "When am I charged?",
    "The current app does not collect card numbers or make online charges. Cash or card payment is handled at pickup and recorded by authorized staff.",
  ],
  [
    "How are rental days counted?",
    "Pickup and return dates are both billable days. A same-day rental is one day.",
  ],
  [
    "Can I return to a different location?",
    "Yes, when the selected trailer and both OCO locations are available for the requested dates.",
  ],
  [
    "What is the security deposit?",
    "It is shown separately from the amount due. It is not revenue and is only chargeable when a documented return inspection finds covered damage.",
  ],
  [
    "How does contactless pickup work?",
    "Open your reservation, start the pickup inspection, photograph the required trailer views, note existing damage, and complete the inspection. Repeat the process when returning the trailer.",
  ],
  [
    "Who can see inspection photos?",
    "Only the customer on the reservation and authorized OCO managers, admins, or owners. A manager is restricted to rentals assigned to that manager’s yard.",
  ],
  [
    "Can I use a discount code?",
    "Enter the code during reservation checkout. Eligibility, date limits, yard limits, minimum days, and usage limits are checked by the database when you submit.",
  ],
];

function FaqPage() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
          <Link to="/">
            <OcoLockup />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Help center
        </p>
        <h1 className="mt-3 font-serif text-5xl">Frequently asked questions</h1>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-6">
          {questions.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="cursor-pointer list-none pr-8 font-semibold">
                {question}
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {answer}
              </p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Still need help?{" "}
          <Link
            to="/contact"
            className="font-semibold text-primary hover:underline"
          >
            Contact the OCO team.
          </Link>
        </p>
      </section>
    </main>
  );
}
