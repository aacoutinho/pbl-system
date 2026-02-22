import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Plus, Trash2, Clock, ShieldCheck, BookOpen } from "lucide-react";

export default function ProfessorsPage() {
  return (
    <DashboardLayout>
      <ProfessorsContent />
    </DashboardLayout>
  );
}

function ProfessorsContent() {
  const utils = trpc.useUtils();

  const { data: pendingList, isLoading: loadingPending } = trpc.professors.pending.useQuery();
  const { data: approvedList, isLoading: loadingApproved } = trpc.professors.approved.useQuery();
  const { data: allComponents } = trpc.professors.allComponents.useQuery();

  const approveMut = trpc.professors.approve.useMutation({
    onSuccess: () => {
      utils.professors.pending.invalidate();
      utils.professors.approved.invalidate();
      toast.success("Professor aprovado com sucesso");
    },
  });

  const rejectMut = trpc.professors.reject.useMutation({
    onSuccess: () => {
      utils.professors.pending.invalidate();
      toast.success("Solicitação rejeitada");
    },
  });

  const addComponentMut = trpc.professors.addComponent.useMutation({
    onSuccess: () => {
      utils.professors.allComponents.invalidate();
      toast.success("Componente adicionado");
    },
  });

  const removeComponentMut = trpc.professors.removeComponent.useMutation({
    onSuccess: () => {
      utils.professors.allComponents.invalidate();
      toast.success("Componente removido");
    },
  });

  // Group components by professor
  const componentsByProfessor: Record<number, { name: string; email: string; components: string[] }> = {};
  if (allComponents) {
    for (const c of allComponents) {
      if (!componentsByProfessor[c.userId]) {
        componentsByProfessor[c.userId] = { name: c.professorName || "-", email: c.professorEmail || "-", components: [] };
      }
      componentsByProfessor[c.userId].components.push(c.componentCode);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Professores</h1>
        <p className="text-muted-foreground">Gerencie o acesso de professores e seus componentes curriculares.</p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Solicitações Pendentes
          </CardTitle>
          <CardDescription>Professores que se cadastraram e aguardam aprovação.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !pendingList || pendingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendingList.map((prof) => (
                <div key={prof.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
                  <div>
                    <p className="font-medium">{prof.name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{prof.email || "Sem e-mail"}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em {new Date(prof.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate({ userId: prof.id })}
                      disabled={approveMut.isPending}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMut.mutate({ userId: prof.id })}
                      disabled={rejectMut.isPending}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Professors with Components */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            Professores Autorizados
          </CardTitle>
          <CardDescription>Professores aprovados e seus componentes curriculares.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingApproved ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !approvedList || approvedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum professor aprovado.</p>
          ) : (
            <div className="space-y-4">
              {approvedList.map((prof) => (
                <ProfessorCard
                  key={prof.id}
                  professor={prof}
                  components={componentsByProfessor[prof.id]?.components || []}
                  onAddComponent={(componentCode) => addComponentMut.mutate({ userId: prof.id, componentCode })}
                  onRemoveComponent={(componentCode) => removeComponentMut.mutate({ userId: prof.id, componentCode })}
                  isAdding={addComponentMut.isPending}
                  isRemoving={removeComponentMut.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfessorCard({
  professor,
  components,
  onAddComponent,
  onRemoveComponent,
  isAdding,
  isRemoving,
}: {
  professor: { id: number; name: string | null; email: string | null; createdAt: Date };
  components: string[];
  onAddComponent: (code: string) => void;
  onRemoveComponent: (code: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}) {
  const [newComponent, setNewComponent] = useState("");

  const handleAdd = () => {
    const code = newComponent.trim().toUpperCase();
    if (!code) return;
    onAddComponent(code);
    setNewComponent("");
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{professor.name || "Sem nome"}</p>
          <p className="text-sm text-muted-foreground">{professor.email || "Sem e-mail"}</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-300">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Aprovado
        </Badge>
      </div>

      {/* Components */}
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          Componentes Autorizados
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {components.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum componente atribuído.</p>
          ) : (
            components.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1 pr-1">
                {code}
                <button
                  onClick={() => onRemoveComponent(code)}
                  disabled={isRemoving}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: TEC502"
            value={newComponent}
            onChange={(e) => setNewComponent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="max-w-[160px] h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={isAdding || !newComponent.trim()} className="gap-1 h-8">
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
