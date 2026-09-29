import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata = {
  title: "CITfix — Complaint & Maintenance Portal",
  description: "Campus complaint and maintenance management system"
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><div className="shell"><Nav />{children}<footer className="footer">CITfix • Campus Complaint & Maintenance Portal</footer></div></body></html>;
}
