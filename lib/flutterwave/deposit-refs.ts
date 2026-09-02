/**
 * Permanent Flutterwave virtual accounts reuse one tx_ref per user
 * (VA_{uuid without dashes}). Using that as the wallet funding key
 * credits the first transfer and treats every later transfer as a duplicate.
 */

export function vaReferenceForUser(userId: string) {
  return `VA_${userId.replace(/-/g, "")}`;
}

export function userIdFromVaReference(txRef?: string | null) {
  if (!txRef) return null;
  const raw = txRef.replace(/^VA_/i, "").replace(/-/g, "");
  if (raw.length !== 32 || !/^[0-9a-f]+$/i.test(raw)) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

export function isReusableVaTxRef(txRef?: string | null) {
  return Boolean(userIdFromVaReference(txRef));
}

function stringRef(value: unknown) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

/** Unique-per-payment ids we can safely store on wallet_fundings.external_ref. */
export function flutterwaveDepositRefs(data: {
  tx_ref?: unknown;
  flw_ref?: unknown;
  id?: unknown;
  reference?: unknown;
}) {
  const txRef = stringRef(data.tx_ref);
  const flwRef = stringRef(data.flw_ref);
  const idRaw = stringRef(data.id);
  const reusableVa = isReusableVaTxRef(txRef);
  const idRef =
    idRaw && (flwRef || reusableVa || idRaw.startsWith("FLW_"))
      ? idRaw.startsWith("FLW_")
        ? idRaw
        : `FLW_${idRaw}`
      : null;
  const checkoutRef = reusableVa ? null : txRef;
  const extraRef = isReusableVaTxRef(stringRef(data.reference))
    ? null
    : stringRef(data.reference);

  const aliases = [
    flwRef,
    idRef,
    checkoutRef,
    extraRef && extraRef !== txRef && extraRef !== flwRef ? extraRef : null,
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  return {
    primary: aliases[0] ?? null,
    aliases,
    txRef,
    reusableVa,
  };
}
