import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getAdminOverview, updateUser } from "@/lib/admin.functions";
import { createUser, updateUserAuth, deleteUser } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { role, loading, user } = useAuth();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const updateFn = useServerFn(updateUser);
  const createFn = useServerFn(createUser);
  const updateAuthFn = useServerFn(updateUserAuth);
  const deleteFn = useServerFn(deleteUser);

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuper = role === "super_admin";

  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn({}),
    enabled: isAdmin,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    qc.invalidateQueries({ queryKey: ["user-roles-all"] });
  };

  const upd = useMutation({
    mutationFn: (vars: any) => updateFn({ data: vars }),
    onSuccess: () => { toast.success("Usuario actualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (vars: any) => createFn({ data: vars }),
    onSuccess: () => { toast.success("Usuario creado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updAuth = useMutation({
    mutationFn: (vars: any) => updateAuthFn({ data: vars }),
    onSuccess: () => { toast.success("Credenciales actualizadas"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (vars: any) => deleteFn({ data: vars }),
    onSuccess: () => { toast.success("Usuario eliminado"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {isSuper
              ? "Crea, edita credenciales, asigna roles y elimina usuarios."
              : "Vista de solo lectura. Solo el Super Admin puede modificar usuarios."}
          </p>
        </div>
        {isSuper && (
          <CreateUserDialog onCreate={(v) => create.mutate(v)} pending={create.isPending} />
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.users ?? []).map((u: any) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={user?.id === u.id}
              isSuper={isSuper}
              currentRole={(roleMap.get(u.id) as string) ?? "user"}
              onSave={(patch) => upd.mutate({ userId: u.id, ...patch })}
              onUpdateAuth={(patch) => updAuth.mutate({ userId: u.id, ...patch })}
              onDelete={() => del.mutate({ userId: u.id })}
              pending={upd.isPending || updAuth.isPending || del.isPending}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserDialog({ onCreate, pending }: { onCreate: (v: any) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const submit = () => {
    onCreate({ email, password, fullName, role });
    setOpen(false);
    setEmail(""); setPassword(""); setFullName(""); setRole("user");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nuevo usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>El usuario se crea con email confirmado.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Correo</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Contraseña</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-1"><Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !email || password.length < 6 || !fullName}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({
  user, currentRole, isSelf, isSuper, onSave, onUpdateAuth, onDelete, pending,
}: {
  user: any;
  currentRole: string;
  isSelf: boolean;
  isSuper: boolean;
  onSave: (p: any) => void;
  onUpdateAuth: (p: any) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState(currentRole);
  const [active, setActive] = useState<boolean>(user.is_active);

  if (!isSuper) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
        <div>
          <div className="font-medium">{user.full_name || user.email}</div>
          <div className="text-xs text-muted-foreground break-all">{user.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{currentRole}</Badge>
          <Badge variant={user.is_active ? "default" : "secondary"}>
            {user.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>
    );
  }

  const isTargetSuper = currentRole === "super_admin";

  return (
    <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1fr_140px_110px_auto_auto_auto] sm:items-center">
      <div className="text-xs text-muted-foreground sm:text-sm break-all">{user.email}</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
      <Select value={role} onValueChange={setRole} disabled={isTargetSuper}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="user">Usuario</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          {isTargetSuper && <SelectItem value="super_admin">Super Admin</SelectItem>}
        </SelectContent>
      </Select>
      <Button variant={active ? "outline" : "secondary"} size="sm" onClick={() => setActive(!active)}>
        <Badge variant={active ? "default" : "secondary"}>{active ? "Activo" : "Inactivo"}</Badge>
      </Button>
      <Button
        size="sm"
        onClick={() =>
          onSave({
            fullName: name,
            isActive: active,
            ...(isTargetSuper ? {} : { role }),
          })
        }
        disabled={pending}
      >
        Guardar
      </Button>
      <EditCredentialsDialog user={user} onSave={onUpdateAuth} pending={pending} />
      <DeleteUserButton disabled={pending || isSelf || isTargetSuper} onConfirm={onDelete} email={user.email} />
    </div>
  );
}

function EditCredentialsDialog({
  user, onSave, pending,
}: { user: any; onSave: (p: any) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");

  const submit = () => {
    const patch: any = {};
    if (email && email !== user.email) patch.email = email;
    if (password) patch.password = password;
    if (Object.keys(patch).length === 0) { setOpen(false); return; }
    onSave(patch);
    setPassword("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><KeyRound className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar credenciales</DialogTitle>
          <DialogDescription>Actualiza correo y/o contraseña.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Correo</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Nueva contraseña</Label>
            <Input type="password" value={password} placeholder="Dejar vacío para no cambiar"
              onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserButton({
  onConfirm, disabled, email,
}: { onConfirm: () => void; disabled: boolean; email: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={disabled}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará {email} junto con sus asistencias. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
