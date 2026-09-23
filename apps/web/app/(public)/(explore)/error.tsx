"use client";
import { ErrorState } from "@/components/ui/states";
export default function RegistryError({ reset }: { reset: () => void }) {
  return <ErrorState title="Registry unavailable" text="We couldn’t load the data. Please try again later." reset={reset} />;
}
