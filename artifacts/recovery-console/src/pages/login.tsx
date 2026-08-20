import { useState } from "react";
import { ShieldAlert, KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateRecoverySession } from "@/hooks/api";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRecoverySessionQueryKey } from "@workspace/api-client-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const createSession = useCreateRecoverySession({ request: { credentials: "include" } });
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");

    createSession.mutate(
      { data: { password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRecoverySessionQueryKey() });
        },
        onError: (err) => {
          setError(err.message || "Invalid password or rate limit exceeded.");
        }
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="rounded-full bg-primary/10 p-3 ring-1 ring-primary/20">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recovery Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Secure workspace for authorized device recovery
          </p>
        </div>

        <Card className="border-primary/10 shadow-lg">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Enter the operations password to access fleet data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Operations Password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    disabled={createSession.isPending}
                  />
                </div>
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={!password || createSession.isPending}>
                {createSession.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Unlock Console"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          All access attempts are logged and monitored.
        </p>
      </div>
    </div>
  );
}
