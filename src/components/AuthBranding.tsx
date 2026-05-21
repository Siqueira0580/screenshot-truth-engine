import smartCifraLogo from "@/assets/smart-cifra-logo.webp";

interface AuthBrandingProps {
  subtitle?: string;
}

export default function AuthBranding({ subtitle }: AuthBrandingProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <img src={smartCifraLogo} alt="Smart Cifra" className="h-12 w-12 rounded-lg bg-white dark:bg-transparent p-1 ring-1 ring-border dark:ring-0" />
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        Smart<span className="text-primary">Cifra</span>
      </h1>
      {subtitle && (
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      )}
    </div>
  );
}
