"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TopicEditor } from "@/components/TopicEditor";
import { OTHER, colorVar, type Distribution, type Topic, type TopicReading } from "@/lib/topics";
import { useTangent } from "@/lib/useTangent";

const CUE_MS = 4000;

export function Tangent() {
  const t = useTangent();
  const current = t.partialReading?.topic ?? t.lastReading?.topic ?? null;
  const empty = t.phrases.length === 0 && !t.partial;
  const labels = listOf(t.topics.map((topic) => topic.label));

  // Holds the phrase count when Start was pressed; the cue hides once the first new words arrive.
  const [cueFrom, setCueFrom] = useState<number | null>(null);
  useEffect(() => {
    if (cueFrom === null) return;
    const id = setTimeout(() => setCueFrom(null), CUE_MS);
    return () => clearTimeout(id);
  }, [cueFrom]);
  const showCue = cueFrom !== null && t.phrases.length === cueFrom && !t.partial && !t.error;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-[36rem]">
          <h1 className="font-reading text-[3.25rem] leading-none tracking-[-0.02em] italic sm:text-[4.5rem]">
            Tangent
          </h1>
          <p className="mt-3 text-[1.05rem] leading-snug text-[var(--ink-soft)]">
            Talk about {labels}. Jev marks the topic of each phrase while you&rsquo;re still speaking, and the
            bars follow where the conversation drifts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {t.listening ? (
            <button
              onClick={t.stop}
              className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--ink)] px-6 font-medium text-[var(--paper)]"
            >
              <span className="size-2.5 animate-pulse rounded-full bg-[#ff6b5e] motion-reduce:animate-none" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => {
                setCueFrom(t.phrases.length);
                void t.start();
              }}
              disabled={t.connecting}
              className="inline-flex h-12 items-center rounded-full bg-[var(--ink)] px-6 font-medium text-[var(--paper)] disabled:opacity-60"
            >
              {t.connecting ? "Connecting…" : "Start talking"}
            </button>
          )}
          {!empty && (
            <button
              onClick={t.reset}
              className="h-12 rounded-full px-4 text-[var(--ink-soft)] underline-offset-4 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {t.error && (
        <p role="alert" className="mt-6 rounded-lg border border-[var(--rule)] bg-[var(--panel)] px-4 py-3">
          {t.error}
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <aside className="self-start lg:sticky lg:top-10 lg:order-last">
          <NowPanel
            topics={t.topics}
            onTopics={t.setTopics}
            current={current}
            meters={t.meters}
            reading={t.lastReading}
            calls={t.calls}
          />
        </aside>

        <section aria-live="polite" className="min-h-[40vh]">
          {empty ? (
            <p className="font-reading text-[1.6rem] leading-[1.45] text-[var(--ink-soft)] sm:text-[2rem]">
              Press <em>Start talking</em> and drift between {labels}. Each phrase gets the highlight of its
              topic, and it can change mid-sentence.
            </p>
          ) : (
            <p className="font-reading text-[1.6rem] leading-[1.5] sm:text-[2rem]">
              {t.phrases.map((p) => (
                <span key={p.id}>
                  <Mark text={p.text} reading={p.reading} topics={t.topics} />{" "}
                </span>
              ))}
              {t.partial && <Mark text={t.partial} reading={t.partialReading} topics={t.topics} pending />}
              {t.listening && <span className="caret" aria-hidden />}
            </p>
          )}
        </section>
      </div>

      <TypeInstead onType={t.typePartial} onCommit={t.typeCommit} />

      <footer className="mt-14 max-w-[40rem] text-sm leading-relaxed text-[var(--ink-soft)]">
        Your words aren&rsquo;t stored. Your voice goes to ElevenLabs Scribe for live transcription, and each
        phrase goes to Jev by TypeSafe AI, which answers with one topic and a probability for every topic.
      </footer>

      {showCue && (
        <div
          role="status"
          className="cue fixed bottom-8 left-1/2 z-10 flex w-max max-w-[calc(100vw-2rem)] items-center gap-3.5 rounded-2xl bg-[var(--ink)] px-6 py-4 text-[var(--paper)] shadow-[0_18px_40px_-16px_rgb(13_19_28/0.55)]"
        >
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--p0)] opacity-70 motion-reduce:animate-none" />
            <span className="relative size-3 rounded-full bg-[var(--p0)]" />
          </span>
          <span className="font-reading text-[1.35rem] leading-snug italic sm:text-[1.6rem]">
            Start talking and watch Jev in action.
          </span>
        </div>
      )}
    </main>
  );
}

function Mark({
  text,
  reading,
  topics,
  pending,
}: {
  text: string;
  reading: TopicReading | null;
  topics: Topic[];
  pending?: boolean;
}) {
  const label = reading ? labelOf(topics, reading.topic) : null;
  return (
    <span
      className="mark"
      style={{ "--c": colorVar(topics, reading?.topic) } as CSSProperties}
      data-pending={pending || !reading ? "" : undefined}
      title={reading && label ? `${label}, ${pct(reading.probabilities[reading.topic] ?? 0)}` : undefined}
    >
      {text}
    </span>
  );
}

function NowPanel({
  topics,
  onTopics,
  current,
  meters,
  reading,
  calls,
}: {
  topics: Topic[];
  onTopics: (topics: Topic[]) => void;
  current: string | null;
  meters: Distribution;
  reading: TopicReading | null;
  calls: number;
}) {
  const ordered = [...topics, OTHER].sort((a, b) => (meters[b.id] ?? 0) - (meters[a.id] ?? 0));

  return (
    <div className="rounded-2xl bg-[var(--panel)] p-6">
      <p className="text-sm text-[var(--ink-soft)]">You&rsquo;re talking about</p>
      <p className="mt-1 font-reading text-[2.4rem] leading-tight italic" aria-live="polite">
        {current ? (
          <span className="mark" style={{ "--c": colorVar(topics, current) } as CSSProperties}>
            {labelOf(topics, current)}
          </span>
        ) : (
          <span className="text-[var(--ink-soft)]">nothing yet</span>
        )}
      </p>

      <ul className="mt-6 space-y-3">
        {ordered.map((topic) => {
          const value = meters[topic.id] ?? 0;
          return (
            <li key={topic.id} style={{ "--c": colorVar(topics, topic.id) } as CSSProperties} className="text-[0.95rem]">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`truncate ${topic.id === current ? "font-semibold" : ""}`}>{topic.label}</span>
                <span className="text-[var(--ink-soft)]">{pct(value)}</span>
              </div>
              <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[var(--rule)]/60">
                <span className="bar block h-full rounded-full" style={{ width: pct(value) }} />
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-4">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {reading ? (
            <>
              Jev answered in <span className="text-[var(--ink)]">{reading.ms} ms</span>. {calls}{" "}
              {calls === 1 ? "call" : "calls"} so far.
            </>
          ) : (
            "Jev hasn’t been called yet."
          )}
        </p>
        <TopicEditor topics={topics} onApply={onTopics} />
      </div>
    </div>
  );
}

function TypeInstead({ onType, onCommit }: { onType: (text: string) => void; onCommit: (text: string) => void }) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  return (
    <form
      className="mt-12 max-w-[40rem]"
      onSubmit={(e) => {
        e.preventDefault();
        onCommit(value);
        setValue("");
        input.current?.focus();
      }}
    >
      <label htmlFor="type-instead" className="text-sm text-[var(--ink-soft)]">
        No mic? Type a sentence and press Enter.
      </label>
      <input
        id="type-instead"
        ref={input}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          onType(e.target.value);
        }}
        placeholder="The central bank held rates steady this week"
        className="mt-2 h-12 w-full rounded-xl border border-[var(--rule)] bg-[var(--panel)] px-4 text-base placeholder:text-[var(--ink-soft)]/70"
      />
    </form>
  );
}

function labelOf(topics: Topic[], id: string) {
  return topics.find((t) => t.id === id)?.label ?? OTHER.label;
}

function listOf(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
