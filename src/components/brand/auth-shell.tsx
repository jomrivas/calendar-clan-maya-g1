import type { ReactNode } from "react";
import clanMayaLogo from "@/assets/clan-maya-logo.png";
import { BrandMark } from "@/components/brand/brand-mark";
import { Greca } from "@/components/brand/greca";

/** Pantalla de acceso: panel de bienvenida (navy) + formulario (crema). */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Panel de marca */}
      <section className="bg-maya-hero relative flex flex-col overflow-hidden text-cream lg:w-[46%]">
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 text-center lg:py-16">
          <img
            src={clanMayaLogo}
            alt="Escudo del Clan Maya G1"
            className="h-24 w-24 rounded-3xl bg-cream object-contain p-2 shadow-2xl ring-4 ring-gold/30 lg:h-40 lg:w-40"
          />
          <span className="bg-gold-gradient mt-6 inline-flex rounded-full px-4 py-1.5 font-display text-[11px] font-bold tracking-[0.25em] text-navy shadow-lg">
            GRUPO SCOUT No. 1
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight text-cream lg:text-5xl">
            Conectando
            <span className="block bg-gradient-to-br from-gold-2 to-gold bg-clip-text text-transparent">
              pasado y futuro
            </span>
          </h1>
          <p className="mt-4 hidden max-w-sm text-cream/80 lg:block">
            Registrá tu asistencia sabatina, justificá permisos y seguí tu avance del semestre.
          </p>
        </div>
        <Greca className="relative z-10" />
      </section>

      {/* Formulario */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <BrandMark className="mb-8 hidden lg:flex" />
          <h2 className="text-2xl font-bold text-navy">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Siempre listos para servir · Clan Maya G1
          </p>
        </div>
      </section>
    </div>
  );
}
