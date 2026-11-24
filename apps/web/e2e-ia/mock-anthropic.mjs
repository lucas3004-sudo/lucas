/**
 * Faux serveur de l'API Anthropic, pour les tests de bout en bout des fonctions d'IA (D-069).
 * Il répond comme l'API Messages, avec des textes marqués « [Réponse de test] », et garde les
 * requêtes reçues (GET /__requetes) pour vérifier qu'aucune donnée de contact n'est envoyée.
 * Jamais utilisé en ligne : seul le fichier playwright.ia.config.ts le démarre.
 */
/* global process, console */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 3999);
const received = [];

function textFor(system) {
  if (system.includes("Tâche : rédaction d'annonce")) {
    return JSON.stringify({
      titre: "[Réponse de test] Appartement 3 pièces lumineux",
      description: "[Réponse de test] Appartement de trois pièces, lumineux et bien agencé, situé dans un quartier vivant, proche des commerces et des transports. Il dispose d'un ascenseur et d'une cave. Idéal pour une première acquisition.",
    });
  }
  if (system.includes("Tâche : analyse d'annonce")) {
    return JSON.stringify({
      verdict: "prix bien placé",
      analyse: "[Réponse de test] Points forts : surface, ascenseur. Points faibles : annonce sans photos. Prix : dans la fourchette du marché. Conseils : ajouter des photos lumineuses, préciser l'exposition.",
    });
  }
  if (system.includes("Tâche : message de relance")) {
    return "Bonjour [Prénom],\n\n[Réponse de test] Un appartement de 3 pièces vient d'arriver et correspond à votre recherche. Souhaitez-vous le visiter cette semaine ?";
  }
  if (system.includes("Tâche : récap d'activité")) {
    return "[Réponse de test] Cette semaine, l'agence a ajouté de nouveaux biens. Priorité : relancer les acquéreurs correspondants.";
  }
  return "[Réponse de test] Pour ajouter un bien, ouvrez le menu « Biens » puis « Nouveau bien ».";
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__requetes") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(received));
    return;
  }
  if (req.method === "GET" && req.url === "/__sante") {
    res.writeHead(200).end("ok");
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "inconnu" } }));
      return;
    }
    const payload = JSON.parse(body || "{}");
    received.push(payload);
    const system = Array.isArray(payload.system) ? payload.system.map((b) => b.text ?? "").join("\n") : String(payload.system ?? "");
    res.writeHead(200, { "content-type": "application/json", "request-id": `req_test_${received.length}` });
    res.end(JSON.stringify({
      id: `msg_test_${received.length}`, type: "message", role: "assistant", model: payload.model,
      content: [{ type: "text", text: textFor(system) }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Faux serveur d'IA sur 127.0.0.1:${PORT}`));
