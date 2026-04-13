/**
 * handlebars.mjs
 * Register Handlebars helpers for the GHRPG system
 */

export function registerHandlebarsHelpers() {

  // Simple equality
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("ne", (a, b) => a !== b);
  Handlebars.registerHelper("lt", (a, b) => a < b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("and", (a, b) => a && b);
  Handlebars.registerHelper("or",  (a, b) => a || b);
  Handlebars.registerHelper("not", (a) => !a);

  // Math
  Handlebars.registerHelper("add", (a, b) => a + b);
  Handlebars.registerHelper("sub", (a, b) => a - b);
  Handlebars.registerHelper("mul", (a, b) => a * b);

  // String helpers
  Handlebars.registerHelper("capitalize", str =>
    String(str).charAt(0).toUpperCase() + String(str).slice(1)
  );

  // Sign-format a number (+2, -1, ±0)
  Handlebars.registerHelper("signedNum", n => {
    if (n > 0)  return `+${n}`;
    if (n < 0)  return String(n);
    return "±0";
  });

  // Returns a CSS class based on condition/element state
  Handlebars.registerHelper("stateClass", state => {
    if (state === "strong")  return "element-strong";
    if (state === "waning")  return "element-waning";
    return "element-inert";
  });

  // Return range array for use in loops
  Handlebars.registerHelper("times", (n, options) => {
    let result = "";
    for (let i = 0; i < n; i++) result += options.fn(i);
    return result;
  });

  // HP percentage for progress bar
  Handlebars.registerHelper("hpPct", (val, max) => Math.round((val / (max || 1)) * 100));

  // Deck card label CSS class
  Handlebars.registerHelper("cardClass", type => {
    const map = { null:"card-null", critical:"card-critical", bless:"card-bless", curse:"card-curse", normal:"card-normal" };
    return map[type] ?? "card-normal";
  });

  Handlebars.registerHelper("includes", (arr, val) => Array.isArray(arr) && arr.includes(val));
  Handlebars.registerHelper("add",  (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("lte",  (a, b) => Number(a) <= Number(b));
  Handlebars.registerHelper("gt",   (a, b) => Number(a) >  Number(b));
  Handlebars.registerHelper("math", (a, op, b) => {
    const x = Number(a), y = Number(b);
    if (op === "+") return x + y;
    if (op === "-") return x - y;
    if (op === "*") return x * y;
    if (op === "/") return x / y;
    return x;
  });

  // Filter an array by a property value: {{filter items type="skill"}}
  Handlebars.registerHelper("filter", (arr, options) => {
    if (!Array.isArray(arr)) return [];
    const hash = options.hash ?? {};
    return arr.filter(item =>
      Object.entries(hash).every(([k, v]) => item[k] === v || item?.system?.[k] === v)
    );
  });
}

export function registerHandlebarsPartials() {
  // Register any partial templates (none needed initially)
}
