import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeSpotifyCode } from "@/lib/spotify-service";
import { Loader2 } from "lucide-react";

export default function SpotifyCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const err = searchParams.get("error");

    if (err) {
      setError("Autorização cancelada.");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    if (!code) {
      setError("Código não encontrado.");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    exchangeSpotifyCode(code)
      .then(() => {
        const returnPath = sessionStorage.getItem("spotify_return_path") || "/";
        sessionStorage.removeItem("spotify_return_path");
        navigate(returnPath, { replace: true });
      })
      .catch((e) => {
        setError(e.message);
        setTimeout(() => navigate("/"), 3000);
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Conectando ao Spotify...</p>
        </>
      )}
    </div>
  );
}
