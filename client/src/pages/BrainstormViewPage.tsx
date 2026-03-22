import BrainstormBoardPage from "./BrainstormBoardPage";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BrainstormViewPage() {
  return (
      <BrainstormViewContent />
  );
}

function BrainstormViewContent() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId || "0", 10);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);

  // Read optional studentId from URL query param (?student=123)
  // This is set by the email link so we can determine the student's role
  const urlParams = new URLSearchParams(window.location.search);
  const studentIdFromUrl = parseInt(urlParams.get("student") || "0", 10);

  // Fetch session students to determine the role of this student (if any)
  const { data: sessionStudentsList, isLoading: loadingStudents } = trpc.studentAccess.getSessionStudents.useQuery(
    { sessionId },
    { enabled: !!sessionId && !!studentIdFromUrl }
  );

  // Fetch board data (includes sessionStatus)
  const { data: boardData, isLoading: loadingBoard } = trpc.brainstorm.getBoard.useQuery(
    { sessionId },
    { enabled: !!sessionId && !!studentIdFromUrl }
  );

  // Determine canEdit:
  // - If no studentId in URL → professor/admin access → always canEdit=true
  // - If studentId in URL → student access → canEdit only if role is MESA and session is not finished
  const { canEdit } = useMemo(() => {
    if (!studentIdFromUrl) {
      // Professor access — full edit
      return { canEdit: true };
    }
    if (!sessionStudentsList || !boardData) {
      // Still loading — default to read-only until we know
      return { canEdit: false };
    }
    const entry = sessionStudentsList.find(s => s.studentId === studentIdFromUrl);
    if (!entry) {
      // Student not found in session — read-only
      return { canEdit: false };
    }
    // MESA can edit when session is active or open (not finished/encerrada)
    const sessionStatus = (boardData as any).sessionStatus as string;
    const isMesa = entry.role === "MESA";
    const isFinished = sessionStatus === "finished";
    return {
      canEdit: isMesa && !isFinished,
    };
  }, [studentIdFromUrl, sessionStudentsList, boardData]);

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

  // Show loading state while determining student role
  if (studentIdFromUrl && (loadingStudents || loadingBoard)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      {/* Only show share button for professor access (no studentId in URL) */}
      {!studentIdFromUrl && (
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
      )}

      <BrainstormBoardPage
        sessionId={sessionId}
        studentId={studentIdFromUrl || 0}
        sessionLabel=""
        canEdit={canEdit}
        onBack={() => {
          if (studentIdFromUrl) {
            // Student: go back to student access page
            navigate("/avaliacao");
          } else {
            navigate("/sessions");
          }
        }}
      />

      {/* Share dialog — only for professors */}
      {!studentIdFromUrl && (
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
      )}
    </>
  );
}
