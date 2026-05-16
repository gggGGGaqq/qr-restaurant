const cp1251Extra =
  "\u0402\u0403\u201a\u0453\u201e\u2026\u2020\u2021\u20ac\u2030\u0409\u2039\u040a\u040c\u040b\u040f" +
  "\u0452\u2018\u2019\u201c\u201d\u2022\u2013\u2014\ufffd\u2122\u0459\u203a\u045a\u045c\u045b\u045f" +
  "\u00a0\u040e\u045e\u0408\u00a4\u0490\u00a6\u00a7\u0401\u00a9\u0404\u00ab\u00ac\u00ad\u00ae\u0407" +
  "\u00b0\u00b1\u0406\u0456\u0491\u00b5\u00b6\u00b7\u0451\u2116\u0454\u00bb\u0458\u0405\u0455\u0457";

const cp1251Reverse = new Map<string, number>();

for (let index = 0; index < cp1251Extra.length; index += 1) {
  cp1251Reverse.set(cp1251Extra[index], 0x80 + index);
}

for (let code = 0x410; code <= 0x44f; code += 1) {
  cp1251Reverse.set(String.fromCharCode(code), code - 0x410 + 0xc0);
}

function looksLikeMojibake(value: string): boolean {
  return /(?:Р[Ѐ-ӿ‚„…†‡‰‹“”•–—™›№]|С[Ѐ-ӿ‚„…†‡‰‹“”•–—™›№])/.test(value);
}

export function fixMojibake(value: string | null | undefined): string {
  if (!value) return "";
  if (!looksLikeMojibake(value)) return value;

  const bytes = Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    if (code <= 0x7f) return code;
    return cp1251Reverse.get(char) ?? code;
  });

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    return decoded.includes("\ufffd") ? value : decoded;
  } catch {
    return value;
  }
}
