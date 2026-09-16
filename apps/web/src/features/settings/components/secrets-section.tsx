/** BYO provider keys. Supports Anthropic / OpenAI / Google and Azure AI Foundry,
 * plus an ElevenLabs narration key. Plaintext keys are sent only to the API,
 * verified server-side, encrypted at rest, and never returned to the browser. */

import {
  type LlmKeyPreview,
  type ProviderId,
  type ProviderKeys,
  TTS_PROVIDER,
  type TtsKeyPreview,
} from "@animus/core";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { notifyCreditsChanged } from "@/lib/credit-events";
import { PROVIDERS } from "../data/providers";
import { SectionHeading } from "./section-heading";

const [FIRST_PROVIDER] = PROVIDERS;

function KeyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <Input
        autoComplete="off"
        className="pr-9 font-mono"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        type={reveal ? "text" : "password"}
        value={value}
      />
      <button
        aria-label={reveal ? "Hide key" : "Show key"}
        className="absolute top-1/2 right-1 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setReveal((v) => !v)}
        type="button"
      >
        {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

function SavedKeyRow({
  label,
  last4,
  saving,
  onRemove,
}: {
  label: string;
  last4: string;
  saving: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-sm border p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">••••{last4}</span>
      </div>
      <Button disabled={saving} onClick={onRemove} size="sm" variant="ghost">
        Remove
      </Button>
    </div>
  );
}

export function SecretsSection() {
  const [keys, setKeys] = useState<ProviderKeys>({ llm: null, tts: null });
  const [providerId, setProviderId] = useState<ProviderId>(FIRST_PROVIDER.id);
  const [modelId, setModelId] = useState(FIRST_PROVIDER.models[0]?.id ?? "");
  const [llmKeyInput, setLlmKeyInput] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [savingLlm, setSavingLlm] = useState(false);
  const [ttsKeyInput, setTtsKeyInput] = useState("");
  const [savingTts, setSavingTts] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ keys: ProviderKeys }>("/api/settings/keys")
      .then((data) => {
        if (!active) return;
        setKeys(data.keys);
        if (data.keys.llm) {
          setProviderId(data.keys.llm.provider);
          setModelId(data.keys.llm.model);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const provider = PROVIDERS.find((p) => p.id === providerId) ?? FIRST_PROVIDER;
  const isAzure = providerId === "azure";

  function selectProvider(id: ProviderId) {
    setProviderId(id);
    const next = PROVIDERS.find((p) => p.id === id) ?? FIRST_PROVIDER;
    setModelId(next.models[0]?.id ?? "");
  }

  async function saveLlm() {
    const key = llmKeyInput.trim();
    if (!(key && modelId)) return;

    const keyPayload = isAzure
      ? JSON.stringify({ apiKey: key, baseURL: azureEndpoint.trim() })
      : key;
    if (isAzure && !azureEndpoint.trim()) return;

    setSavingLlm(true);
    try {
      const data = await apiFetch<{ key: LlmKeyPreview }>("/api/settings/keys", {
        method: "PUT",
        body: JSON.stringify({
          kind: "llm",
          provider: providerId,
          model: modelId,
          key: keyPayload,
        }),
      });
      setKeys((prev) => ({ ...prev, llm: data.key }));
      setLlmKeyInput("");
      setAzureEndpoint("");
      notifyCreditsChanged();
      toast.success("Model key saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the key");
    } finally {
      setSavingLlm(false);
    }
  }

  async function removeLlm() {
    setSavingLlm(true);
    try {
      await apiFetch("/api/settings/keys?kind=llm", { method: "DELETE" });
      setKeys((prev) => ({ ...prev, llm: null }));
      notifyCreditsChanged();
    } catch {
      // Keep the key until the next attempt.
    } finally {
      setSavingLlm(false);
    }
  }

  async function saveTts() {
    const key = ttsKeyInput.trim();
    if (!key) return;
    setSavingTts(true);
    try {
      const data = await apiFetch<{ key: TtsKeyPreview }>("/api/settings/keys", {
        method: "PUT",
        body: JSON.stringify({ kind: "tts", key }),
      });
      setKeys((prev) => ({ ...prev, tts: data.key }));
      setTtsKeyInput("");
      notifyCreditsChanged();
      toast.success("ElevenLabs key saved");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the key");
    } finally {
      setSavingTts(false);
    }
  }

  async function removeTts() {
    setSavingTts(true);
    try {
      await apiFetch("/api/settings/keys?kind=tts", { method: "DELETE" });
      setKeys((prev) => ({ ...prev, tts: null }));
      notifyCreditsChanged();
    } catch {
      // Keep the key until the next attempt.
    } finally {
      setSavingTts(false);
    }
  }

  const savedLlmProvider = keys.llm
    ? PROVIDERS.find((p) => p.id === keys.llm?.provider)
    : undefined;

  return (
    <div className="space-y-8">
      <SectionHeading
        description="Bring your own key to generate for free. A brought key runs on your account and isn't metered."
        title="Bring your own keys"
      />

      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-sm">AI model</h3>
          <p className="text-muted-foreground text-xs">Runs the agent on your provider instead of ours.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="llm-provider">Provider</label>
            <Select onValueChange={(value) => selectProvider(value as ProviderId)} value={providerId}>
              <SelectTrigger className="w-full" id="llm-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex items-center gap-2"><ItemIcon size={16} />{item.name}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="llm-model">{isAzure ? "Deployment name" : "Model"}</label>
            {isAzure ? (
              <Input
                id="llm-model"
                onChange={(event) => setModelId(event.target.value)}
                placeholder="my-gpt-4o-deployment"
                value={modelId}
              />
            ) : (
              <Select onValueChange={setModelId} value={modelId}>
                <SelectTrigger className="w-full" id="llm-model"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {provider.models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {isAzure ? (
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="azure-endpoint">Azure AI Foundry OpenAI-compatible endpoint</label>
            <Input
              autoComplete="off"
              id="azure-endpoint"
              onChange={(event) => setAzureEndpoint(event.target.value)}
              placeholder="https://YOUR-RESOURCE.openai.azure.com/openai/v1"
              value={azureEndpoint}
            />
            <p className="text-muted-foreground text-xs">
              Use the OpenAI-compatible base URL for your Azure AI Foundry resource. The deployment name above is sent as the model id.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="llm-key">API key</label>
          <KeyInput id="llm-key" onChange={setLlmKeyInput} placeholder={provider.placeholder} value={llmKeyInput} />
          <a className="text-muted-foreground text-xs underline-offset-4 hover:underline" href={provider.docsUrl} rel="noreferrer" target="_blank">
            Get a {provider.name} key
          </a>
        </div>

        {keys.llm ? (
          <SavedKeyRow
            label={`${savedLlmProvider?.name ?? keys.llm.provider} · ${keys.llm.model}`}
            last4={keys.llm.last4}
            onRemove={() => void removeLlm()}
            saving={savingLlm}
          />
        ) : null}

        <Button disabled={savingLlm || !(llmKeyInput.trim() && modelId && (!isAzure || azureEndpoint.trim()))} onClick={() => void saveLlm()}>
          Save model key
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-sm">Narration ({TTS_PROVIDER.name})</h3>
          <p className="text-muted-foreground text-xs">Synthesizes narration on your ElevenLabs account. Your voice setting still applies.</p>
        </div>
        <div className="space-y-2">
          <label className="font-medium text-sm" htmlFor="tts-key">API key</label>
          <KeyInput id="tts-key" onChange={setTtsKeyInput} placeholder={TTS_PROVIDER.placeholder} value={ttsKeyInput} />
          <a className="text-muted-foreground text-xs underline-offset-4 hover:underline" href={TTS_PROVIDER.docsUrl} rel="noreferrer" target="_blank">
            Get an {TTS_PROVIDER.name} key
          </a>
        </div>
        {keys.tts ? (
          <SavedKeyRow label={TTS_PROVIDER.name} last4={keys.tts.last4} onRemove={() => void removeTts()} saving={savingTts} />
        ) : null}
        <Button disabled={savingTts || !ttsKeyInput.trim()} onClick={() => void saveTts()}>Save narration key</Button>
      </div>
    </div>
  );
}
