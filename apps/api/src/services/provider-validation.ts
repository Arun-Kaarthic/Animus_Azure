/** Validate a BYO provider key with a single, cheap, read-only request before we
 * store it — so a typo surfaces immediately instead of failing mid-render. */

import type { ProviderId } from "@animus/core";
import { logger } from "../lib/logger.ts";

const VALIDATION_TIMEOUT_MS = 10_000;

async function isOk(
  url: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
    return res.ok;
  } catch (error) {
    const { origin, pathname } = new URL(url);
    logger.warn(
      {
        endpoint: `${origin}${pathname}`,
        reason: error instanceof Error ? error.name : "unknown",
      },
      "provider key validation request failed"
    );
    return false;
  }
}

function parseAzureCredential(value: string): { apiKey: string; baseURL: string } | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.apiKey !== "string" ||
      typeof parsed.baseURL !== "string" ||
      !parsed.apiKey.trim() ||
      !parsed.baseURL.trim()
    ) {
      return null;
    }

    const baseURL = parsed.baseURL.replace(/\/$/, "");
    const url = new URL(baseURL);
    if (url.protocol !== "https:") return null;
    if (!baseURL.endsWith("/openai/v1")) return null;

    return { apiKey: parsed.apiKey.trim(), baseURL };
  } catch {
    return null;
  }
}

/** Validate an LLM provider key. Exhaustive over the supported providers. */
export function validateLlmKey(
  provider: ProviderId,
  apiKey: string,
  model?: string
): Promise<boolean> {
  switch (provider) {
    case "anthropic":
      return isOk("https://api.anthropic.com/v1/models", {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      });
    case "openai":
      return isOk("https://api.openai.com/v1/models", {
        authorization: `Bearer ${apiKey}`,
      });
    case "google":
      return isOk(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {}
      );
    case "azure": {
      const credential = parseAzureCredential(apiKey);
      if (!credential) return Promise.resolve(false);

      // Azure AI Foundry OpenAI v1 accepts API keys using api-key. Also send
      // Authorization: Bearer for compatible gateways that use that form.
      const headers = {
        "api-key": credential.apiKey,
        authorization: `Bearer ${credential.apiKey}`,
      };

      if (model?.trim()) {
        return isOk(
          `${credential.baseURL}/models/${encodeURIComponent(model.trim())}`,
          headers
        ).then((ok) =>
          ok ? true : isOk(`${credential.baseURL}/models`, headers)
        );
      }

      return isOk(`${credential.baseURL}/models`, headers);
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
}

/** Validate an ElevenLabs key against the read-only user endpoint. */
export function validateTtsKey(apiKey: string): Promise<boolean> {
  return isOk("https://api.elevenlabs.io/v1/user", { "xi-api-key": apiKey });
}
