import type { Metadata } from "next";
import { WineLibraryPage } from "@/components/wine-library-page";

export const metadata: Metadata = { title: "Wine journal" };
export default function WinesPage() { return <WineLibraryPage />; }
