import { resolveCountryCode } from "@/lib/country";

export function paystackCountrySlug(countryCode?: string | null) {
  switch (resolveCountryCode(countryCode)) {
    case "GH":
      return "ghana";
    case "KE":
      return "kenya";
    case "ZA":
      return "south africa";
    default:
      return "nigeria";
  }
}

export function paystackRecipientType(countryCode?: string | null) {
  switch (resolveCountryCode(countryCode)) {
    case "GH":
      return "ghipss";
    case "KE":
    case "ZA":
      return "basa";
    default:
      return "nuban";
  }
}
