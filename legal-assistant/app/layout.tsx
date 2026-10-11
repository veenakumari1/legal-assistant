import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Drafting Assistant",
  description: "Generate editable first drafts of common legal documents and export them as PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
