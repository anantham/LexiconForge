/**
 * OpenAI strict-schema dialect transformer.
 *
 * Probe-verified 2026-07-22 (verbatim provider error: "Missing 'isAnchor'",
 * code invalid_json_schema): OpenAI's strict json_schema validator requires
 *   - `required` to list EVERY key in `properties` — optionality must be
 *     expressed as a type union with null, not by omission from `required`
 *   - `additionalProperties: false` on every object
 * Anthropic/Google accept our schemas as written, so this transform is applied
 * for openai/* slugs only. Same logical contract, provider-dialect compliance.
 *
 * HONESTY NOTE (2026-07-26 re-probe): the identical untransformed anatomist
 * schema now returns 200 on openai/gpt-5.4-mini — the provider relaxed or
 * fixed something in the intervening 4 days, so this transform is currently
 * DEFENSE, not a live bug fix. It is kept because it matches OpenAI's own
 * documented strict-mode requirements and is idempotent; if the strictness
 * returns, the benchmark does not silently lose a model again.
 */

const withNull = (prop: any): any => {
  if (!prop || typeof prop !== 'object' || Array.isArray(prop)) return prop;
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
      const keys = Object.keys(out.properties);
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
