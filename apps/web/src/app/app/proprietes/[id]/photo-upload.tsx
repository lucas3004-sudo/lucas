"use client";
/**
 * Envoi de photos : chaque image est réduite dans le navigateur (1 600 px au plus, JPEG),
 * ce qui retire aussi ses métadonnées ; le serveur revérifie tout.
 */
import { startTransition, useActionState, useState } from "react";
import type { CrmState } from "@/lib/crm/actions";
import { uploadPhotoAction } from "@/lib/crm/photos";
import { Field } from "@/ui/form";
import { Alert } from "@/ui/surface";

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82));
}

export function PhotoUpload({ propertyId, remaining }: { propertyId: string; remaining: number }) {
  const [state, dispatch, pending] = useActionState(uploadPhotoAction, {} as CrmState);
  const [progress, setProgress] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []).slice(0, remaining);
    e.currentTarget.value = "";
    setLocalError(null);
    for (const [i, file] of files.entries()) {
      setProgress(`Envoi ${i + 1} sur ${files.length}…`);
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        setLocalError(`« ${file.name} » n'est pas une image lisible.`);
        continue;
      }
      const data = new FormData();
      data.set("propertyId", propertyId);
      data.set("photo", blob, "photo.jpg");
      await new Promise<void>((resolve) => startTransition(async () => { await dispatch(data); resolve(); }));
    }
    setProgress(null);
  }

  return (
    <div className="space-y-2 px-5 py-4">
      {localError ? <Alert tone="danger">{localError}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {progress ? <Alert tone="brand">{progress}</Alert> : state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Ajouter des photos" htmlFor="photos" hint={`JPEG ou PNG, réduites automatiquement. Les données de position (GPS) sont retirées. Encore ${remaining} possible(s).`}>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={pending || progress !== null || remaining <= 0}
          onChange={onChange}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
      </Field>
    </div>
  );
}
