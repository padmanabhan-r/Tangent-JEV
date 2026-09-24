"use client";

import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TOPICS, OTHER, evenDistribution, type Distribution, type Topic, type TopicReading } from "@/lib/topics";

export type Phrase = { id: number; text: string; reading: TopicReading | null };

const DEBOUNCE_MS = 220;
const SMOOTHING = 0.45;

const idsOf = (topics: Topic[]) => [...topics.map((t) => t.id), OTHER.id];

async function classify(current: string, previous: string[], topics: Topic[], signal?: AbortSignal) {
  const res = await fetch("/api/topic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ current, previous, topics }),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Jev could not classify that phrase.");
  return data as TopicReading;
}

export function useTangent() {
  const [topics, setTopicsState] = useState<Topic[]>(DEFAULT_TOPICS);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [partial, setPartial] = useState("");
  const [partialReading, setPartialReading] = useState<TopicReading | null>(null);
  const [meters, setMeters] = useState<Distribution>(() => evenDistribution(idsOf(DEFAULT_TOPICS)));
  const [lastReading, setLastReading] = useState<TopicReading | null>(null);
  const [calls, setCalls] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const phrasesRef = useRef<Phrase[]>([]);
  const topicsRef = useRef<Topic[]>(DEFAULT_TOPICS);
  const partialReadingRef = useRef<TopicReading | null>(null);
  const partialAbort = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClassified = useRef("");
  const nextId = useRef(1);

  useEffect(() => {
    phrasesRef.current = phrases;
  }, [phrases]);

  useEffect(() => {
    partialReadingRef.current = partialReading;
  }, [partialReading]);

  const absorb = useCallback((reading: TopicReading) => {
    setLastReading(reading);
    setCalls((n) => n + 1);
    setError(null);
    setMeters((prev) => {
      const next: Distribution = {};
      for (const id of Object.keys(prev)) {
        next[id] = prev[id] * (1 - SMOOTHING) + (reading.probabilities[id] ?? 0) * SMOOTHING;
      }
      return next;
    });
  }, []);

  const context = () => phrasesRef.current.slice(-2).map((p) => p.text);

  const updatePartial = useCallback(
    (text: string) => {
      setPartial(text);
      if (debounce.current) clearTimeout(debounce.current);
      const trimmed = text.trim();
      if (!trimmed) {
        setPartialReading(null);
        return;
      }
      debounce.current = setTimeout(async () => {
        if (trimmed === lastClassified.current) return;
        lastClassified.current = trimmed;
        partialAbort.current?.abort();
        const ctrl = new AbortController();
        partialAbort.current = ctrl;
        try {
          const reading = await classify(trimmed, context(), topicsRef.current, ctrl.signal);
          if (ctrl.signal.aborted) return;
          setPartialReading(reading);
          absorb(reading);
        } catch (err) {
          if (!ctrl.signal.aborted) setError((err as Error).message);
        }
      }, DEBOUNCE_MS);
    },
    [absorb],
  );

  const commit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (debounce.current) clearTimeout(debounce.current);
      partialAbort.current?.abort();
      lastClassified.current = "";
      setPartial("");
      if (!trimmed) {
        setPartialReading(null);
        return;
      }

      const id = nextId.current++;
      const previous = context();
      const provisional = partialReadingRef.current;
      setPartialReading(null);
      setPhrases((list) => [...list, { id, text: trimmed, reading: provisional }]);

      try {
        const reading = await classify(trimmed, previous, topicsRef.current);
        setPhrases((list) => list.map((p) => (p.id === id ? { ...p, reading } : p)));
        absorb(reading);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [absorb],
  );

  const handlers = useRef({ updatePartial, commit });
  useEffect(() => {
    handlers.current = { updatePartial, commit };
  }, [updatePartial, commit]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 0.7,
    onPartialTranscript: ({ text }) => handlers.current.updatePartial(text),
    onCommittedTranscript: ({ text }) => handlers.current.commit(text),
    onError: (err) => setError(err instanceof Error ? err.message : "The microphone stream stopped."),
  });

  const start = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/scribe-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setError((err as Error).message || "Could not start the microphone.");
    }
  }, [scribe]);

  const stop = useCallback(() => {
    scribe.disconnect();
    if (partial.trim()) void commit(partial);
  }, [scribe, partial, commit]);

  const reset = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    partialAbort.current?.abort();
    lastClassified.current = "";
    setPhrases([]);
    setPartial("");
    setPartialReading(null);
    setMeters(evenDistribution(idsOf(topicsRef.current)));
    setLastReading(null);
    setCalls(0);
    setError(null);
  }, []);

  const setTopics = useCallback(
    (next: Topic[]) => {
      topicsRef.current = next;
      setTopicsState(next);
      reset();
    },
    [reset],
  );

  return {
    topics,
    setTopics,
    phrases,
    partial,
    partialReading,
    meters,
    lastReading,
    calls,
    error,
    listening: scribe.isConnected,
    connecting: scribe.status === "connecting",
    start,
    stop,
    reset,
    typePartial: updatePartial,
    typeCommit: commit,
  };
}
