import type { Metadata } from "next";
import { DinnerDetail } from "@/components/dinner-detail";
import { getDinner } from "@/lib/mock-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const { id } = await params; return { title: getDinner(id).title }; }
export default async function DinnerPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DinnerDetail dinner={getDinner(id)} />; }
