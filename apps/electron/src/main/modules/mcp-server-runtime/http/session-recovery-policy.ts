export function shouldAutoRecoverInvalidStreamableSession(
  method: string,
  autoCreateSessionOnInvalidId: boolean,
): boolean {
  // Never create new sessions during delete/termination semantics.
  if (method.toUpperCase() === "DELETE") {
    return false;
  }
  return autoCreateSessionOnInvalidId;
}
