const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n) parts.push("and");
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n) parts.push(ONES[n]);
  return parts.join(" ");
}

function integerWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${belowThousand(chunk)}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
  }
  return groups.join(" ");
}

/** "Two Hundred and Fifty Kwacha Only", as written on a paper receipt. Ngwee are added when present. */
export function kwachaInWords(amount: string | number): string {
  const [whole, frac = "0"] = Number(amount).toFixed(2).split(".");
  const ngwee = Number(frac);
  return `${integerWords(Number(whole))} Kwacha${ngwee ? ` and ${integerWords(ngwee)} Ngwee` : ""} Only`;
}
