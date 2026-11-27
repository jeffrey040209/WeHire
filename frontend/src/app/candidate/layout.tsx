import type { Metadata } from "next";

export const metadata: Metadata = { title: "Candidate account" };

export default function Layout({ children }: LayoutProps<"/candidate">) {
  return children;
}
