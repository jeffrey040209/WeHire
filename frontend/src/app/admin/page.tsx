import { CloudOff, ShieldQuestion } from "lucide-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageSkeleton, StatePanel } from "@/components/app-frame";
import { API_URL, type Identity } from "@/lib/api";
import { AdminConsole } from "@/components/admin-console";

async function ProtectedAdmin() {
  const jar = await cookies();
  const token = jar.get("wehire_session")?.value;
  if (!token) redirect("/sign-in");
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/me`, { headers: { Cookie: `wehire_session=${token}` }, cache: "no-store" });
  } catch {
    return <StatePanel icon={<CloudOff />} title="Administration unavailable" message="Administration is temporarily unavailable. Please try again shortly." retryHref="/admin" />;
  }
  if (response.status === 401) redirect("/sign-in");
  if (!response.ok) return <StatePanel icon={<ShieldQuestion />} title="Verification failed" message="Unable to verify administrator access." retryHref="/admin" />;
  const user: Identity = await response.json();
  if (!user.is_admin || !user.roles.some(role => ["hr", "hiring_manager"].includes(role))) redirect("/access-denied");
  return <AdminConsole user={user} />;
}

export default function AdminPage() {
  return <Suspense fallback={<PageSkeleton variant="admin" label="Loading administration…" />}><ProtectedAdmin /></Suspense>;
}
