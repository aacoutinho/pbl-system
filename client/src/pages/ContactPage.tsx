import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bug, Lightbulb, Send, CheckCircle2, Clock, MessageSquare, Loader2, ChevronLeft, ChevronRight, Filter } from "lucide-react";

// ─── Professor Contact Form ───
function ProfessorContactView() {
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const limit = 10;

  const utils = trpc.useUtils();
  const { data: myTickets, isLoading: loadingTickets } = trpc.contactTickets.myList.useQuery({ limit, offset: page * limit });

  const createMutation = trpc.contactTickets.create.useMutation({
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso! O administrador será notificado por e-mail.");
      setSubject("");
      setMessage("");
      utils.contactTickets.myList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3) { toast.error("O assunto deve ter pelo menos 3 caracteres."); return; }
    if (message.trim().length < 10) { toast.error("A mensagem deve ter pelo menos 10 caracteres."); return; }
    createMutation.mutate({ type, subject: subject.trim(), message: message.trim() });
  };

  const totalPages = Math.ceil((myTickets?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar Mensagem
          </CardTitle>
          <CardDescription>
            Comunique um problema (bug) ou solicite uma nova funcionalidade ao administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setType("bug")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                    type === "bug"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-muted bg-background text-muted-foreground hover:border-red-300"
                  }`}
                >
                  <Bug className="h-4 w-4" />
                  <span className="font-medium text-sm">Relatório de Bug</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("feature")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                    type === "feature"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-muted bg-background text-muted-foreground hover:border-blue-300"
                  }`}
                >
                  <Lightbulb className="h-4 w-4" />
                  <span className="font-medium text-sm">Pedido de Funcionalidade</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                placeholder={type === "bug" ? "Descreva brevemente o problema..." : "Descreva brevemente a funcionalidade..."}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder={type === "bug"
                  ? "Descreva o problema em detalhes: o que aconteceu, o que esperava, passos para reproduzir..."
                  : "Descreva a funcionalidade desejada: o que gostaria de fazer, por que seria útil..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={5000}
                required
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
            </div>

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Enviar Mensagem</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Tickets History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Meus Envios
          </CardTitle>
          <CardDescription>Histórico das suas mensagens enviadas ao administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTickets ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !myTickets?.items.length ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <div className="space-y-3">
              {myTickets.items.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-lg border ${
                    ticket.status === "resolved" ? "bg-green-50/50 border-green-200" : "bg-background border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {ticket.type === "bug" ? (
                        <Bug className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-blue-500 shrink-0" />
                      )}
                      <span className="font-medium text-sm">{ticket.subject}</span>
                    </div>
                    <Badge variant={ticket.status === "resolved" ? "default" : "secondary"} className={
                      ticket.status === "resolved" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""
                    }>
                      {ticket.status === "resolved" ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Resolvido</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ticket.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(ticket.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {ticket.resolvedAt && (
                      <span className="ml-2 text-green-600">
                        — Resolvido em {new Date(ticket.resolvedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Contact View ───
function AdminContactView() {
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.contactTickets.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit,
    offset: page * limit,
  });
  const { data: openCountData } = trpc.contactTickets.openCount.useQuery();

  const resolveMutation = trpc.contactTickets.resolve.useMutation({
    onSuccess: () => {
      toast.success("Ticket marcado como resolvido.");
      utils.contactTickets.list.invalidate();
      utils.contactTickets.openCount.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = Math.ceil((tickets?.total ?? 0) / limit);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tickets de Contato</h2>
          <p className="text-sm text-muted-foreground">
            {openCountData?.count ?? 0} ticket(s) aberto(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !tickets?.items.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum ticket encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.items.map((ticket) => (
            <Card key={ticket.id} className={ticket.status === "resolved" ? "opacity-70" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {ticket.type === "bug" ? (
                        <Badge variant="destructive" className="text-xs">
                          <Bug className="h-3 w-3 mr-1" /> Bug
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">
                          <Lightbulb className="h-3 w-3 mr-1" /> Funcionalidade
                        </Badge>
                      )}
                      <Badge variant={ticket.status === "resolved" ? "default" : "secondary"} className={
                        ticket.status === "resolved" ? "bg-green-100 text-green-700 hover:bg-green-100 text-xs" : "text-xs"
                      }>
                        {ticket.status === "resolved" ? "Resolvido" : "Aberto"}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm mt-2">{ticket.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{ticket.message}</p>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{ticket.userName || "Usuário"}</span>
                      <span>{ticket.userEmail || ""}</span>
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {ticket.resolvedAt && (
                        <span className="text-green-600">
                          Resolvido em {new Date(ticket.resolvedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                  {ticket.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveMutation.mutate({ ticketId: ticket.id })}
                      disabled={resolveMutation.isPending}
                      className="shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Resolver
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Contact Page ───
export default function ContactPage() {
  const { user } = useAuth();

  return (
      <div className="container max-w-4xl py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Contato</h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "admin"
              ? "Gerencie os tickets de bug e pedidos de funcionalidade dos professores."
              : "Comunique problemas ou solicite novas funcionalidades ao administrador."
            }
          </p>
        </div>
        {user?.role === "admin" ? <AdminContactView /> : <ProfessorContactView />}
      </div>
  );
}
