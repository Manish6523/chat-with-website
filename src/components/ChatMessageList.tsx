"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/chat";
import ChatBubble from "@/components/ChatBubble";
import Spinner from "@/components/Spinner";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isThinking: boolean;
}

export default function ChatMessageList({
  messages,
  isThinking,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[28rem] min-h-[12rem]">
      {messages.length === 0 && !isThinking && (
        <p className="text-sm text-gray-400 text-center pt-8">
          Ask a question about the indexed site.
        </p>
      )}

      {messages.map((msg, i) => (
        <ChatBubble key={i} message={msg} />
      ))}

      {/* Thinking indicator */}
      {isThinking && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
            <Spinner />
            Thinking…
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
