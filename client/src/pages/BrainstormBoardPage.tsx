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
  ChevronDown, ChevronUp, Info, FileText, Upload, Play, Paperclip, Pencil, Check
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

interface AttachmentData {
  id: number;
  itemId: number;
  url: string;
  type: "link" | "image" | "video" | "photo" | "document";
  title?: string;
  sortOrder: number;
}

interface BrainstormItemData {
  id: number;
  boardId: number;
  section: Section;
  content: string;
  status: string;
  attachmentUrl: string | null;
  attachmentType: "link" | "image" | "video" | "photo" | "document" | null;
  sortOrder: number;
  attachments?: AttachmentData[];
}

const SECTION_CONFIG: Record<Section, {
  label: string;
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
  borderColor: string;
  itemBg: string;
  statuses: { value: string; label: string; color: string }[];
}> = {
  ideias: {
    label: "Ideias",
    icon: Lightbulb,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    itemBg: "bg-amber-50/60",
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
    itemBg: "bg-blue-50/60",
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
    itemBg: "bg-purple-50/60",
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
    itemBg: "bg-emerald-50/60",
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
  canEdit: boolean;
  onBack: () => void;
}

export default function BrainstormBoardPage({ sessionId, studentId, sessionLabel, canEdit, onBack }: BrainstormBoardPageProps) {
  const [newItemTexts, setNewItemTexts] = useState<Record<Section, string>>({
    ideias: "", fatos: "", questoes: "", metas: "",
  });
  const [attachmentDialogItemId, setAttachmentDialogItemId] = useState<number | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentType, setAttachmentType] = useState<"link" | "image" | "video" | "photo" | "document">("link");
  const docInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const utils = trpc.useUtils();

  // Get or create board
  const createBoardMutation = trpc.brainstorm.getOrCreateBoard.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
  });

  const { data: boardData, isLoading } = trpc.brainstorm.getBoard.useQuery(
    { sessionId },
    { refetchInterval: 5000 }
  );

  const displayLabel = sessionLabel || (boardData as any)?.sessionLabel || `Sessão #${sessionId}`;
  const hasBoard = boardData && !(boardData as any).noBoard;

  const initBoard = useCallback(() => {
    if (canEdit && !hasBoard) {
      createBoardMutation.mutate({ sessionId, studentId });
    }
  }, [canEdit, hasBoard, sessionId, studentId]);

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

  const addAttachmentMutation = trpc.brainstorm.addAttachment.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const removeAttachmentMutation = trpc.brainstorm.removeAttachment.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const updateAttachmentTitleMutation = trpc.brainstorm.updateAttachmentTitle.useMutation({
    onSuccess: () => utils.brainstorm.getBoard.invalidate({ sessionId }),
    onError: (err) => toast.error(err.message),
  });

  const [editingAttachmentId, setEditingAttachmentId] = useState<number | null>(null);
  const [editingAttachmentTitle, setEditingAttachmentTitle] = useState("");

  const handleAddItem = (section: Section) => {
    const content = newItemTexts[section].trim();
    if (!content) return;
    if (!boardData) {
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

  const handleMoveItem = (itemId: number, targetSection: "ideias" | "fatos" | "questoes" | "metas") => {
    moveItemMutation.mutate({ itemId, targetSection });
  };

  // --- Multiple attachments ---
  const handleAddUrlAttachment = (itemId: number) => {
    if (!attachmentUrl.trim()) return;
    addAttachmentMutation.mutate({
      itemId,
      url: attachmentUrl.trim(),
      type: attachmentType,
    });
    setAttachmentDialogItemId(null);
    setAttachmentUrl("");
  };

  const handleRemoveAttachment = (attachmentId: number) => {
    removeAttachmentMutation.mutate({ attachmentId });
  };

  // Legacy single attachment removal (for old items)
  const handleRemoveLegacyAttachment = (itemId: number) => {
    updateItemMutation.mutate({
      itemId,
      attachmentUrl: null,
      attachmentType: null,
    });
  };

  const handleFileUpload = async (file: File, itemId: number, type: "photo" | "document") => {
    const maxSize = type === "document" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    const label = type === "document" ? "documento" : "imagem";
    if (file.size > maxSize) {
      toast.error(`O ${label} deve ter no máximo ${type === "document" ? "10" : "5"}MB`);
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
        addAttachmentMutation.mutate({
          itemId,
          url: result.url,
          type,
        });
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
      toast.error(`Erro ao enviar ${label}`);
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

  const handleImageFromDevice = (itemId: number) => {
    setAttachmentDialogItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.setAttribute("accept", "image/*");
      fileInputRef.current.dataset.itemId = String(itemId);
      fileInputRef.current.click();
    }
  };

  const handleDocSelect = (itemId: number) => {
    setAttachmentDialogItemId(itemId);
    if (docInputRef.current) {
      docInputRef.current.dataset.itemId = String(itemId);
      docInputRef.current.click();
    }
  };

  const getYouTubeThumbnail = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  const getFileExtension = (url: string): string => {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toUpperCase() : "DOC";
  };

  // Get all attachments for an item: new table + legacy single attachment
  const getItemAttachments = (item: BrainstormItemData): { id: number; url: string; type: string; title?: string; isLegacy?: boolean }[] => {
    const result: { id: number; url: string; type: string; title?: string; isLegacy?: boolean }[] = [];
    // New attachments from the attachments table
    if (item.attachments && item.attachments.length > 0) {
      for (const att of item.attachments) {
        result.push({ id: att.id, url: att.url, type: att.type, title: att.title });
      }
    }
    // Legacy single attachment (from old items)
    if (item.attachmentUrl && item.attachmentType) {
      // Only add if not already in new attachments
      const alreadyExists = result.some(a => a.url === item.attachmentUrl);
      if (!alreadyExists) {
        result.push({ id: -item.id, url: item.attachmentUrl, type: item.attachmentType, isLegacy: true });
      }
    }
    return result;
  };

  const items: BrainstormItemData[] = (boardData?.items as BrainstormItemData[] || []);

  const getItemsBySection = (section: Section) =>
    items.filter((i) => i.section === section);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando quadro...</p>
      </div>
    );
  }

  const handleSaveAttachmentTitle = (attachmentId: number) => {
    updateAttachmentTitleMutation.mutate({ attachmentId, title: editingAttachmentTitle });
    setEditingAttachmentId(null);
    setEditingAttachmentTitle("");
  };

  // Render attachment title line
  const renderAttachmentTitle = (att: { id: number; title?: string; isLegacy?: boolean }) => {
    if (att.isLegacy) return null; // Legacy attachments can't have titles
    const hasTitle = att.title && att.title.trim().length > 0;
    
    if (editingAttachmentId === att.id) {
      return (
        <div className="flex items-center gap-1 px-1 mt-0.5">
          <Input
            value={editingAttachmentTitle}
            onChange={(e) => setEditingAttachmentTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveAttachmentTitle(att.id);
              if (e.key === "Escape") { setEditingAttachmentId(null); setEditingAttachmentTitle(""); }
            }}
            placeholder="Descrição do anexo..."
            className="text-[10px] h-5 px-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => handleSaveAttachmentTitle(att.id)}>
            <Check className="h-3 w-3 text-emerald-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { setEditingAttachmentId(null); setEditingAttachmentTitle(""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (hasTitle) {
      return (
        <div className="flex items-center gap-1 px-1 mt-0.5">
          <p className="text-[10px] text-slate-600 font-medium truncate flex-1">{att.title}</p>
          {canEdit && (
            <Button size="icon" variant="ghost" className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => { setEditingAttachmentId(att.id); setEditingAttachmentTitle(att.title || ""); }}>
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      );
    }

    // No title yet - show add button on hover
    if (canEdit) {
      return (
        <div className="px-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="text-[10px] text-muted-foreground hover:text-slate-600 flex items-center gap-0.5"
            onClick={() => { setEditingAttachmentId(att.id); setEditingAttachmentTitle(""); }}
          >
            <Pencil className="h-2.5 w-2.5" /> Adicionar descrição
          </button>
        </div>
      );
    }
    return null;
  };

  // Render a single attachment preview
  const renderAttachmentPreview = (att: { id: number; url: string; type: string; title?: string; isLegacy?: boolean }, itemId: number) => {
    const isLegacy = att.isLegacy;
    const onRemove = () => {
      if (isLegacy) {
        handleRemoveLegacyAttachment(itemId);
      } else {
        handleRemoveAttachment(att.id);
      }
    };

    if (att.type === "image" || att.type === "photo") {
      return (
        <div key={att.id} className="relative group">
          <a href={att.url} target="_blank" rel="noopener noreferrer">
            <img src={att.url} alt={att.title || ""} className="w-full max-h-36 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity" />
          </a>
          {canEdit && (
            <Button variant="destructive" size="icon"
              className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={onRemove}>
              <X className="h-3 w-3" />
            </Button>
          )}
          {renderAttachmentTitle(att)}
        </div>
      );
    }

    if (att.type === "video") {
      const ytThumb = getYouTubeThumbnail(att.url);
      return (
        <div key={att.id} className="relative group">
          {ytThumb ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="block relative">
              <img src={ytThumb} alt="" className="w-full max-h-28 object-cover rounded" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors rounded">
                <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                  <Play className="h-4 w-4 text-white ml-0.5" />
                </div>
              </div>
            </a>
          ) : (
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-white/60 transition-colors">
              <div className="h-8 w-8 rounded bg-purple-100 flex items-center justify-center shrink-0">
                <Video className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-[10px] text-muted-foreground truncate flex-1">{att.title || att.url}</p>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </a>
          )}
          {canEdit && (
            <Button variant="destructive" size="icon"
              className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={onRemove}>
              <X className="h-3 w-3" />
            </Button>
          )}
          {renderAttachmentTitle(att)}
        </div>
      );
    }

    if (att.type === "document") {
      return (
        <div key={att.id} className="relative group">
          <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-white/60 transition-colors">
            <div className="h-8 w-8 rounded bg-orange-100 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-slate-700">{att.title || "Documento"}</p>
              <p className="text-[9px] text-muted-foreground">{getFileExtension(att.url)} • Clique para abrir</p>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          </a>
          {canEdit && (
            <Button variant="destructive" size="icon"
              className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={onRemove}>
              <X className="h-3 w-3" />
            </Button>
          )}
          {renderAttachmentTitle(att)}
        </div>
      );
    }

    // Default: link
    return (
      <div key={att.id} className="relative group">
        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-white/60 transition-colors">
          <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-[10px] text-muted-foreground truncate flex-1">{att.title || att.url}</p>
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
        </a>
        {canEdit && (
          <Button variant="destructive" size="icon"
            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        )}
        {renderAttachmentTitle(att)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const itemId = Number(fileInputRef.current?.dataset.itemId);
          const file = e.target.files?.[0];
          if (itemId && file) handleFileUpload(file, itemId, "photo");
          e.target.value = "";
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.ods,.odp"
        className="hidden"
        onChange={(e) => {
          const itemId = Number(docInputRef.current?.dataset.itemId);
          const file = e.target.files?.[0];
          if (itemId && file) handleFileUpload(file, itemId, "document");
          e.target.value = "";
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
          {items.length > 0 && (
            <Badge variant="outline" className="text-xs font-medium gap-1 px-3 py-1">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </Badge>
          )}
          {!canEdit && (
            <Badge variant="secondary" className="text-xs">Somente Visualização</Badge>
          )}
        </div>
      </div>

      {/* Manual / Guia de Uso */}
      <div className="bg-white shadow-sm border-b border-slate-200 -mx-3 md:-mx-4 px-3 md:px-4 mb-4">
        <div className="max-w-[1600px] mx-auto py-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center gap-2.5 text-sm hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 shrink-0">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <span className="font-semibold text-slate-700">Como usar o quadro</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">— clique para {showGuide ? 'ocultar' : 'ver'} as instruções</span>
            <div className="flex-1" />
            <div className={`h-6 w-6 rounded-full flex items-center justify-center bg-slate-100 transition-transform ${showGuide ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </div>
          </button>

          {showGuide && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm text-slate-600">
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded bg-emerald-100 flex items-center justify-center"><Plus className="h-3 w-3 text-emerald-600" /></div>
                    Adicionar Itens
                  </h3>
                  <p className="text-xs leading-relaxed">Digite o texto no campo de cada seção e pressione <kbd className="px-1 py-0.5 bg-slate-100 rounded border text-[10px] font-mono">Enter</kbd> ou clique no botão <strong>+</strong>.</p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center"><Paperclip className="h-3 w-3 text-blue-600" /></div>
                    Múltiplos Anexos
                  </h3>
                  <p className="text-xs leading-relaxed">Cada item pode ter <strong>vários anexos</strong>. Clique no ícone 📎 para adicionar:</p>
                  <ul className="text-xs space-y-0.5 ml-1">
                    <li>• Links, imagens, vídeos, fotos, documentos</li>
                    <li>• Upload do celular ou computador</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center"><Upload className="h-3 w-3 text-purple-600" /></div>
                    Upload de Arquivos
                  </h3>
                  <ul className="text-xs space-y-0.5 ml-1">
                    <li>• <strong>Tirar Foto</strong> — câmera do celular (5MB)</li>
                    <li>• <strong>Upload de Imagem</strong> — galeria/PC (5MB)</li>
                    <li>• <strong>Documento</strong> — PDF, DOC, XLS... (10MB)</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded bg-amber-100 flex items-center justify-center"><ArrowRightLeft className="h-3 w-3 text-amber-600" /></div>
                    Outras Ações
                  </h3>
                  <ul className="text-xs space-y-0.5 ml-1">
                    <li>• <strong>Editar</strong> — clique no texto do item</li>
                    <li>• <strong>Status</strong> — use o seletor em cada item</li>
                    <li>• <strong>Mover</strong> — para qualquer seção</li>
                    <li>• <strong>Excluir</strong> — ícone de lixeira</li>
                  </ul>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-muted-foreground">
                  <strong>Ideias</strong> (hipóteses) · <strong>Fatos</strong> (informações confirmadas) · <strong>Questões</strong> (dúvidas a investigar) · <strong>Metas</strong> (objetivos de aprendizagem) — atualização automática a cada 5s.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Board Grid */}
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
                {/* Add new item */}
                {canEdit && (
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
                    const itemAttachments = getItemAttachments(item);

                    return (
                      <div key={item.id} className={`${config.itemBg} rounded-lg border p-3 space-y-2 shadow-sm`}>
                        {/* Content */}
                        {canEdit ? (
                          <Textarea
                            defaultValue={item.content}
                            onBlur={(e) => {
                              if (e.target.value !== item.content) {
                                handleUpdateContent(item.id, e.target.value);
                              }
                            }}
                            className="text-sm min-h-[40px] resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent"
                            rows={1}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                        )}

                        {/* Attachments preview - multiple */}
                        {itemAttachments.length > 0 && (
                          <div className="space-y-1.5 rounded-lg overflow-hidden border bg-white/70 p-1.5">
                            {itemAttachments.length > 1 && (
                              <div className="flex items-center gap-1 px-1">
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-medium">{itemAttachments.length} anexos</span>
                              </div>
                            )}
                            {itemAttachments.map(att => renderAttachmentPreview(att, item.id))}
                          </div>
                        )}

                        {/* Status + Actions */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {canEdit ? (
                            <Select
                              value={item.status}
                              onValueChange={(val) => handleUpdateStatus(item.id, val)}
                            >
                              <SelectTrigger className={`h-7 text-xs w-auto min-w-[100px] rounded-full px-3 font-semibold border-2 shadow-sm ${statusConfig?.color || "bg-slate-100 text-slate-800 border-slate-300"}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {config.statuses.map(s => (
                                  <SelectItem key={s.value} value={s.value} className="text-xs">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${s.color.split(' ')[0]}`} />
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-xs px-3 py-1 rounded-full font-semibold border-2 shadow-sm ${statusConfig?.color || "bg-slate-100 text-slate-800 border-slate-300"}`}>
                              {statusConfig?.label || item.status}
                            </Badge>
                          )}

                          <div className="flex-1" />

                          {/* Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-0.5">
                              {/* Move */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Mover para outra seção" disabled={moveItemMutation.isPending}>
                                    <ArrowRightLeft className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {SECTIONS_ORDER.filter(s => s !== section).map(s => {
                                    const cfg = SECTION_CONFIG[s];
                                    const SIcon = cfg.icon;
                                    return (
                                      <DropdownMenuItem key={s} onClick={() => handleMoveItem(item.id, s)}>
                                        <SIcon className={`h-4 w-4 mr-2 ${cfg.color}`} /> {cfg.label}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* Add attachment (always available for multiple) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 relative" title="Adicionar anexo">
                                    <Paperclip className="h-3 w-3" />
                                    {itemAttachments.length > 0 && (
                                      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center shadow-sm">
                                        {itemAttachments.length}
                                      </span>
                                    )}
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
                                  <DropdownMenuItem onClick={() => handleImageFromDevice(item.id)}>
                                    <Upload className="h-4 w-4 mr-2" /> Upload de Imagem
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDocSelect(item.id)}>
                                    <FileText className="h-4 w-4 mr-2" /> Documento (PDF, DOC...)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

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
                        {attachmentDialogItemId === item.id && (attachmentType === "link" || attachmentType === "image" || attachmentType === "video") && (
                          <div className="flex gap-2 items-center mt-1">
                            <Input
                              placeholder={attachmentType === "link" ? "https://..." : attachmentType === "image" ? "URL da imagem..." : "URL do vídeo..."}
                              value={attachmentUrl}
                              onChange={(e) => setAttachmentUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddUrlAttachment(item.id);
                                if (e.key === "Escape") setAttachmentDialogItemId(null);
                              }}
                              className="text-xs h-7"
                              autoFocus
                            />
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddUrlAttachment(item.id)}>
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
            <p className="text-sm">Enviando arquivo...</p>
          </Card>
        </div>
      )}
    </div>
  );
}
