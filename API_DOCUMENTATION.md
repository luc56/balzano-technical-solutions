# Documentazione API AI Assistant - Instruments Tools (OpenAI Version)

Questa API permette all'app Android "Instruments Tools" di analizzare immagini di componenti elettrici e quadri utilizzando **OpenAI GPT-4o-mini**.

## Endpoint
- **URL**: `https://<tuo-dominio-vercel>.vercel.app/api/analyze`
- **Metodo**: `POST`
- **Content-Type**: `application/json`

## Struttura della Richiesta (JSON)

| Campo | Tipo | Obbligatorio | Descrizione |
| :--- | :--- | :--- | :--- |
| `image` | String | Sì | Immagine codificata in **Base64** (può includere o meno il prefisso `data:image/jpeg;base64,`). |
| `mode` | String | Sì | Tipo di analisi: `info`, `faults`, `suggestions`. |
| `description` | String | No | Dettagli aggiuntivi o sintomi del guasto. |
| `language` | String | No | Lingua della risposta: `it`, `en`, `de`. Default: `it`. |

### Esempio di Richiesta
```json
{
  "image": "iVBORw0KGgoAAAANS...",
  "mode": "faults",
  "description": "Si sente odore di bruciato vicino al teleruttore.",
  "language": "it"
}
```

## Configurazione Server (Vercel)

Devi aggiungere la tua chiave API di OpenAI nelle impostazioni di Vercel:

1. Vai su **Vercel Dashboard** > Il tuo progetto.
2. Vai in **Settings** > **Environment Variables**.
3. Aggiungi una nuova variabile:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `LA_TUA_CHIAVE_API_OPENAI_QUI`
4. Riesegui il deployment.

## Note Tecniche
- **Modello**: Utilizziamo `gpt-4o-mini`, che è ottimizzato per l'analisi visiva e molto più economico rispetto a GPT-4o standard, pur mantenendo un'altissima precisione tecnica.
- **Multilingua**: L'IA risponderà nella lingua specificata nel campo `language`. Se il campo è vuoto, risponderà in italiano.
- **Limiti**: OpenAI ha dei limiti di dimensione per le immagini. Si consiglia di comprimere le foto nell'app Android prima dell'invio (max 2MB o 1024px di larghezza).
