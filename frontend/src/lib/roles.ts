/** Human-readable role names. Plain module so server and client components can both use it. */
export const roleLabel = (role: string) => ({ hr: "HR", hiring_manager: "Hiring manager", candidate: "Candidate" } as Record<string, string>)[role] ?? role.replaceAll("_", " ");
