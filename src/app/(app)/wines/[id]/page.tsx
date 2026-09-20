import type { Metadata } from "next";
import { WineDetail } from "@/components/wine-detail";

export const metadata: Metadata = { title: "Wine" };
export default async function WineDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <WineDetail wineId={id} />; }
