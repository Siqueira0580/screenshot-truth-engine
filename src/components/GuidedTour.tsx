import Joyride, { CallBackProps, STATUS, Step, Styles } from "react-joyride";

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
