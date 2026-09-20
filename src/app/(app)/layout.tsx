import { AppShell } from "@/components/app-shell";
import { AppDataProvider } from "@/components/app-data-provider";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <AppDataProvider><AppShell>{children}</AppShell></AppDataProvider>;
}
