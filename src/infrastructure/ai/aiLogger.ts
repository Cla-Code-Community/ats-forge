export interface AiLogEvent {
  provider: string;
  model: string;
  operation: string;
  status: 'ok' | 'error';
  latencyMs?: number;
  tokens?: number;
  errorKind?: string;
  attempts?: number;
}

export type AiLogSink = (event: AiLogEvent) => void;

const defaultSink: AiLogSink = (event) => {
  console.log(`[ats-forge:ai] ${JSON.stringify(event)}`);
};

let sink: AiLogSink = defaultSink;

export function setAiLogSink(next: AiLogSink | null): void {
  sink = next ?? defaultSink;
}

export function logAiEvent(event: AiLogEvent): void {
  try {
    sink(event);
  } catch {
    void 0;
  }
}
