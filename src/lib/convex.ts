import { ConvexHttpClient } from "convex/browser";
import { CONFIG } from "../constants/config";

const STORAGE_KEY_AUTH = "convex-auth-token";

/** Create the client lazily so we don't throw before config exists. */
function createClient(): ConvexHttpClient {
  return new ConvexHttpClient(CONFIG.convexUrl);
}

let _client: ConvexHttpClient | null = null;

/** Get or create the singleton ConvexHttpClient. */
export function getClient(): ConvexHttpClient | null {
  if (!CONFIG.convexUrl) return null;
  if (!_client) {
    _client = createClient();
    // Restore any saved auth token so queries run authenticated
    const savedToken = localStorage.getItem(STORAGE_KEY_AUTH);
    if (savedToken) {
      try {
        _client.setAuth(savedToken);
      } catch {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    }
  }
  return _client;
}

/** Check if Convex is configured. */
export function isConvexConfigured(): boolean {
  return !!CONFIG.convexUrl;
}

/** Check if the current client has an active auth token. */
export function hasAuthToken(): boolean {
  return !!localStorage.getItem(STORAGE_KEY_AUTH);
}

/** Send an email verification code (Convex email auth). */
export async function sendAuthCode(email: string): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "Convex is not configured. Add VITE_CONVEX_URL to your .env." };

  try {
    if (!client.auth?.sendEmailVerificationCode) {
      return {
        ok: false,
        error:
          "Email auth not deployed. Run: npx convex deploy && npx convex env set AUTH_RESEND_KEY re_xxx",
      };
    }
    await client.auth.sendEmailVerificationCode({ email });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send code";
    return { ok: false, error: msg };
  }
}

/** Verify an email verification code and persist the auth token. */
export async function verifyAuthCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; error?: string; token?: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "Convex is not configured" };

  try {
    if (!client.auth?.verifyEmailVerificationCode) {
      return {
        ok: false,
        error:
          "Email auth not deployed. Run: npx convex deploy && npx convex env set AUTH_RESEND_KEY re_xxx",
      };
    }
    const result = await client.auth.verifyEmailVerificationCode({ email, code });
    if (!result) return { ok: false, error: "Invalid verification code" };

    // Convex returns a token object with .token, handle both formats
    const token = result.token ?? (result as unknown as string);
    client.setAuth(token as string);
    localStorage.setItem(STORAGE_KEY_AUTH, token as string);
    return { ok: true, token: token as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify code";
    return { ok: false, error: msg };
  }
}

/** Get the current authenticated user's identity from Convex. */
export async function getUserIdentity(): Promise<{
  subject: string;
  email: string;
  name?: string;
} | null> {
  const client = getClient();
  if (!client) return null;
  if (!client.auth) return null;
  try {
    return await client.auth.getUserIdentity();
  } catch {
    return null;
  }
}

/** Clear the auth token (sign out). */
export function clearAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY_AUTH);
  if (_client) {
    // Re-create the client without the old token
    _client = new ConvexHttpClient(CONFIG.convexUrl);
  }
}

/**
 * Helper: call a Convex query with typed args.
 * Passes the current auth token automatically via setAuth.
 */
export async function convexQuery<Args extends Record<string, unknown>, Result>(
  queryPath: string,
  args: Args,
): Promise<Result | null> {
  try {
    const client = getClient();
    if (!client) return null;
    return (await client.query(queryPath, args)) as Result;
  } catch (err) {
    console.error(`Convex query "${queryPath}" failed:`, err);
    return null;
  }
}

/** Helper: call a Convex action (server-side function with external API access). */
export async function convexAction<Args extends Record<string, unknown>, Result>(
  actionPath: string,
  args: Args,
): Promise<Result | null> {
  try {
    const client = getClient();
    if (!client) return null;
    return (await client.action(actionPath, args)) as Result;
  } catch (err) {
    console.error(`Convex action "${actionPath}" failed:`, err);
    return null;
  }
}

/** Helper: call a Convex mutation with auth. */
export async function convexMutation<Args extends Record<string, unknown>, Result>(
  mutationPath: string,
  args: Args,
): Promise<Result | null> {
  try {
    const client = getClient();
    if (!client) return null;
    return (await client.mutation(mutationPath, args)) as Result;
  } catch (err) {
    console.error(`Convex mutation "${mutationPath}" failed:`, err);
    return null;
  }
}