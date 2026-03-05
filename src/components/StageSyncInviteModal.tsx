import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Radio } from "lucide-react";

interface StageSyncInviteModalProps {
  open: boolean;
  masterName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function StageSyncInviteModal({ open, masterName, onAccept, onDecline }: StageSyncInviteModalProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Radio className="h-7 w-7 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-lg">
            Modo Palco — Sincronização
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <strong className="text-foreground">{masterName}</strong> iniciou a transmissão mestre deste repertório.
            <br />
            Ao aceitar, o seu ecrã será controlado remotamente (navegação e scroll sincronizados).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onDecline} className="w-full sm:w-auto">
            Recusar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onAccept} className="w-full sm:w-auto">
            Aceitar Controlo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
