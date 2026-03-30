import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRESENTATION_FONTS, type PresentationFontId } from "@/components/PresentationFontPicker";
import { toast } from "sonner";

interface FontPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewFont: PresentationFontId | null;
  sampleText: string;
  onApplyLocal: (font: PresentationFontId) => void;
  onApplyGlobal: (font: PresentationFontId) => void;
}

export default function FontPreviewModal({
  open,
  onOpenChange,
  previewFont,
  sampleText,
  onApplyLocal,
  onApplyGlobal,
}: FontPreviewModalProps) {
  const fontDef = PRESENTATION_FONTS.find((f) => f.id === previewFont);

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleApplyLocal = () => {
    if (!previewFont) return;
    onApplyLocal(previewFont);
    onOpenChange(false);
    toast.success("Fonte aplicada nesta música!");
  };

  const handleApplyGlobal = () => {
    if (!previewFont) return;
    onApplyGlobal(previewFont);
    onOpenChange(false);
    toast.success("Fonte definida como padrão para todas as músicas!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prévia da Tipografia</DialogTitle>
          <DialogDescription>
            Veja como a cifra ficará com a fonte{" "}
            <strong>{fontDef?.label ?? ""}</strong> antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div
          className="p-4 bg-muted rounded-md overflow-hidden max-h-48 overflow-y-auto"
          style={{ fontFamily: fontDef?.family }}
        >
          <pre className="text-sm whitespace-pre-wrap leading-6 text-foreground">
            {sampleText || "Nenhum texto disponível para prévia."}
          </pre>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleApplyLocal} className="flex-1">
              Aplicar nesta música
            </Button>
            <Button onClick={handleApplyGlobal} className="flex-1">
              Padrão Global
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
