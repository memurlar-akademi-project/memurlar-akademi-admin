/** Clear this device immediately; a late revocation never clears a newer login. */
export async function endAdminSession(
  token: string | null,
  clearLocal: () => void,
  revoke: (token: string) => Promise<unknown>,
): Promise<boolean> {
  clearLocal();
  if (!token) return true;
  try {
    await revoke(token);
    return true;
  } catch {
    // Offline/local logout does not prove that the server revoked the token.
    return false;
  }
}
