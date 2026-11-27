import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access restricted" };

export default function Layout({ children }: LayoutProps<"/access-denied">) {
  return children;
}
