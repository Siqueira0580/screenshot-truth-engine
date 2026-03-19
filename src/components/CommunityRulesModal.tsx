import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export default function CommunityRulesModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Regras</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Regras da Comunidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-foreground/90">
          <div className="flex gap-3">
            <span className="text-lg shrink-0">🎸</span>
            <div>
              <p className="font-semibold">1. Respeito Sempre</p>
              <p className="text-muted-foreground">Sem ofensas, discurso de ódio ou assédio.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg shrink-0">🚫</span>
            <div>
              <p className="font-semibold">2. Sem Spam</p>
              <p className="text-muted-foreground">Não poste o mesmo link dezenas de vezes.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg shrink-0">🤝</span>
            <div>
              <p className="font-semibold">3. Foco na Música</p>
              <p className="text-muted-foreground">Este é um espaço para partilhar conhecimento, cifras, procurar parceiros de banda e falar sobre arte.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg shrink-0">👮</span>
            <div>
              <p className="font-semibold">4. Moderação</p>
              <p className="text-muted-foreground">Contas que violarem as regras poderão ser suspensas sem aviso prévio.</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setOpen(false)} className="w-full mt-2">
          Entendi e Concordo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
