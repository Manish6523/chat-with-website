export interface Source {
  url: string;
  title: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
}
