import { redirect } from "next/navigation";

// The standalone calendar has been folded into the operator portal. The root
// now sends visitors straight to the portal's Calendar tab; the calendar view
// itself lives on at /operator/calendar (see @/components/CalendarApp).
export default function Page() {
  redirect("/operator/calendar");
}
