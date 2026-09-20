import type { Metadata } from "next";
import { DinnerDetail } from "@/components/dinner-detail";

export const metadata: Metadata = { title: "Dinner" };
export default async function DinnerPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DinnerDetail dinnerId={id} />; }
