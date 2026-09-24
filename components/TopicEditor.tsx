"use client";

import { useRef, useState } from "react";
import {
  MAX_DESCRIPTION,
  MAX_LABEL,
  MAX_TOPICS,
  PRESETS,
  withIds,
  type Topic,
} from "@/lib/topics";

type Draft = { key: number; label: string; description: string };

let nextKey = 1;
const toDrafts = (topics: Omit<Topic, "id">[]): Draft[] =>
  topics.map((t) => ({ key: nextKey++, label: t.label, description: t.description }));

export function TopicEditor({ topics, onApply }: { topics: Topic[]; onApply: (topics: Topic[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(topics));

  const named = drafts.filter((d) => d.label.trim());
  const canApply = named.length >= 2;

  const open = () => {
    setDrafts(toDrafts(topics));
    dialog.current?.showModal();
  };

  const update = (key: number, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <>
      <button
        onClick={open}
        className="shrink-0 whitespace-nowrap text-sm font-medium text-[var(--ink)] underline decoration-[var(--rule)] decoration-2 underline-offset-4 hover:decoration-[var(--ink)]"
      >
        Edit topics
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="topics-title"
        className="topics m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl bg-[var(--panel)] p-0 text-[var(--ink)] shadow-[0_24px_60px_-20px_rgb(13_19_28/0.45)]"
      >
        <form
          method="dialog"
          className="p-6 sm:p-8"
          onSubmit={(e) => {
            if (!canApply) {
              e.preventDefault();
              return;
            }
            onApply(withIds(named.map((d) => ({ label: d.label.trim(), description: d.description.trim() }))));
          }}
        >
          <h2 id="topics-title" className="font-reading text-[2rem] leading-tight italic">
            Your topics
          </h2>
          <p className="mt-2 text-[0.95rem] leading-snug text-[var(--ink-soft)]">
            Name up to {MAX_TOPICS} topics you&rsquo;ll talk about. A few words of description help Jev tell
            them apart. Anything off-topic goes to Other.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--ink-soft)]">Start from</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setDrafts(toDrafts(p.topics))}
                className="rounded-full border border-[var(--rule)] px-3 py-1 hover:border-[var(--ink-soft)]"
              >
                {p.name}
              </button>
            ))}
          </div>

          <ul className="mt-6 space-y-3">
            {drafts.map((d, i) => (
              <li key={d.key} className="flex items-start gap-3">
                <span className="mt-4 size-3 shrink-0 rounded-full" style={{ background: `var(--p${i})` }} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    aria-label={`Topic ${i + 1} name`}
                    value={d.label}
                    maxLength={MAX_LABEL}
                    placeholder="Topic name"
                    onChange={(e) => update(d.key, { label: e.target.value })}
                    className="h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 sm:w-44 sm:shrink-0"
                  />
                  <input
                    aria-label={`Topic ${i + 1} description`}
                    value={d.description}
                    maxLength={MAX_DESCRIPTION}
                    placeholder="What counts, like goals, transfers, referees"
                    onChange={(e) => update(d.key, { description: e.target.value })}
                    className="h-11 w-full min-w-0 flex-1 rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 text-[0.95rem]"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${d.label || `topic ${i + 1}`}`}
                  disabled={drafts.length <= 2}
                  onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-xl text-[var(--ink-soft)] hover:bg-[var(--paper)] disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={drafts.length >= MAX_TOPICS}
            onClick={() => setDrafts((list) => [...list, ...toDrafts([{ label: "", description: "" }])])}
            className="mt-4 text-sm font-medium underline decoration-[var(--rule)] decoration-2 underline-offset-4 disabled:no-underline disabled:opacity-40"
          >
            {drafts.length >= MAX_TOPICS ? `${MAX_TOPICS} topics is the limit` : "Add a topic"}
          </button>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--rule)] pt-5">
            <p className="mr-auto text-sm text-[var(--ink-soft)]">
              {canApply ? "Using new topics starts a fresh transcript." : "Name at least 2 topics."}
            </p>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-11 rounded-full px-4 text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canApply}
              className="h-11 rounded-full bg-[var(--ink)] px-5 font-medium text-[var(--paper)] disabled:opacity-40"
            >
              Use these topics
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
