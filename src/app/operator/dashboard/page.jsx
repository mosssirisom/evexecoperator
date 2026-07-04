import { redirect } from "next/navigation";

// The standalone Dashboard duplicated Dispatch (its lists and driver panel just
// routed there). It was folded into Dispatch to streamline the operator app;
// this route now redirects so any old links keep working.
export default function DashboardRedirect() {
  redirect("/operator/dispatch");
}
