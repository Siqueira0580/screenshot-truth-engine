import { useState } from "react";
import Joyride, { CallBackProps, STATUS, Step, Styles, TooltipRenderProps } from "react-joyride";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { setToursDisabled } from "@/hooks/useGuidedTour";

interface GuidedTourProps {
  steps: Step[];
  run: boolean;
  onFinish: () => void;
}

const joyrideStyles: Partial<Styles> = {
  options: {
    zIndex: 10000,
    arrowColor: "hsl(var(--card))",
    backgroundColor: "hsl(var(--card))",
    textColor: "hsl(var(--card-foreground))",
    overlayColor: "rgba(0, 0, 0, 0.65)",
    primaryColor: "hsl(var(--primary))",
    spotlightShadow: "0 0 25px rgba(0, 0, 0, 0.5)",
  },
  spotlight: {
    borderRadius: "12px",
  },
};

function CustomTooltip({
  index,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps & { dontShowAgain: boolean; setDontShowAgain: (v: boolean) => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const wrapHandler = (handler: any) => (e: any) => {
    if (dontShowAgain) setToursDisabled(true);
    handler.onClick?.(e);
  };

  return (
    <div
      {...tooltipProps}
      className="rounded-xl border border-border bg-card text-card-foreground p-5 shadow-2xl max-w-sm"
    >
      {step.title && (
        <h3 className="text-base font-bold mb-1.5 text-foreground">{step.title}</h3>
      )}
      <div className="text-sm text-muted-foreground leading-relaxed mb-4">
        {step.content}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none mb-4">
        <Checkbox
          checked={dontShowAgain}
          onCheckedChange={(v) => setDontShowAgain(v === true)}
        />
        Não exibir mais este tour
      </label>

      <div className="flex items-center justify-between">
        <button
          {...skipProps}
          onClick={wrapHandler(skipProps)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular Tour
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {index + 1}/{size}
          </span>
          {index > 0 && (
            <Button
              {...backProps}
              size="sm"
              variant="ghost"
              className="text-xs h-8"
            >
              Anterior
            </Button>
          )}
          <Button
            {...primaryProps}
            onClick={wrapHandler(primaryProps)}
            size="sm"
            className="text-xs h-8 px-4"
          >
            {isLastStep ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GuidedTour({ steps, run, onFinish }: GuidedTourProps) {
  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableScrolling={false}
      scrollOffset={80}
      callback={handleCallback}
      styles={joyrideStyles}
      tooltipComponent={CustomTooltip as any}
      locale={{
        back: "Anterior",
        close: "Fechar",
        last: "Concluir",
        next: "Próximo",
        open: "Abrir",
        skip: "Pular Tour",
      }}
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: { filter: "none" },
        },
      }}
    />
  );
}
