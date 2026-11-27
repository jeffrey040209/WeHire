export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8012";

export type Identity = { id: number; email: string; roles: string[]; is_admin: boolean };
