import type { Metadata } from "next";

export const metadata: Metadata = { title: "First-time setup" };

export default function Layout({ children }: LayoutProps<"/setup">) {
  return children;
}
