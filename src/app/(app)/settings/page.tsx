import type { Metadata } from "next";
import { SpaceSettings } from "@/components/space-settings";

export const metadata: Metadata = { title: "Space settings" };
export default function SettingsPage() { return <SpaceSettings />; }
