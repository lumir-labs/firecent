import { describe, expect, test } from "bun:test";
import { translate } from "./translate";

describe("translate", () => {
  test("resolves in the active locale", () => {
    expect(translate("es", "Search.title")).toBe("Explorar");
    expect(translate("en", "Search.title")).toBe("Explore");
  });

  test("interpolates vars", () => {
    expect(translate("es", "Auth.magicLinkSent", { email: "a@b.c" })).toBe(
      "Revisa tu correo: enviamos un enlace a a@b.c",
    );
  });

  test("falls back to `en` first, then `es` (English-first)", () => {
    const dicts = {
      es: { Only: {} },
      en: { Only: { here: "only en" } },
    } as never;
    expect(translate("es", "Only.here" as never, undefined, dicts)).toBe(
      "only en",
    );
  });

  test("still reaches `es` when the key is missing in both active and `en`", () => {
    const dicts = {
      es: { Only: { here: "solo es" } },
      en: { Only: {} },
    } as never;
    expect(translate("en", "Only.here" as never, undefined, dicts)).toBe(
      "solo es",
    );
  });

  test("returns the key if it does not exist in any locale", () => {
    const dicts = { es: {}, en: {} } as never;
    expect(translate("en", "Missing.key" as never, undefined, dicts)).toBe(
      "Missing.key",
    );
  });
});
