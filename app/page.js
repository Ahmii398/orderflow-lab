// app/page.js
// Landing route ("/"). This project has no real "home page" content yet —
// it simply redirects visitors straight to the dashboard.
//
// Later this could become a marketing/landing page instead, in which case
// swap the redirect() call for actual JSX.

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
