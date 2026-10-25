// Prompt template helper. (Clario reads requests with its fixed rules in src/engine/rules.ts; it has no AI parser.)

export const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
