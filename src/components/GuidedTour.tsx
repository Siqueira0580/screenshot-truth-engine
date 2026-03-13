import { useState } from "react";
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS, Step, Styles } from "react-joyride";

interface GuidedTourProps {
  steps: Step[];
  run: boolean;
  onFinish: () => void;
  /** When true, disables the dark overlay (useful inside dialogs) */
  disableOverlay?: boolean;
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
  tooltip: {
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid hsl(var(--border))",
    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.4)",
  },
  tooltipTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "6px",
  },
  tooltipContent: {
    fontSize: "14px",
    lineHeight: "1.6",
    padding: "8px 0",
  },
  buttonNext: {
    backgroundColor: "hsl(var(--primary))",
    color: "hsl(var(--primary-foreground))",
    borderRadius: "8px",
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: 600,
  },
  buttonBack: {
    color: "hsl(var(--muted-foreground))",
    fontSize: "13px",
    marginRight: "8px",
  },
  buttonSkip: {
    color: "hsl(var(--muted-foreground))",
    fontSize: "13px",
  },
  buttonClose: {
    color: "hsl(var(--muted-foreground))",
  },
  spotlight: {
    borderRadius: "12px",
  },
};

export default function GuidedTour({ steps, run, onFinish, disableOverlay }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type, index } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setStepIndex(0);
      onFinish();
      return;
    }

    // Manually manage step index for reliable advancement
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // Skip missing targets
      setStepIndex(index + 1);
    }
  };

  // Reset step index when tour restarts
  if (run && stepIndex >= steps.length) {
    setStepIndex(0);
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      disableOverlay={disableOverlay}
      disableScrolling
      scrollOffset={80}
      callback={handleCallback}
      styles={joyrideStyles}
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
