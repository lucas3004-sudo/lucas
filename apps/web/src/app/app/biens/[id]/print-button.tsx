"use client";
import { buttonClass } from "@/ui/button";

/** Export PDF par l'impression du navigateur (« Enregistrer au format PDF ») : identique à l'écran (D-028). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      Imprimer / PDF
    </button>
  );
}
