import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AuthBranding from "@/components/AuthBranding";
import AuthFeatureShowcase from "@/components/AuthFeatureShowcase";
import { toast } from "sonner";
import { z } from "zod";

// --- Phone Mask ---
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// --- Zod Schema ---
const registerSchema = z.object({
  firstName: z.string().trim().min(1, "O nome é obrigatório").max(50),
  lastName: z.string().trim().min(1, "O sobrenome é obrigatório").max(50),
  email: z
    .string()
    .trim()
    .min(1, "O e-mail é obrigatório")
    .email("Por favor, insira um endereço de e-mail válido."),
  phone: z.string().optional(),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type FormErrors = Partial<Record<keyof z.infer<typeof registerSchema>, string>>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): z.infer<typeof registerSchema> | null => {
    const result = registerSchema.safeParse({
      firstName,
      lastName,
      email,
      phone,
      password,
    });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach((e) => {
        const key = e.path[0] as keyof FormErrors;
        if (!fieldErrors[key]) fieldErrors[key] = e.message;
      });
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return result.data;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            phone: cleanPhone || undefined,
          },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) toast.error(error.message);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left: Feature Showcase */}
      <div className="hidden lg:block lg:w-1/2 xl:w-[55%]">
        <AuthFeatureShowcase />
      </div>

      {/* Right: Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <AuthBranding subtitle="Crie sua conta" />

          {/* Mobile-only feature banner */}
          <div className="lg:hidden rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Novidades</p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="mr-1">✍️</span> <span className="text-foreground font-medium">Composição IA</span> — Cante e a IA escreve a cifra
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="mr-1">🎧</span> <span className="text-foreground font-medium">Estúdio Pró</span> — Isole instrumentos e pratique
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="mr-1">🎸</span> <span className="text-foreground font-medium">Palco</span> — Repertório inteligente com Loop
              </p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nome *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined })); }}
                  placeholder="João"
                  className={errors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Sobrenome *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined })); }}
                  placeholder="Silva"
                  className={errors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="seu@email.com"
                autoComplete="email"
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(applyPhoneMask(e.target.value)); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading || hasErrors}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleGoogleRegister} disabled={googleLoading}>
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Cadastrar com Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
