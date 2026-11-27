import type { Metadata } from "next";

export const metadata: Metadata = { title: "Staff workspace" };

export default function Layout({ children }: LayoutProps<"/staff">) {
  return children;
}
