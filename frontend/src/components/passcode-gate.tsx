import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiClient, setStoredSiteToken } from "../api/client";

interface PasscodeGateProps {
  onUnlock: () => void;
}

export function PasscodeGate({
  onUnlock,
}: PasscodeGateProps): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post<{ status: string; token: string }>(
        "/auth/verify/",
        {
          password: trimmed,
        },
      );

      if (res.data.token) {
        setStoredSiteToken(res.data.token);
        onUnlock();
      } else {
        setError("Invalid response.");
      }
    } catch {
      setError("Incorrect passphrase");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xs space-y-4">
        <div className="text-center">
          <h2 className="text-sm font-medium text-foreground">
            Enter passphrase to access this app. Contact{" "}
            <a className="underline font-bold" href="https://ayaan.dev">
              ayaan.dev
            </a>{" "}
            to request passphrase
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative flex items-center">
            <Input
              type="password"
              placeholder="Passphrase"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="h-10 pr-10 text-sm bg-card border-border rounded-lg"
              autoFocus
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={isSubmitting || !password.trim()}
              className="absolute right-1 size-8 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              <span className="sr-only">Submit</span>
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
