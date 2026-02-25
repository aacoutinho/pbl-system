import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, ArrowLeft, Lightbulb, BookOpen, HelpCircle, Target,
  ArrowRightLeft, Link2, ImageIcon, Video, Camera, X, ExternalLink,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type Section = "ideias" | "fatos" | "questoes" | "metas";

interface BrainstormItemData {
  id: number;
  boardId: number;
  section: Section;
  content: string;
  status: string;
  attachmentUrl: string | null;
  attachmentType: "link" | "image" | "video" | "photo" | null;
  sortOrder: number;
}

const SECTION_CONFIG: Record<Section, {
  label: string;
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: { value: string; label: string; color: string }[];
}> = {
  ideias: {
    label: "Ideias",
    icon: Lightbulb,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    statuses: [
      { value: "analise", label: "Análise", color: "bg-amber-100 text-amber-800" },
      { value: "aceita", label: "Aceita", color: "bg-emerald-100 text-emerald-800" },
      { value: "descartada", label: "Descartada", color: "bg-red-100 text-red-800" },
    ],
  },
  fatos: {
    label: "Fatos",
    icon: BookOpen,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    statuses: [
      { value: "verificar", label: "Verificar", color: "bg-blue-100 text-blue-800" },
      { value: "confirmado", label: "Confirmado", color: "bg-emerald-100 text-emerald-800" },
      { value: "inexato", label: "Inexato", color: "bg-red-100 text-red-800" },
    ],
  },
  questoes: {
    label: "Questões",
    icon: HelpCircle,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    statuses: [
      { value: "duvida", label: "Dúvida", color: "bg-purple-100 text-purple-800" },
      { value: "investigacao", label: "Investigação", color: "bg-orange-100 text-orange-800" },
      { value: "respondida", label: "Respondida", color: "bg-emerald-100 text-emerald-800" },
    ],
  },
  metas: {
    label: "Metas",
    icon: Target,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    statuses: [
      { value: "planejada", label: "Planejada", color: "bg-slate-100 text-slate-800" },
      { value: "em_andamento", label: "Em Andamento", color: "bg-orange-100 text-orange-800" },
      { value: "concluida", label: "Concluída", color: "bg-emerald-100 text-emerald-800" },
    ],
  },
};

const SECTIONS_ORDER: Section[] = ["ideias", "fatos", "questoes", "metas"];

interface BrainstormBoardPageProps {
  sessionId: number;
  studentId: number;
  sessionLabel: string;
  isMesa: boolean;
  onBack: () => void;
}

export default function BrainstormBoardPage({ sessionId, studentId, sessionLabel, isMesa, onBack }: BrainstormBoardPageProps) {
  const [newItemTexts, setNewItemTexts] = useState<Record<Section, string>>({
    ideias: "", fatos: "", questoes: "", metas: "",
  });
  const [attachmentDialogSection, setAttachmentDialogSection] = useState<Section | null>(null);
  const [attachmentDialogItemId, setAttachmentDialogItemId] = useState<number | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState<"link" | "image" | "video" | "photo">("link");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const utils = trpc.useUtils();

  // Get or create board
  const createBoardMutation = trpc.brainstorm.getOrCreateBoard.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
  });

  const { data: boardData, isLoading } = trpc.brainstorm.getBoard.useQuery(
    { sessionId },
    { refetchInterval: isMesa ? false : 10000 } // Auto-refresh for viewers
  );

  // Use sessionLabel from props, or from board data if available
  const displayLabel = sessionLabel || (boardData as any)?.sessionLabel || `Sessão #${sessionId}`;

  const hasBoard = boardData && !(boardData as any).noBoard;

  // Initialize board if Mesa and no board exists
  const initBoard = useCallback(() => {
    if (isMesa && !hasBoard) {
      createBoardMutation.mutate({ sessionId, studentId });
    }
  }, [isMesa, hasBoard, sessionId, studentId]);

  // Mutations
  const addItemMutation = trpc.brainstorm.addItem.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const updateItemMutation = trpc.brainstorm.updateItem.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const deleteItemMutation = trpc.brainstorm.deleteItem.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const moveItemMutation = trpc.brainstorm.moveItem.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const uploadPhotoMutation = trpc.brainstorm.uploadPhoto.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleAddItem = (section: Section) => {
    const content = newItemTexts[section].trim();
    if (!content) return;
    if (!boardData) {
      // Create board first, then add item
      createBoardMutation.mutate({ sessionId, studentId }, {
        onSuccess: (board) => {
          addItemMutation.mutate({ boardId: board.id, section, content });
          setNewItemTexts(prev => ({ ...prev, [section]: "" }));
        },
      });
      return;
    }
    addItemMutation.mutate({ boardId: boardData.id, section, content });
    setNewItemTexts(prev => ({ ...prev, [section]: "" }));
  };

  const handleUpdateStatus = (itemId: number, status: string) => {
    updateItemMutation.mutate({ itemId, status });
  };

  const handleUpdateContent = (itemId: number, content: string) => {
    updateItemMutation.mutate({ itemId, content });
  };

  const handleDeleteItem = (itemId: number) => {
    deleteItemMutation.mutate({ itemId });
  };

  const handleMoveItem = (itemId: number, targetSection: "fatos" | "questoes") => {
    moveItemMutation.mutate({ itemId, targetSection });
  };

  const handleAddAttachment = (itemId: number) => {
    if (!attachmentUrl.trim()) return;
    updateItemMutation.mutate({
      itemId,
      attachmentUrl: attachmentUrl.trim(),
      attachmentType,
    });
    setAttachmentDialogItemId(null);
    setAttachmentUrl("");
  };

  const handleRemoveAttachment = (itemId: number) => {
    updateItemMutation.mutate({
      itemId,
      attachmentUrl: null,
      attachmentType: null,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadPhotoMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          contentType: file.type,
        });
        updateItemMutation.mutate({
          itemId,
          attachmentUrl: result.url,
          attachmentType: "photo",
        });
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
      toast.error("Erro ao enviar foto");
    }
  };

  const handlePhotoCapture = (itemId: number) => {
    setAttachmentDialogItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.dataset.itemId = String(itemId);
      fileInputRef.current.click();
    }
  };

  const items = boardData?.items || [];

  const getItemsBySection = (section: Section) =>
    items.filter((i: BrainstormItemData) => i.section === section);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando quadro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-4">
      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const itemId = Number(fileInputRef.current?.dataset.itemId);
          if (itemId) handlePhotoUpload(e, itemId);
        }}
      />

      {/* Header */}
      <div className="max-w-[1600px] mx-auto mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Quadro de Brainstorming</h1>
            <p className="text-sm text-muted-foreground">{displayLabel}</p>
          </div>
          {isMesa && !hasBoard && (
            <Button onClick={initBoard} disabled={createBoardMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Iniciar Quadro
            </Button>
          )}
          {!isMesa && (
            <Badge variant="secondary" className="text-xs">Somente Visualização</Badge>
          )}
        </div>
      </div>

      {/* Board Grid - 4 columns on desktop, 2 on tablet, 1 on mobile */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {SECTIONS_ORDER.map(section => {
          const config = SECTION_CONFIG[section];
          const Icon = config.icon;
          const sectionItems = getItemsBySection(section);

          return (
            <Card key={section} className={`${config.borderColor} border-2`}>
              <CardHeader className={`${config.bgColor} py-3 px-4`}>
                <CardTitle className={`text-base flex items-center gap-2 ${config.color}`}>
                  <Icon className="h-5 w-5" />
                  {config.label}
                  <Badge variant="secondary" className="ml-auto text-xs">{sectionItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {/* Add new item (Mesa only) */}
                {isMesa && (
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Adicionar ${config.label.toLowerCase()}...`}
                      value={newItemTexts[section]}
                      onChange={(e) => setNewItemTexts(prev => ({ ...prev, [section]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddItem(section);
                        }
                      }}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddItem(section)}
                      disabled={!newItemTexts[section].trim() || addItemMutation.isPending}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Items list */}
                {sectionItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum item adicionado
                  </p>
                )}

                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {sectionItems.map((item: BrainstormItemData) => {
                    const statusConfig = config.statuses.find(s => s.value === item.status);
                    return (
                      <div key={item.id} className="bg-white rounded-lg border p-3 space-y-2 shadow-sm">
                        {/* Content */}
                        {isMesa ? (
                          <Textarea
                            defaultValue={item.content}
                            onBlur={(e) => {
                              if (e.target.value !== item.content) {
                                handleUpdateContent(item.id, e.target.value);
                              }
                            }}
                            className="text-sm min-h-[40px] resize-none border-0 p-0 focus-visible:ring-0 shadow-none"
                            rows={1}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                        )}

                        {/* Attachment preview */}
                        {item.attachmentUrl && (
                          <div className="rounded-md overflow-hidden border">
                            {(item.attachmentType === "image" || item.attachmentType === "photo") ? (
                              <div className="relative">
                                <img src={item.attachmentUrl} alt="" className="w-full max-h-40 object-cover" />
                                {isMesa && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6"
                                    onClick={() => handleRemoveAttachment(item.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : item.attachmentType === "video" ? (
                              <div className="relative">
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 text-xs text-blue-600 hover:underline">
                                  <Video className="h-4 w-4" /> Ver vídeo <ExternalLink className="h-3 w-3" />
                                </a>
                                {isMesa && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6"
                                    onClick={() => handleRemoveAttachment(item.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="relative">
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 text-xs text-blue-600 hover:underline">
                                  <Link2 className="h-4 w-4" /> {item.attachmentUrl.length > 40 ? item.attachmentUrl.substring(0, 40) + "..." : item.attachmentUrl} <ExternalLink className="h-3 w-3" />
                                </a>
                                {isMesa && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6"
                                    onClick={() => handleRemoveAttachment(item.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status + Actions */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Status badge/selector */}
                          {isMesa ? (
                            <Select
                              value={item.status}
                              onValueChange={(val) => handleUpdateStatus(item.id, val)}
                            >
                              <SelectTrigger className="h-6 text-xs w-auto min-w-[90px] border-0 shadow-none px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {config.statuses.map(s => (
                                  <SelectItem key={s.value} value={s.value} className="text-xs">
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-xs ${statusConfig?.color || "bg-slate-100 text-slate-800"}`}>
                              {statusConfig?.label || item.status}
                            </Badge>
                          )}

                          <div className="flex-1" />

                          {/* Actions (Mesa only) */}
                          {isMesa && (
                            <div className="flex items-center gap-0.5">
                              {/* Move between Questões ↔ Fatos */}
                              {(section === "questoes" || section === "fatos") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  title={section === "questoes" ? "Mover para Fatos" : "Mover para Questões"}
                                  onClick={() => handleMoveItem(item.id, section === "questoes" ? "fatos" : "questoes")}
                                  disabled={moveItemMutation.isPending}
                                >
                                  <ArrowRightLeft className="h-3 w-3" />
                                </Button>
                              )}

                              {/* Attachment dropdown */}
                              {!item.attachmentUrl && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <Link2 className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setAttachmentDialogItemId(item.id);
                                      setAttachmentType("link");
                                      setAttachmentUrl("");
                                    }}>
                                      <Link2 className="h-4 w-4 mr-2" /> Link
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setAttachmentDialogItemId(item.id);
                                      setAttachmentType("image");
                                      setAttachmentUrl("");
                                    }}>
                                      <ImageIcon className="h-4 w-4 mr-2" /> URL de Imagem
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setAttachmentDialogItemId(item.id);
                                      setAttachmentType("video");
                                      setAttachmentUrl("");
                                    }}>
                                      <Video className="h-4 w-4 mr-2" /> URL de Vídeo
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePhotoCapture(item.id)}>
                                      <Camera className="h-4 w-4 mr-2" /> Tirar Foto
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={deleteItemMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Inline attachment URL input */}
                        {attachmentDialogItemId === item.id && attachmentType !== "photo" && (
                          <div className="flex gap-2 items-center mt-1">
                            <Input
                              placeholder={attachmentType === "link" ? "https://..." : attachmentType === "image" ? "URL da imagem..." : "URL do vídeo..."}
                              value={attachmentUrl}
                              onChange={(e) => setAttachmentUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddAttachment(item.id);
                                if (e.key === "Escape") setAttachmentDialogItemId(null);
                              }}
                              className="text-xs h-7"
                              autoFocus
                            />
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddAttachment(item.id)}>
                              OK
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAttachmentDialogItemId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upload indicator */}
      {uploadingPhoto && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Card className="p-6">
            <p className="text-sm">Enviando foto...</p>
          </Card>
        </div>
      )}
    </div>
  );
}
