import DashboardLayout from "@/components/DashboardLayout";
import BrainstormBoardPage from "./BrainstormBoardPage";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BrainstormViewPage() {
  return (
    <DashboardLayout>
      <BrainstormViewContent />
    </DashboardLayout>
  );
}

function BrainstormViewContent() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId || "0", 10);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);

  const componentSessions = trpc.brainstorm.getComponentSessions.useQuery(
    { sessionId },
    { enabled: !!sessionId && shareOpen }
  );

  const shareMutation = trpc.brainstorm.shareBoard.useMutation({
    onSuccess: (data) => {
      toast.success(`Compartilhado com ${data.sharedCount} sessão(ões). ${data.totalTargets - data.sharedCount} já possuíam quadro.`);
      setShareOpen(false);
      setSelectedSessions([]);
      componentSessions.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao compartilhar quadro");
    },
  });

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Sessão não encontrada.
      </div>
    );
  }

  const handleShare = () => {
    shareMutation.mutate({
      sessionId,
      targetSessionIds: selectedSessions.length > 0 ? selectedSessions : undefined,
    });
  };

  const toggleSession = (id: number) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const available = (componentSessions.data || []).filter(s => !s.hasBoard);
    if (selectedSessions.length === available.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(available.map(s => s.id));
    }
  };

  return (
    <>
      <div className="flex justify-end mb-2 px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar com Outros Tutoriais
        </Button>
      </div>

      <BrainstormBoardPage
        sessionId={sessionId}
        studentId={0}
        sessionLabel=""
        canEdit={true}
        onBack={() => navigate("/sessions")}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Quadro de Brainstorming</DialogTitle>
            <DialogDescription>
              Selecione as sessões do mesmo componente para enviar uma cópia deste quadro.
              Sessões que já possuem quadro serão ignoradas.
            </DialogDescription>
          </DialogHeader>

          {componentSessions.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !componentSessions.data || componentSessions.data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma outra sessão encontrada neste componente.
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={
                    selectedSessions.length > 0 &&
                    selectedSessions.length === componentSessions.data.filter(s => !s.hasBoard).length
                  }
                  onCheckedChange={selectAll}
                />
                <span className="text-sm font-medium">Selecionar todas disponíveis</span>
              </div>
              {componentSessions.data.map(session => (
                <div key={session.id} className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedSessions.includes(session.id)}
                    onCheckedChange={() => toggleSession(session.id)}
                    disabled={session.hasBoard}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{session.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      ({session.status})
                    </span>
                  </div>
                  {session.hasBoard && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Já possui quadro
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleShare}
              disabled={shareMutation.isPending || (!selectedSessions.length && !(componentSessions.data || []).some(s => !s.hasBoard))}
            >
              {shareMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Compartilhando...
                </>
              ) : selectedSessions.length > 0 ? (
                `Compartilhar com ${selectedSessions.length} sessão(ões)`
              ) : (
                "Compartilhar com todas"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
