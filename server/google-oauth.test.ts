import { describe, expect, it } from "vitest";

describe("Google OAuth configuration", () => {
  it("GOOGLE_CLIENT_ID is set and has correct format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    // Google Client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and has correct format", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeDefined();
    expect(clientSecret).not.toBe("");
    // Google Client Secrets start with GOCSPX-
    expect(clientSecret).toMatch(/^GOCSPX-/);
  });

  it("Google OAuth discovery endpoint is reachable", async () => {
    // Validate that we can reach Google's OAuth discovery document
    const response = await fetch(
      "https://accounts.google.com/.well-known/openid-configuration"
    );
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.authorization_endpoint).toContain("accounts.google.com");
    expect(data.token_endpoint).toContain("googleapis.com");
  });
});
