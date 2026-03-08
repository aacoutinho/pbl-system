/**
 * StudentPhotoModal
 *
 * Componente reutilizável que exibe a foto do aluno em tamanho reduzido (avatar)
 * e, ao clicar, abre um modal com a foto ampliada e o nome do aluno.
 *
 * Uso:
 *   <StudentPhotoAvatar
 *     photoUrl={student.photoUrl}
 *     studentName={student.name}
 *     size="md"          // "sm" | "md" | "lg"
 *     className="..."    // classes extras no avatar
 *   />
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-base",
};

interface StudentPhotoAvatarProps {
  photoUrl: string | null | undefined;
  studentName: string;
  size?: AvatarSize;
  className?: string;
  /** Se false, desabilita o clique para ampliar (ex: tela do próprio aluno) */
  clickable?: boolean;
  borderClass?: string;
}

export function StudentPhotoAvatar({
  photoUrl,
  studentName,
  size = "md",
  className,
  clickable = true,
  borderClass,
}: StudentPhotoAvatarProps) {
  const [open, setOpen] = useState(false);

  const sizeClass = SIZE_CLASSES[size];
  const border = borderClass ?? "border-2 border-muted";
  const initial = studentName?.charAt(0)?.toUpperCase() ?? "?";

  const handleClick = () => {
    if (clickable && photoUrl) setOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "rounded-full shrink-0 overflow-hidden flex items-center justify-center",
          sizeClass,
          border,
          clickable && photoUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : "",
          className,
        )}
        onClick={handleClick}
        title={clickable && photoUrl ? `Ver foto de ${studentName}` : undefined}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={studentName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-medium text-muted-foreground select-none">{initial}</span>
        )}
      </div>

      {/* Modal de visualização ampliada */}
      {clickable && photoUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
            <DialogTitle className="sr-only">Foto de {studentName}</DialogTitle>
            <DialogDescription className="sr-only">Visualização ampliada da foto de {studentName}</DialogDescription>
            <div className="flex flex-col items-center gap-0">
              <img
                src={photoUrl}
                alt={studentName}
                className="w-full object-cover max-h-[70vh]"
              />
              <div className="w-full px-6 py-4 bg-background text-center">
                <p className="text-base font-semibold leading-tight">{studentName}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
