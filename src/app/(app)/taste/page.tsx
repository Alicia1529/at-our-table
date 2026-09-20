import type { Metadata } from "next";
import { TasteProfile } from "@/components/taste-profile";

export const metadata: Metadata = { title: "Our taste" };
export default function TastePage() { return <TasteProfile />; }
