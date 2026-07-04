"use client";

import { useState } from "react";
import type { ChatMessage } from "@/types/chat";
import UrlIndexer from "@/components/UrlIndexer";
import ChatPanel from "@/components/ChatPanel";

//  Component 

export default function Home() {
  // URL indexing state
  const [urlInput, setUrlInput] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<{
    pagesIndexed: number;
    chunksCreated: number;
  } | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  //  Index handler 
  async function handleIndex() {
    if (!urlInput.trim()) return;

    setIsIndexing(true);
    setIndexResult(null);
    setIndexError(null);
    setMessages([]);

    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIndexError(data.error ?? "Indexing failed");
        return;
      }

      setIndexResult({
        pagesIndexed: data.pagesIndexed,
        chunksCreated: data.chunksCreated,
      });
    } catch (err) {
      setIndexError(String(err));
    } finally {
      setIsIndexing(false);
    }
  }

  //  Chat handler ─
  async function handleSend() {
    const q = questionInput.trim();
    if (!q || isThinking) return;

    setQuestionInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.error ?? "Something went wrong." },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${String(err)}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  //  Render
  const siteIndexed = indexResult !== null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-[family-name:var(--font-geist-sans)]">
      <div className="mx-auto max-w-2xl px-4 py-10 flex flex-col gap-6">

        {/*  Header ─ */}
        <h1 className="text-2xl font-bold text-center">
          Chat with a Website
        </h1>
        <p className="text-sm text-gray-500 text-center -mt-4">
          Paste a URL, index it, then ask questions about its content.
        </p>

        {/*  URL Input */}
        <UrlIndexer
          urlInput={urlInput}
          onUrlChange={setUrlInput}
          onIndex={handleIndex}
          isIndexing={isIndexing}
          indexResult={indexResult}
          indexError={indexError}
        />

        {/*  Chat ui ─ */}
        {siteIndexed && (
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            questionInput={questionInput}
            onQuestionChange={setQuestionInput}
            onSend={handleSend}
          />
        )}
      </div>
    </div>
  );
}
