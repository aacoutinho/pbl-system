import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BarChart3, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

export default function StudentResults() {
  return (
    <DashboardLayout>
      <StudentResultsContent />
    </DashboardLayout>
  );
}

function StudentResultsContent() {
  const { data: studentMe, isLoading: meLoading } = trpc.students.me.useQuery();
  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery();

  if (meLoading || sessionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!studentMe) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cadastro Pendente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Seu e-mail ainda não está cadastrado no sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus Resultados</h1>
        <p className="text-muted-foreground mt-1">Veja suas notas nas sessões encerradas.</p>
      </div>

      {sessionsList?.filter(s => s.status === "closed").map(session => (
        <SessionResultCard key={session.id} session={session} studentId={studentMe.id} />
      ))}

      {(!sessionsList || sessionsList.filter(s => s.status === "closed").length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma sessão encerrada com resultados disponíveis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionResultCard({ session, studentId }: {
  session: { id: number; label: string; problemNumber: number; sessionNumber: number };
  studentId: number;
}) {
  const { data: results, isLoading } = trpc.results.session.useQuery({ sessionId: session.id });

  const myResult = useMemo(() => {
    if (!results) return null;
    return results.find(r => r.studentId === studentId);
  }, [results, studentId]);

  const myRank = useMemo(() => {
    if (!results) return 0;
    const idx = results.findIndex(r => r.studentId === studentId);
    return idx >= 0 ? idx + 1 : 0;
  }, [results, studentId]);

  if (isLoading) return <Skeleton className="h-24 rounded-xl" />;
  if (!myResult) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{session.label}</CardTitle>
          <Badge variant="outline" className={
            myResult.totalScore >= 8 ? "border-emerald-300 text-emerald-700" :
            myResult.totalScore >= 5 ? "border-amber-300 text-amber-700" :
            "border-red-300 text-red-700"
          }>
            Nota: {myResult.totalScore.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-amber-500" />
            Posição: {myRank}º de {results?.length ?? 0}
          </span>
          <span>Papel: <strong className="text-foreground">{myResult.role}</strong></span>
          <span>Avaliações recebidas: {myResult.validEvaluations}</span>
        </div>
      </CardContent>
    </Card>
  );
}
