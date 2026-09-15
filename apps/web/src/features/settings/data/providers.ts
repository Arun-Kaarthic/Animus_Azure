/** Web view of the shared LLM provider registry (@animus/core), with each
 * provider's brand logo from @lobehub/icons attached (a web-only concern). */

import {
  type ModelOption,
  PROVIDERS as PROVIDER_INFO,
  type ProviderId,
} from "@animus/core";
import { Anthropic, Azure, Gemini, type IconType, OpenAI } from "@lobehub/icons";

const ICONS: Record<ProviderId, IconType> = {
  openai: OpenAI,
  anthropic: Anthropic,
  google: Gemini,
  azure: Azure,
};

export interface Provider {
  docsUrl: string;
  envKey: string;
  icon: IconType;
  id: ProviderId;
  models: readonly ModelOption[];
  name: string;
  placeholder: string;
}

export const PROVIDERS: Provider[] = PROVIDER_INFO.map((provider) => ({
  ...provider,
  icon: ICONS[provider.id],
}));
