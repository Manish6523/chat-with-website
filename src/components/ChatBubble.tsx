import type { ChatMessage } from "@/types/chat";

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
        }`}
      >
        {message.text}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <ul className="mt-2 border-t border-gray-200 pt-2 space-y-1">
            {message.sources.map((s, j) => (
              <li key={j} className="text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
