/**
 * OpenAI strict-schema dialect transformer.
 *
 * Probe-verified 2026-07-22 (verbatim provider error: "Missing 'isAnchor'",
 * code invalid_json_schema): OpenAI's strict json_schema validator requires
 *   - `required` to list EVERY key in `properties` — optionality must be
 *     expressed as a type union with null, not by omission from `required`
 *   - `additionalProperties: false` on every object
 * Anthropic/Google accept our schemas as written, so this transform is applied
 * only to direct OpenAI requests and OpenRouter openai/* slugs. Same logical
 * contract, provider-dialect compliance.
 *
 * HONESTY NOTE (2026-07-26 re-probe): the identical untransformed anatomist
 * schema now returns 200 on openai/gpt-5.4-mini — the provider relaxed or
 * fixed something in the intervening 4 days, so this transform is currently
 * DEFENSE, not a live bug fix. It is kept because it matches OpenAI's own
 * documented strict-mode requirements and is idempotent; if the strictness
 * returns, the benchmark does not silently lose a model again.
 *
 * MOVED 2026-07 from scripts/sutta-studio/openai-strict-schema.ts into
 * services/ai/ because the production compile pipeline (OpenAIAdapter.chatJSON)
 * now applies it too — not just the benchmark. The old path re-exports from
 * here so benchmark imports keep working.
 */

const withNull = (prop: any): any => {
  if (!prop || typeof prop !== 'object' || Array.isArray(prop)) return prop;
  // enum/const constrain the VALUE independently of `type` — a value must
  // satisfy both, so widening `type` alone still forbids null and would force
  // the model to fabricate an enum value for an optional field it wants to
  // omit (codex review P1: optional morph.case/number, ghostKind, status).
  if (Array.isArray(prop.enum)) {
    const withNullEnum = prop.enum.includes(null) ? prop.enum : [...prop.enum, null];
    const base = { ...prop, enum: withNullEnum };
    if (typeof base.type === 'string') return base.type === 'null' ? base : { ...base, type: [base.type, 'null'] };
    if (Array.isArray(base.type)) return base.type.includes('null') ? base : { ...base, type: [...base.type, 'null'] };
    return base;
  }
  if (prop.const !== undefined) {
    // const X + null-optionality is expressible only as an enum.
    const { const: constValue, ...rest } = prop;
    const base = { ...rest, enum: [constValue, null] };
    if (typeof base.type === 'string') return base.type === 'null' ? base : { ...base, type: [base.type, 'null'] };
    if (Array.isArray(base.type)) return base.type.includes('null') ? base : { ...base, type: [...base.type, 'null'] };
    return base;
  }
  if (typeof prop.type === 'string') {
    return prop.type === 'null' ? prop : { ...prop, type: [prop.type, 'null'] };
  }
  if (Array.isArray(prop.type)) {
    return prop.type.includes('null') ? prop : { ...prop, type: [...prop.type, 'null'] };
  }
  if (Array.isArray(prop.anyOf)) {
    return prop.anyOf.some((x: any) => x && x.type === 'null')
      ? prop
      : { ...prop, anyOf: [...prop.anyOf, { type: 'null' }] };
  }
  return { anyOf: [prop, { type: 'null' }] };
};

/**
 * An "open map" property — `type: 'object'` with a schema-valued (or true)
 * `additionalProperties` and no fixed `properties`. Our `ripples` field
 * (Record<english-token-id, string>) is the live instance.
 *
 * OpenAI's strict dialect CANNOT express this shape: it requires
 * `additionalProperties: false` on every object, which would forbid every key
 * of the map. There is no lossless encoding, so the transform DROPS such
 * properties for openai/* targets — a DISCLOSED degradation: models routed to
 * OpenAI's strict validator cannot emit ripples (sense-conditional ghost-word
 * overrides), while every other provider keeps the full contract.
 */
const isOpenMap = (prop: any): boolean =>
  !!prop &&
  typeof prop === 'object' &&
  !Array.isArray(prop) &&
  prop.type === 'object' &&
  !prop.properties &&
  prop.additionalProperties !== undefined &&
  prop.additionalProperties !== false;

export const toOpenAIStrictSchema = (schema: any): any => {
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: any = { ...node };

    for (const k of ['items', 'contains'] as const) {
      if (out[k]) out[k] = walk(out[k]);
    }
    for (const k of ['anyOf', 'allOf', 'oneOf'] as const) {
      if (Array.isArray(out[k])) out[k] = out[k].map(walk);
    }
    for (const k of ['$defs', 'definitions'] as const) {
      if (out[k] && typeof out[k] === 'object') {
        out[k] = Object.fromEntries(Object.entries(out[k]).map(([key, v]) => [key, walk(v)]));
      }
    }

    if (out.properties && typeof out.properties === 'object') {
      // Open-map properties (see isOpenMap) are inexpressible in the strict
      // dialect — drop them from properties AND required rather than shipping
      // a schema the validator will 400 on (or a closed {} that lies about
      // the contract). Currently drops: ripples.
      const keys = Object.keys(out.properties).filter((key) => !isOpenMap(out.properties[key]));
      const previouslyRequired = new Set<string>(Array.isArray(out.required) ? out.required : []);
      out.properties = Object.fromEntries(
        keys.map((key) => {
          let prop = walk(out.properties[key]);
          if (!previouslyRequired.has(key)) prop = withNull(prop);
          return [key, prop];
        })
      );
      out.required = keys;
      if (out.additionalProperties === undefined) out.additionalProperties = false;
    }

    return out;
  };
  return walk(schema);
};

/** OpenRouter slugs whose upstream is OpenAI's strict validator. */
export const needsOpenAIStrictSchema = (modelSlug: string): boolean =>
  modelSlug.toLowerCase().startsWith('openai/');
