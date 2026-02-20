import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Send, UserX, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useClassContext } from "@/contexts/ClassContext";

type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

interface StudentEval {
  evaluatedStudentId: number;
  role: RoleType;
  absent: boolean;
  atuacao: number;
  pontualidade: number;
  dominio: number;
  metas: number;
  participacao: number;
}

export default function EvaluatePage() {
  return (
    <DashboardLayout>
      <EvaluateContent />
    </DashboardLayout>
  );
}

function EvaluateContent() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { selectedClassId } = useClassContext();
  const { data: session } = trpc.sessions.get.useQuery({ id: sessionId });
  const { data: sessionStudentsList } = trpc.sessions.getStudents.useQuery({ sessionId });
  const { data: studentMe } = trpc.students.me.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  const submitMutation = trpc.evaluations.submit.useMutation({
    onSuccess: () => {
      toast.success("Avaliação enviada com sucesso!");
      utils.evaluations.hasSubmitted.invalidate();
      setLocation("/");
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter out self from the list
  const peersToEvaluate = useMemo(() => {
    if (!sessionStudentsList || !studentMe) return [];
    return sessionStudentsList.filter(s => s.studentId !== studentMe.id);
  }, [sessionStudentsList, studentMe]);

  const [evaluations, setEvaluations] = useState<Record<number, StudentEval>>({});

  // Initialize evaluations when peers load
  useMemo(() => {
    if (peersToEvaluate.length > 0 && Object.keys(evaluations).length === 0) {
      const init: Record<number, StudentEval> = {};
      peersToEvaluate.forEach(p => {
        init[p.studentId] = {
          evaluatedStudentId: p.studentId,
          role: "PARTICIPANTE",
          absent: false,
          atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2,
        };
      });
      setEvaluations(init);
    }
  }, [peersToEvaluate]);

  const updateEval = (studentId: number, field: keyof StudentEval, value: unknown) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  // Exclusive role tracking
  const assignedExclusiveRoles = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(evaluations).forEach(ev => {
      if (!ev.absent && ["COORDENADOR", "MESA", "QUADRO"].includes(ev.role)) {
        map[ev.role] = ev.evaluatedStudentId;
      }
    });
    return map;
  }, [evaluations]);

  const handleRoleChange = (studentId: number, newRole: RoleType) => {
    // If selecting an exclusive role, remove it from any other student
    if (["COORDENADOR", "MESA", "QUADRO"].includes(newRole)) {
      const currentHolder = assignedExclusiveRoles[newRole];
      if (currentHolder && currentHolder !== studentId) {
        updateEval(currentHolder, "role", "PARTICIPANTE");
      }
    }
    updateEval(studentId, "role", newRole);
  };

  const handleSubmit = () => {
    if (!studentMe) { toast.error("Aluno não identificado"); return; }
    const items = Object.values(evaluations);
    // Validate exclusive roles
    const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"];
    for (const role of exclusiveRoles) {
      const holders = items.filter(i => i.role === role && !i.absent);
      if (holders.length > 1) { toast.error(`O papel ${role} só pode ser atribuído a um aluno`); return; }
    }
    submitMutation.mutate({
      sessionId,
      evaluatorStudentId: studentMe.id,
      items,
    });
  };

  if (!session || !studentMe) return null;

  const totalPeers = peersToEvaluate.length;
  const absentCount = Object.values(evaluations).filter(e => e.absent).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.label}</h1>
          <p className="text-muted-foreground">Avalie o desempenho dos seus colegas nesta sessão.</p>
        </div>
      </div>

      {/* Summary bar */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-sm">
            <span>Avaliando <strong>{totalPeers - absentCount}</strong> colegas ({absentCount} falta{absentCount !== 1 ? "s" : ""})</span>
            <div className="flex gap-2">
              {Object.entries(assignedExclusiveRoles).map(([role]) => (
                <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation cards */}
      {peersToEvaluate.map(peer => {
        const ev = evaluations[peer.studentId];
        if (!ev) return null;
        const totalScore = ev.absent ? 0 : ev.atuacao + ev.pontualidade + ev.dominio + ev.metas + ev.participacao;

        return (
          <Card key={peer.studentId} className={`transition-all ${ev.absent ? "opacity-60 bg-muted/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{peer.studentName}</CardTitle>
                  <CardDescription>{peer.studentEmail}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {!ev.absent && (
                    <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${totalScore >= 8 ? "border-emerald-300 text-emerald-700" : totalScore >= 5 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                      {totalScore.toFixed(1)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`absent-${peer.studentId}`} className="text-sm text-muted-foreground">
                      <UserX className="h-4 w-4" />
                    </Label>
                    <Switch
                      id={`absent-${peer.studentId}`}
                      checked={ev.absent}
                      onCheckedChange={(checked) => updateEval(peer.studentId, "absent", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            {!ev.absent && (
              <CardContent className="space-y-4">
                {/* Role selection */}
                <div>
                  <Label className="text-sm font-medium">Papel na sessão</Label>
                  <Select value={ev.role} onValueChange={(v) => handleRoleChange(peer.studentId, v as RoleType)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTICIPANTE">Participante</SelectItem>
                      <SelectItem value="COORDENADOR" disabled={!!assignedExclusiveRoles["COORDENADOR"] && assignedExclusiveRoles["COORDENADOR"] !== peer.studentId}>
                        Coordenador {assignedExclusiveRoles["COORDENADOR"] && assignedExclusiveRoles["COORDENADOR"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                      <SelectItem value="MESA" disabled={!!assignedExclusiveRoles["MESA"] && assignedExclusiveRoles["MESA"] !== peer.studentId}>
                        Mesa {assignedExclusiveRoles["MESA"] && assignedExclusiveRoles["MESA"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                      <SelectItem value="QUADRO" disabled={!!assignedExclusiveRoles["QUADRO"] && assignedExclusiveRoles["QUADRO"] !== peer.studentId}>
                        Quadro {assignedExclusiveRoles["QUADRO"] && assignedExclusiveRoles["QUADRO"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Criteria sliders */}
                <div className="space-y-4">
                  <CriteriaSlider label="Atuação" value={ev.atuacao} onChange={(v) => updateEval(peer.studentId, "atuacao", v)} />
                  <CriteriaSlider label="Pontualidade" value={ev.pontualidade} onChange={(v) => updateEval(peer.studentId, "pontualidade", v)} />
                  <CriteriaSlider label="Domínio" value={ev.dominio} onChange={(v) => updateEval(peer.studentId, "dominio", v)} />
                  <CriteriaSlider label="Metas" value={ev.metas} onChange={(v) => updateEval(peer.studentId, "metas", v)} />
                  <CriteriaSlider label="Participação" value={ev.participacao} onChange={(v) => updateEval(peer.studentId, "participacao", v)} />
                </div>
              </CardContent>
            )}

            {ev.absent && (
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Marcado como ausente. A nota será 0 e não será contabilizada na média.
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Submit button */}
      <div className="flex justify-end pb-8">
        <Button size="lg" onClick={handleSubmit} disabled={submitMutation.isPending} className="shadow-md">
          {submitMutation.isPending ? (
            "Enviando..."
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Avaliação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CriteriaSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const color = value >= 1.5 ? "text-emerald-600" : value >= 1 ? "text-amber-600" : "text-red-600";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className={`text-sm font-bold tabular-nums ${color}`}>{value.toFixed(1)}</span>
      </div>
      <Slider
        min={0}
        max={2}
        step={0.5}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>0.5</span>
        <span>1.0</span>
        <span>1.5</span>
        <span>2.0</span>
      </div>
    </div>
  );
}
