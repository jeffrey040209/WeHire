import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administration" };

export default function Layout({ children }: LayoutProps<"/admin">) {
  return children;
}
