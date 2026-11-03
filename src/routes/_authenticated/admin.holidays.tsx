import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { addHoliday, removeHoliday } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/holidays")({ component: HolidaysPage });

function HolidaysPage() {
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const addFn = useServerFn(addHoliday);
  const rmFn = useServerFn(removeHoliday);

  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuper = role === "super_admin";

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays_sv")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const add = useMutation({
    mutationFn: (v: { date: string; name: string }) => addFn({ data: v }),
    onSuccess: () => {
      toast.success("Feriado agregado");
      setDate(""); setName("");
      qc.invalidateQueries({ queryKey: ["holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rm = useMutation({
    mutationFn: (d: string) => rmFn({ data: { date: d } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays-admin"] });
      qc.invalidateQueries({ queryKey: ["holidays"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Feriados (El Salvador)</h1>
        <p className="text-sm text-muted-foreground">
          Los sábados que coinciden con feriados quedan excluidos del cálculo.
        </p>
      </header>

      {isSuper && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar feriado</CardTitle>
            <CardDescription>Fecha y descripción</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
              <Input
                placeholder="Nombre del feriado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button
                onClick={() => add.mutate({ date, name })}
                disabled={!date || !name || add.isPending}
              >
                {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {holidays.map((h: any) => (
              <div
                key={h.holiday_date}
                className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{h.holiday_date}</span>
                  <span className="ml-2 text-muted-foreground">{h.name}</span>
                </div>
                {isSuper && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => rm.mutate(h.holiday_date)}
                    disabled={rm.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
