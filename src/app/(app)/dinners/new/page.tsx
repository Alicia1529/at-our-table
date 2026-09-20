import type { Metadata } from "next";
import { NewDinnerForm } from "@/components/new-dinner-form";

export const metadata: Metadata = { title: "New dinner" };
export default function NewDinnerPage() { return <NewDinnerForm />; }
