# Provider AI di StudIA - ZAINO

Verifica delle API ufficiali: 6 settembre 2026; Infomaniak aggiunto il 24 ottobre 2026. **AI cloud** propone Google, OpenAI, Anthropic e Infomaniak; le configurazioni precedenti Qwen, Kimi e DeepSeek restano utilizzabili. Un abbonamento alla relativa app di chat non equivale necessariamente a credito API.

| Provider | Creazione chiave | Elenco autenticato dei modelli | Risposta del tutor |
| --- | --- | --- | --- |
| Anthropic | [Claude Platform](https://platform.claude.com/settings/keys) | `GET https://api.anthropic.com/v1/models` | `POST /v1/messages` |
| Gemini | [Google AI Studio](https://aistudio.google.com/apikey) | `GET https://generativelanguage.googleapis.com/v1beta/models` | `POST /v1beta/models/{model}:generateContent` |
| OpenAI | [OpenAI Platform](https://platform.openai.com/api-keys) | `GET https://api.openai.com/v1/models` | `POST /v1/responses`; Chat Completions per modelli legacy |
| Qwen | [Alibaba Cloud Model Studio](https://bailian.console.alibabacloud.com/?tab=globalset#/efm/api_key) | `GET https://dashscope-intl.aliyuncs.com/api/v1/models` | `POST https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions` |
| Kimi | [Kimi Platform globale](https://platform.kimi.ai/console/api-keys) | `GET https://api.moonshot.ai/v1/models` | `POST /v1/chat/completions` |
| DeepSeek | [DeepSeek Platform](https://platform.deepseek.com/api_keys) | `GET https://api.deepseek.com/models` | `POST /chat/completions` |
| Infomaniak | [Token nel Manager](https://manager.infomaniak.com/v3/ng/accounts/token/list) | `GET https://api.infomaniak.com/2/ai/{product_id}/openai/v1/models` | `POST /2/ai/{product_id}/openai/v1/chat/completions` |

L’app propone soltanto gli ID restituiti dalle API con la chiave inserita: nessun catalogo statico di modelli. La presenza nell’elenco non garantisce credito, quota o accesso in inferenza; eventuali errori restano visibili. Si escludono modelli chiaramente dedicati a embedding, immagini, audio, moderazione e altri endpoint specializzati. I modelli multimodali capaci di rispondere in testo restano selezionabili quando il loro protocollo è compatibile.

Infomaniak usa un token Bearer con accesso ad **AI Services** e l’API compatibile OpenAI v2. Se l’ID prodotto non è configurato, l’app interroga `GET /1/ai`: un unico prodotto con stato `ok` viene selezionato automaticamente; se sono più di uno, occorre indicare l’ID in **AI cloud**. L’ID viene salvato separatamente dalla chiave e vale anche per schede e ripasso. [Elenco prodotti](https://developer.infomaniak.com/docs/api/get/1/ai), [modelli](https://developer.infomaniak.com/docs/api/get/2/ai/%7Bproduct_id%7D/openai/v1/models), [Chat Completions](https://developer.infomaniak.com/docs/api/post/2/ai/%7Bproduct_id%7D/openai/v1/chat/completions).

Qwen usa la regione **Singapore internazionale**. Serve una chiave Model Studio a consumo della stessa regione; le chiavi di altre regioni e dei Coding Plan non sono intercambiabili. Alibaba raccomanda nuovi domini con Workspace ID, ma documenta ancora il dominio internazionale esistente come funzionante. La paginazione del catalogo Qwen usa `page_no`, `page_size` e `output.total`, separatamente dall’endpoint OpenAI compatible della chat. Le risposte Qwen vengono lette in SSE e aggregate: alcuni modelli Qwen accettano soltanto streaming. [Regioni e compatibilità](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope), [domini esistenti](https://www.alibabacloud.com/help/en/model-studio/qwen-mt-api), [catalogo](https://www.alibabacloud.com/help/en/model-studio/list-models), [streaming](https://www.alibabacloud.com/help/en/model-studio/stream), [creazione chiavi](https://www.alibabacloud.com/help/en/model-studio/get-api-key).

Anthropic scorre le pagine con `has_more`/`last_id`/`after_id`. Gemini segue `nextPageToken` e richiede la capability `generateContent`. OpenAI, Kimi e DeepSeek documentano un unico elenco `data` senza cursori per questa operazione. [Anthropic Models](https://platform.claude.com/docs/en/api/models/list), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [Gemini Models](https://ai.google.dev/api/models), [Gemini Generate Content](https://ai.google.dev/api/generate-content), [OpenAI Models](https://developers.openai.com/api/reference/resources/models/methods/list), [OpenAI Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses), [Kimi Models](https://platform.kimi.ai/docs/api/list-models), [DeepSeek Models](https://api-docs.deepseek.com/api/list-models), [DeepSeek API](https://api-docs.deepseek.com/).

Gemini usa la chiave nell’header `x-goog-api-key`, mai nell’URL. Le nuove chiavi di AI Studio sono chiavi di autorizzazione; chiavi standard precedenti possono richiedere migrazione. [Gestione chiavi Gemini](https://ai.google.dev/gemini-api/docs/api-key).

Kimi utilizza la piattaforma globale `kimi.ai`; le chiavi della piattaforma cinese non sono intercambiabili. Per i modelli che richiedono Preserved Thinking, il campo tecnico `reasoningContent` viene restituito separatamente dal testo e può essere conservato nei messaggi assistant. Non va mostrato nella chat. Quando si riprende una cronologia senza quel campo, viene inviata come trascrizione testuale nel messaggio utente, mantenendo separato il system prompt. [Kimi Quickstart](https://platform.kimi.ai/docs/overview), [parametri e cronologia](https://platform.kimi.ai/docs/api/models-overview), [Chat API](https://platform.kimi.ai/docs/api/chat).

Il modulo `lib/chat-provider.js` non salva chiavi, non esegue strumenti del modello e non stampa dati. Usa timeout di 30 secondi per ogni pagina del catalogo e 180 secondi per la risposta completa, accetta un `AbortSignal` e non ritenta automaticamente richieste potenzialmente fatturabili. Gli errori mostrano provider, stato HTTP e una spiegazione locale senza riportare messaggi remoti, URL o credenziali. OpenAI riceve `store: false`.

Contratto: `catalogo() → [{id,nome,keyUrl,nota?}]`; `modelli(provider,apiKey,{signal?,timeoutMs?,productId?}) → [{id,nome,contesto,maxOutput}]`; `rispondi({provider,apiKey,model,system,messages,signal?,timeoutMs?,productId?}) → {text,usage,reasoningContent?}`. `productId` è facoltativo e riguarda soltanto Infomaniak. I messaggi contengono `role: user|assistant`, `content` testuale e, soltanto per assistant Kimi, l’eventuale `reasoningContent`.

Verifica locale: `node test/chat-provider.js`. I test simulano tutte le risposte con `fetch`: non richiedono segreti, connessioni o costi. Il funzionamento con account reali, relativi permessi e credito va verificato inserendo le proprie chiavi nell’app.


### Stima delle schede complete — 27 ottobre 2026

Le tariffe standard per la stima stanno in `App/assets/chat/schede-piano.js`,
separate dal vecchio listino della pipeline CORSI. Fonti verificate:
- Google: https://ai.google.dev/gemini-api/docs/pricing
- OpenAI: https://developers.openai.com/api/docs/models/gpt-4.1-mini
- Anthropic: https://platform.claude.com/docs/en/about-claude/pricing

Gemini 4 Argon: 2/10 USD per milione di token in ingresso/uscita fino al
30 novembre 2026; 4/20 dal 1 dicembre. Niente sconti caching o gratuità
presunti. La stima comprende le parti, il confronto dei duplicati e una possibile
correzione per richiesta. I token sono stimati dai caratteri, quindi la fascia
non è un massimale garantito. Per modelli assenti non si inventa un prezzo:
l’utente inserisce le tariffe del proprio account prima della conferma.
