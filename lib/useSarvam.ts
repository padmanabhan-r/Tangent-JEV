"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "listening";
type Handlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string, language: string | null) => void;
  onError: (message: string) => void;
};

// Runs on the audio thread: downmixes to mono and hands 100 ms of 16-bit PCM to the page.
const WORKLET = `
class Pcm16 extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(1600); this.n = 0; }
  process(inputs) {
    const ch = inputs[0];
    if (!ch || !ch[0]) return true;
    const len = ch[0].length;
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < ch.length; c++) s += ch[c][i];
      s = Math.max(-1, Math.min(1, s / ch.length));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.buffer.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("pcm16", Pcm16);`;

/** Live speech-to-text through the /api/listen relay to Sarvam (saaras:v3-realtime), for Indian languages. */
export function useSarvam(handlers: Handlers) {
  const [status, setStatus] = useState<Status>("idle");
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  }, [handlers]);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const wanted = useRef(false);
  const language = useRef("auto");

  const teardown = useCallback(() => {
    wanted.current = false;
    ws.current?.close();
    ws.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close();
    ctx.current = null;
    setStatus("idle");
  }, []);

  const open = useCallback(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const sock = new WebSocket(`${proto}://${location.host}/api/listen?language=${encodeURIComponent(language.current)}`);
    sock.binaryType = "arraybuffer";
    ws.current = sock;
    let opened = false;
    sock.onopen = () => {
      opened = true;
    };
    sock.onmessage = (e) => {
      let msg: { event?: string; text?: string; language?: string; message?: string };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.event === "ready") setStatus("listening");
      else if (msg.event === "transcript.partial") h.current.onPartial(msg.text ?? "");
      else if (msg.event === "transcript.final") h.current.onFinal(msg.text ?? "", msg.language ?? null);
      else if (msg.event === "error") h.current.onError(msg.message ?? "Sarvam reported an error.");
    };
    sock.onclose = (e) => {
      if (ws.current !== sock) return;
      if (wanted.current && e.code === 4001) h.current.onError("Sarvam sessions stop after 3 minutes to save credits. Press Start talking to carry on.");
      else if (wanted.current && e.code !== 1000) h.current.onError(opened ? "The connection to Sarvam dropped. Press Start talking to carry on." : "Couldn't reach Sarvam. You may have used this hour's Sarvam sessions; ElevenLabs still works.");
      teardown();
    };
  }, [teardown]);

  const connect = useCallback(
    async (lang: string) => {
      language.current = lang;
      wanted.current = true;
      setStatus("connecting");
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        });
        const ac = new AudioContext({ sampleRate: 16000 });
        ctx.current = ac;
        await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
        const node = new AudioWorkletNode(ac, "pcm16");
        node.port.onmessage = (e) => {
          if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(e.data);
        };
        ac.createMediaStreamSource(stream.current).connect(node);
        open();
      } catch (err) {
        teardown();
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        h.current.onError(denied ? "Microphone access was blocked. Allow it in the browser and try again." : "Could not start the microphone.");
      }
    },
    [open, teardown],
  );

  useEffect(() => teardown, [teardown]);

  return { status, connect, disconnect: teardown };
}
