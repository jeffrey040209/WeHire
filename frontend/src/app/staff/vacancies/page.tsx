import { CloudOff } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton, StatePanel } from "@/components/app-frame";
import { VacancyWorkspace } from "@/components/vacancy-workspace";
import type { Identity } from "@/lib/api";
import { SERVER_API_URL } from "@/lib/server-api";

async function ProtectedVacancies({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const token = (await cookies()).get("wehire_session")?.value;
  if (!token) redirect("/sign-in");
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_URL}/auth/me`, { headers: { Cookie: `wehire_session=${token}` }, cache: "no-store" });
  } catch {
    return <StatePanel icon={<CloudOff />} title="Vacancies unavailable" message="Please try again shortly." retryHref="/staff/vacancies" />;
  }
  if (response.status === 401) redirect("/sign-in");
  if (!response.ok) return <StatePanel icon={<CloudOff />} title="Unable to verify access" message="Please try again." retryHref="/staff/vacancies" />;
  const user: Identity = await response.json();
  if (!user.roles.some(r => ["hr", "hiring_manager"].includes(r))) redirect("/access-denied");
  const { id } = await searchParams;
  return <VacancyWorkspace user={user} initialId={id && /^\d+$/.test(id) ? Number(id) : null} />;
}

export default function VacanciesPage(props: { searchParams: Promise<{ id?: string }> }) {
  return <Suspense fallback={<PageSkeleton label="Loading vacancies…" />}><ProtectedVacancies {...props} /></Suspense>;
}
