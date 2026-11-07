import { cn } from "@/lib/utils";

/** Franja de greca maya (motivo del sitio del clan). Decorativa. */
export function Greca({
  tone = "gold",
  className,
}: {
  tone?: "gold" | "brown";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("greca-strip w-full", tone === "brown" && "greca-strip-brown", className)}
    />
  );
}
