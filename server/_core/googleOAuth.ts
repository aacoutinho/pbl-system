import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

/**
 * Google OAuth 2.0 integration.
 * Works alongside the existing Manus OAuth — users can choose either provider.
 *
 * Flow:
 * 1. Frontend redirects to /api/auth/google?origin=<frontend_origin>
 * 2. Server redirects to Google consent screen
 * 3. Google redirects back to /api/auth/google/callback with code
 * 4. Server exchanges code for tokens, fetches user info
 * 5. Server upserts user, creates JWT session cookie, redirects to frontend
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

function getGoogleRedirectUri(req: Request): string {
  // Use the origin passed as query param, or infer from request
  const origin = req.query.origin as string | undefined;
  if (origin) {
    return `${origin}/api/auth/google/callback`;
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  /**
   * Step 1: Redirect user to Google consent screen
   * GET /api/auth/google?origin=https://myapp.com
   */
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({
        error: "Google OAuth not configured",
        message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
      });
      return;
    }

    const origin = (req.query.origin as string) || `${req.protocol}://${req.headers.host}`;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // Encode origin in state so callback knows where to redirect
    const state = Buffer.from(JSON.stringify({ origin })).toString("base64url");

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });

    res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  /**
   * Step 2: Handle Google callback
   * GET /api/auth/google/callback?code=...&state=...
   */
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const stateParam = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      console.error("[Google OAuth] Error from Google:", error);
      res.redirect(302, "/?error=google_auth_denied");
      return;
    }

    if (!code || !stateParam) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }

    // Decode origin from state
    let origin: string;
    try {
      const stateData = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      origin = stateData.origin;
    } catch {
      origin = `${req.protocol}://${req.headers.host}`;
    }

    const redirectUri = `${origin}/api/auth/google/callback`;

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("[Google OAuth] Token exchange failed:", errorBody);
        res.redirect(302, `${origin}/?error=google_token_failed`);
        return;
      }

      const tokens: GoogleTokenResponse = await tokenResponse.json() as GoogleTokenResponse;

      // Fetch user info
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        console.error("[Google OAuth] User info fetch failed");
        res.redirect(302, `${origin}/?error=google_userinfo_failed`);
        return;
      }

      const googleUser: GoogleUserInfo = await userInfoResponse.json() as GoogleUserInfo;

      if (!googleUser.email) {
        res.redirect(302, `${origin}/?error=google_no_email`);
        return;
      }

      // Use google:<google_id> as the openId to avoid collisions with Manus openIds
      const openId = `google:${googleUser.id}`;

      // Upsert user in database
      await db.upsertUser({
        openId,
        name: googleUser.name || null,
        email: googleUser.email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session JWT using the same SDK mechanism
      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || googleUser.email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log(`[Google OAuth] User logged in: ${googleUser.email} (${openId})`);
      res.redirect(302, `${origin}/`);
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      res.redirect(302, `${origin}/?error=google_auth_failed`);
    }
  });
}
