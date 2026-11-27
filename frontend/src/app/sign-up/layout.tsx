import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create a candidate account" };

export default function Layout({ children }: LayoutProps<"/sign-up">) {
  return children;
}
