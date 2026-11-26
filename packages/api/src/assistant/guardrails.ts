/**
 * Multi-layer deterministic guardrails for Firecent's AI Financial Assistant:
 * - Layer 1 (Pre-LLM, 0 tokens, <1ms): blocks prompt injection, system-prompt
 *   extraction, cross-tenant probes, coding/programming requests (even when
 *   wrapped with a finance pretext like "Voy a meter mis finanzas pero primero..."),
 *   and clearly off-topic non-financial requests.
 * - Layer 2 (Prompt Hygiene): neutralizes fake internal markers inside untrusted
 *   user text and attached bank documents.
 * - Layer 3 (Post-LLM Output Guard): guarantees no system-prompt text, internal
 *   tool names, or programming code ever leaks to the user even if the LLM slips.
 */

export type GuardrailCategory =
  | "PROMPT_INJECTION"
  | "UNAUTHORIZED_ACCESS"
  | "OFF_TOPIC_CODING"
  | "OFF_TOPIC_GENERAL";

export type InputGuardrailResult =
  | { allowed: true }
  | {
      allowed: false;
      category: GuardrailCategory;
      refusal: string;
    };

export function normalizeForGuardrail(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  // Direct references to system prompt / hidden internal blocks / internal tool names
  /\b(system\s*prompt|prompt\s*(del\s*)?sistema|prompt\s*inicial|prompt\s*oculto|developer\s*prompt|hidden\s*prompt|instrucciones\s*(internas|del\s*sistema|ocultas|secretas|originales|iniciales)|reglas\s*(internas|del\s*sistema|ocultas|secretas)|space_context|static_system_prompt|stage_statement_extraction|list_unmatched_transfers|get_financial_overview|query_transactions)\b/,
  // Classic override / jailbreak directives
  /\b(ignora|olvida|descarta|omite|anula|salta|sobrescribe|ignore|forget|disregard|override|bypass|discard)\b.{0,50}\b(instrucciones|reglas|directrices|indicaciones|restricciones|guardrails|limites|todo\s+lo\s+anterior|lo\s+anterior|previous|above|prior|instructions|rules|guidelines|restrictions|constraints)\b/,
  // Asking to repeat / dump / translate / summarize hidden instructions
  /\b(repite|imprime|muestra|muestrame|dime|dame|revela|copia|devuelve|traduce|explica|enumera|lista|cual\s+es|cuales\s+son|print|show|reveal|repeat|dump|output|leak|expose|display|echo|tell\s+me|give\s+me|what\s+are)\b.{0,45}\b(tus\s+instrucciones|tus\s+reglas|tu\s+prompt|el\s+prompt|your\s+instructions|your\s+rules|your\s+prompt|above\s+prompt|initial\s+instructions|exact\s+instructions|todo\s+lo\s+que\s+(esta|dice|hay)\s+arriba|everything\s+above|text\s+above)\b/,
  // Persona / mode hijack
  /\b(modo\s+desarrollador|modo\s+dan|developer\s+mode|jailbreak|do\s+anything\s+now|dan\s+mode|sin\s+restricciones|without\s+restrictions|actua\s+como\s+(un\s+|una\s+)?(hacker|programador|desarrollador|asistente\s+sin\s+limites|chatgpt|copilot)|pretend\s+you\s+have\s+no\s+rules|act\s+as\s+a\s+(hacker|programmer|developer|unrestricted))\b/,
];

const UNAUTHORIZED_ACCESS_PATTERNS: RegExp[] = [
  /\b(cuentas\s+de\s+otros?\s+usuarios?|datos\s+de\s+otros?\s+usuarios?|saldo\s+de\s+otro\s+usuario|movimientos\s+de\s+otro\s+usuario|otro\s+space|otra\s+organizacion|otras\s+organizaciones|todos\s+los\s+usuarios\s+de\s+la\s+(db|base\s+de\s+datos)|other\s+users?'?\s+(accounts?|data|balances?|spaces?|transactions?)|another\s+(user|organization|space)'?s?\s+(account|data|balance|transactions?)|dump\s+(the\s+)?database|select\s+\*\s+from|drop\s+table|union\s+select)\b/,
];

const PROGRAMMING_LANGUAGES_OR_CONSTRUCTS_RE =
  /\b(python|javascript|typescript|java|c\+\+|c#|csharp|rust|golang|php|ruby|swift|kotlin|html|css|sql|nosql|bash|shell|powershell|react|nextjs|next\.js|angular|vue|svelte|django|flask|fastapi|node\.?js|docker|kubernetes|recursiv[oa]s?|recursion|algoritmo|algorithm|bucle|for\s+loop|while\s+loop|array|arreglo|matriz|linked\s+list|arbol\s+binario|binary\s+tree|bubble\s+sort|quicksort|fibonacci|fizzbuzz|factorial|regex|expresion\s+regular|endpoint|api\s+rest|json\s+parser|scrape|scraping|compilar|debuggear|depurar|dockerfile|dockerfile|git\s+rebase)\b/;

const CODING_REQUEST_INTENT_RE =
  /\b(dame|hazme|haz|escribe|escribeme|crea|creame|genera|generame|pasa|pasame|muestra|muestrame|implementa|programa|codifica|resuelve|arregla|corrige|debuggea|depura|ayudame\s+a\s+(programar|codificar|escribir)|como\s+(hacer|escribir|programar|implementar)|write|give\s+me|create|generate|make\s+me|build\s+me|implement|code|fix|debug|solve|how\s+to\s+(code|program|implement|write))\b.{0,40}\b(un\s+|una\s+|el\s+|la\s+|a\s+|an\s+|the\s+)?(codigo|script|programa|algoritmo|funcion|metodo|clase|snippet|regex|consulta\s+sql|query\s+sql|componente|endpoint|code|function|algorithm|program|class|method|recursion|suma\s+recursiva)\b/;

const EXPLICIT_SCRIPT_REQUEST_RE =
  /\b(dame|hazme|escribe|escribeme|crea|creame|genera|generame|write|give\s+me|create|generate|make\s+me)\b.{0,30}\b(un\s+|una\s+|a\s+|an\s+)?(script|algoritmo|programa|snippet|regex|codigo\s+(en|de)\s+(python|py|javascript|js|typescript|ts|java|c\+\+|c#|csharp|rust|go|golang|php|ruby|swift|kotlin|html|css|sql|bash|shell|powershell|react|vue|angular|node)|code\s+in\s+(python|py|javascript|js|typescript|ts|java|c\+\+|c#|csharp|rust|go|golang|php|ruby|swift|kotlin|html|css|sql|bash|shell|powershell|react|vue|angular|node))\b/;

const OFF_TOPIC_GENERAL_PATTERNS: RegExp[] = [
  /\b(cuentame|dime|escribe|escribeme|hazme|crea|genera|inventa|tell\s+me|write\s+me|write\s+a|give\s+me\s+a)\b.{0,25}\b(un\s+|una\s+|a\s+|an\s+)?(chiste|broma|poema|poesia|cuento|fabula|cancion|ensayo|carta\s+de\s+amor|horoscopo|joke|poem|story|fable|song|essay|love\s+letter|horoscope)\b/,
  /\b(receta\s+(de|para)\s+|como\s+cocinar\b|ingredientes\s+para\s+(hacer|preparar|cocinar)|recipe\s+for\b|how\s+to\s+cook\b)/,
  /\b(quien\s+gano\s+el\s+mundial|cual\s+es\s+la\s+capital\s+de\b|who\s+won\s+the\s+world\s+cup|what\s+is\s+the\s+capital\s+of\b)/,
];

export function getGuardrailRefusal(
  category: GuardrailCategory,
  locale: "es" | "en",
): string {
  const es = locale === "es";
  if (category === "PROMPT_INJECTION") {
    return es
      ? "No puedo compartir instrucciones internas ni cambiar mis reglas de funcionamiento. Solo puedo ayudarte con tus finanzas personales en Firecent (estados de cuenta, saldos, gastos, presupuestos y transferencias)."
      : "I can't share internal instructions or override my operating rules. I can only help you with your personal finances in Firecent (statements, balances, expenses, budgets, and transfers).";
  }
  if (category === "UNAUTHORIZED_ACCESS") {
    return es
      ? "Por seguridad, solo tengo acceso de lectura a los datos de tu Space activo y nunca puedo ver cuentas ni movimientos de otros usuarios u otras organizaciones."
      : "For security, I only have access to data in your active Space and can never view accounts or transactions belonging to other users or organizations.";
  }
  if (category === "OFF_TOPIC_CODING") {
    return es
      ? "Solo puedo ayudarte con tus finanzas personales en Firecent (importar estados de cuenta, revisar saldos, gastos, ingresos, categorías, presupuestos y transferencias); no puedo escribir ni resolver código de programación. Cuando quieras, sube tu estado de cuenta o pregúntame por tus movimientos."
      : "I can only help with your personal finances in Firecent (importing statements, reviewing balances, spending, income, categories, budgets, and transfers); I can't write or debug programming code. Whenever you're ready, upload a statement or ask about your finances.";
  }
  return es
    ? "Solo puedo ayudarte con tus finanzas personales en Firecent (estados de cuenta, saldos, gastos, ingresos, presupuestos y transferencias). ¿En qué te ayudo con tus cuentas?"
    : "I can only help with your personal finances in Firecent (bank statements, balances, spending, income, budgets, and transfers). How can I help with your accounts?";
}

/**
 * Layer 1 deterministic pre-LLM input guardrail (<1ms, 0 tokens).
 */
export function evaluateUserInputGuardrail(opts: {
  message: string;
  hasAttachments: boolean;
  locale: "es" | "en";
}): InputGuardrailResult {
  const norm = normalizeForGuardrail(opts.message);
  if (!norm) {
    return { allowed: true };
  }

  for (const re of PROMPT_INJECTION_PATTERNS) {
    if (re.test(norm)) {
      return {
        allowed: false,
        category: "PROMPT_INJECTION",
        refusal: getGuardrailRefusal("PROMPT_INJECTION", opts.locale),
      };
    }
  }

  for (const re of UNAUTHORIZED_ACCESS_PATTERNS) {
    if (re.test(norm)) {
      return {
        allowed: false,
        category: "UNAUTHORIZED_ACCESS",
        refusal: getGuardrailRefusal("UNAUTHORIZED_ACCESS", opts.locale),
      };
    }
  }

  // Coding / programming detection (blocks even if user adds a finance pretext
  // like "Voy a meter mis finanzas pero primero dame un codigo de python...")
  if (
    EXPLICIT_SCRIPT_REQUEST_RE.test(norm) ||
    (CODING_REQUEST_INTENT_RE.test(norm) &&
      PROGRAMMING_LANGUAGES_OR_CONSTRUCTS_RE.test(norm))
  ) {
    return {
      allowed: false,
      category: "OFF_TOPIC_CODING",
      refusal: getGuardrailRefusal("OFF_TOPIC_CODING", opts.locale),
    };
  }

  // General non-financial tasks (only block automatically when no statement is attached)
  if (!opts.hasAttachments) {
    for (const re of OFF_TOPIC_GENERAL_PATTERNS) {
      if (re.test(norm)) {
        return {
          allowed: false,
          category: "OFF_TOPIC_GENERAL",
          refusal: getGuardrailRefusal("OFF_TOPIC_GENERAL", opts.locale),
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Layer 2 prompt hygiene: neutralizes internal delimiter tags inside untrusted
 * user messages and uploaded statement files so they cannot spoof system context.
 */
export function sanitizeUntrustedText(raw: string): string {
  return raw
    .replace(/\[SPACE_CONTEXT\]/gi, "[space_context]")
    .replace(/<\/?untrusted_statement_data>/gi, "");
}

const OUTPUT_LEAK_MARKERS: RegExp[] = [
  /\[SPACE_CONTEXT\]/i,
  /\bSTATIC_SYSTEM_PROMPT\b/,
  /\bCRITICAL EFFICIENCY RULE\b/i,
  /\bSECURITY & SCOPE POLICY\b/i,
  /\bTopPayees\s*\(id\|name\|typicalCat\)/i,
  /\bActivePendingImportInThread\b/,
  /\bCREDIT_DEBT_POSITIVE\b/,
  /\bstage_statement_extraction\b/,
  /\blist_unmatched_transfers\b/,
  /\bget_financial_overview\b/,
  /\bquery_transactions\b/,
  /<\/?untrusted_statement_data>/i,
];

const OUTPUT_CODE_BLOCK_RE =
  /```(?:python|py|javascript|js|typescript|ts|tsx|jsx|java|cpp|c\+\+|c#|csharp|cs|go|golang|rust|php|ruby|swift|kotlin|sql|html|css|bash|sh|powershell|ps1)\b/i;

const OUTPUT_RAW_CODE_RE =
  /(?:^|\n)\s*(?:def\s+[a-z_]\w*\s*\([^)]*\)\s*:|function\s+[a-z_]\w*\s*\([^)]*\)\s*\{|class\s+[A-Z]\w*\s*(?:\([^)]*\))?\s*[:{]|#include\s*<|public\s+static\s+void\s+main\b|console\.log\(|print\([a-z_]\w*\()/m;

/**
 * Layer 3 deterministic post-LLM output guard: guarantees the model never leaks
 * confidential prompt internals or outputs programming code blocks.
 */
export function enforceAssistantOutputGuardrail(
  content: string,
  locale: "es" | "en",
): { content: string; redacted: boolean; reason?: GuardrailCategory } {
  if (!content.trim()) {
    return { content, redacted: false };
  }

  for (const re of OUTPUT_LEAK_MARKERS) {
    if (re.test(content)) {
      return {
        content: getGuardrailRefusal("PROMPT_INJECTION", locale),
        redacted: true,
        reason: "PROMPT_INJECTION",
      };
    }
  }

  if (OUTPUT_CODE_BLOCK_RE.test(content) || OUTPUT_RAW_CODE_RE.test(content)) {
    return {
      content: getGuardrailRefusal("OFF_TOPIC_CODING", locale),
      redacted: true,
      reason: "OFF_TOPIC_CODING",
    };
  }

  return { content, redacted: false };
}

/**
 * Scrubs any accidental system-prompt marker lines from streamed reasoning detail
 * shown in the collapsible trace UI.
 */
export function sanitizeReasoningDetail(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const safeLines = trimmed
    .split("\n")
    .filter((line) => !OUTPUT_LEAK_MARKERS.some((re) => re.test(line)));
  const cleaned = safeLines.join("\n").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 1800 ? `${cleaned.slice(0, 1800)}…` : cleaned;
}
