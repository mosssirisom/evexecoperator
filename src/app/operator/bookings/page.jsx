import { redirect } from "next/navigation";

// The "Automation" page showed mock, non-functional automation cards. It was
// removed from the operator app to avoid presenting features that aren't wired;
// real missed-call recovery is surfaced in the header alerts. This route
// redirects so any old links keep working.
export default function BookingsRedirect() {
  redirect("/operator/dispatch");
}
