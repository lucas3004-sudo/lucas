"use client";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { buttonClass } from "@/ui/button";
import { Field, Input } from "@/ui/form";
import { Alert } from "@/ui/surface";

type Setup = { uri: string; secret: string; qr: string; backupCodes: string[] };

export function TwoFactorSettings({ enabled, recommended }: { enabled: boolean; recommended: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    const { data, error: e } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (e || !data) return setError(authErrorMessage(e));
    if (data.method !== "totp") return setError("Méthode de double authentification inattendue.");
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ uri: data.totpURI, secret, qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }), backupCodes: data.backupCodes });
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    setError(null);
    const { error: e } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (e) return setError(authErrorMessage(e));
    setSetup(null);
    setNotice("Double authentification activée. Gardez vos codes de secours en lieu sûr.");
    router.refresh();
  }

  async function disable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    const { error: e } = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (e) return setError(authErrorMessage(e));
    setNotice("Double authentification désactivée.");
    router.refresh();
  }

  return (
    <div className="space-y-4 px-5 py-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {enabled && !setup ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-ink">La double authentification protège ce compte.</p>
          <Field label="Mot de passe (pour désactiver)" htmlFor="password-off">
            <Input id="password-off" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <button type="submit" disabled={pending} className={buttonClass("danger")}>Désactiver</button>
        </form>
      ) : null}

      {!enabled && !setup ? (
        <form onSubmit={start} className="space-y-3">
          {recommended ? (
            <Alert tone="warning">Recommandée pour le gérant et les managers : ils voient toutes les données de l&apos;agence.</Alert>
          ) : null}
          <Field label="Mot de passe" htmlFor="password-on">
            <Input id="password-on" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>Activer la double authentification</button>
        </form>
      ) : null}

      {setup ? (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>Scannez ce QR code avec votre application d&apos;authentification.</li>
            <li>Notez les codes de secours : chacun permet une connexion si vous perdez votre téléphone.</li>
            <li>Saisissez le code affiché par l&apos;application pour terminer.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-6">
            {/* QR code généré dans le navigateur : la clé ne quitte pas la page. */}
            <img src={setup.qr} alt="QR code de configuration de la double authentification" width={220} height={220} className="rounded border border-line" />
            <div className="space-y-2 text-sm">
              <p className="text-ink-muted">Ou saisissez la clé à la main :</p>
              <p data-testid="totp-secret" className="break-all font-mono text-ink">{setup.secret}</p>
              <p className="pt-2 text-ink-muted">Codes de secours :</p>
              <ul data-testid="backup-codes" className="grid grid-cols-2 gap-x-4 font-mono text-ink">
                {setup.backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <form onSubmit={confirm} className="space-y-3">
            <Field label="Code de l'application" htmlFor="code">
              <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            </Field>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>Terminer l&apos;activation</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
