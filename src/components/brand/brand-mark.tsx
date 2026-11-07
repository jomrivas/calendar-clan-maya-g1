import clanMayaLogo from "@/assets/clan-maya-logo.png";
import { cn } from "@/lib/utils";

/** Logo + nombre del clan. `inverse` para fondos oscuros (navy). */
export function BrandMark({
  inverse = false,
  size = "md",
  subtitle = "Asistencia sabatina",
  className,
}: {
  inverse?: boolean;
  size?: "md" | "lg";
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={clanMayaLogo}
        alt=""
        className={cn(
          "shrink-0 rounded-xl bg-cream object-contain p-1 shadow-md",
          size === "lg" ? "h-14 w-14" : "h-10 w-10",
        )}
      />
      <div className="leading-tight">
        <div
          className={cn(
            "font-display font-extrabold tracking-wide",
            size === "lg" ? "text-xl" : "text-base",
            inverse ? "text-cream" : "text-navy",
          )}
        >
          CLAN MAYA G1
        </div>
        <div
          className={cn(
            "whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em]",
            inverse ? "text-gold-2" : "text-purple",
          )}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
