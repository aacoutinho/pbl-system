import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { data: studentMe, isLoading: meLoading } = trpc.students.me.useQuery();
  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery();

  const openSessions = sessionsList?.filter(s => s.status === "open") ?? [];
  const closedSessions = sessionsList?.filter(s => s.status === "closed") ?? [];

  if (meLoading || sessionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!studentMe) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cadastro Pendente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Seu e-mail ainda não está cadastrado no sistema de avaliação. Entre em contato com o professor para ser adicionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minhas Avaliações</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo(a), {studentMe.name}. Avalie seus colegas nas sessões abertas.</p>
      </div>

      {/* Open Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Sessões Abertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma sessão aberta para avaliação no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  studentId={studentMe.id}
                  onEvaluate={() => setLocation(`/evaluate/${session.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Sessions */}
      {closedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              Sessões Encerradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {closedSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-semibold">{session.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Problema {session.problemNumber} · Sessão {session.sessionNumber}
                    </p>
                  </div>
                  <Badge variant="secondary">Encerrada</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionCard({ session, studentId, onEvaluate }: {
  session: { id: number; label: string; problemNumber: number; sessionNumber: number };
  studentId: number;
  onEvaluate: () => void;
}) {
  const { data: hasSubmitted, isLoading } = trpc.evaluations.hasSubmitted.useQuery({
    sessionId: session.id,
    studentId,
  });

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/20 transition-colors">
      <div>
        <p className="font-semibold">{session.label}</p>
        <p className="text-sm text-muted-foreground">
          Problema {session.problemNumber} · Sessão {session.sessionNumber}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-9 w-24" />
        ) : hasSubmitted ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Enviada
          </Badge>
        ) : (
          <Button size="sm" onClick={onEvaluate}>
            Avaliar
          </Button>
        )}
      </div>
    </div>
  );
}
