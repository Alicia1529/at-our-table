import { SharedDinner } from "@/components/shared-dinner";

export default async function SharedDinnerPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <SharedDinner token={token} />; }
