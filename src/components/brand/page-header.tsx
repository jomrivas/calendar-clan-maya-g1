import type { ReactNode } from "react";

/** Encabezado de página con eyebrow de marca y acciones a la derecha. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-purple">
            <span aria-hidden="true" className="h-[3px] w-6 rounded-full bg-gold" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
