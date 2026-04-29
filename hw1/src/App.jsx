import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  MessageSquare,
  Moon,
  Plus,
  Send,
  Sun,
  Trash2,
  User,
  PanelLeft,
  Copy,
  Check,
} from "lucide-react";

const CHAT_STORAGE_KEY = "hw1-own-chatgpt-chats";
const THEME_STORAGE_KEY = "hw1-own-chatgpt-theme";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createWelcomeChat() {
  return {
    id: createId(),
    title: "New Chat",
    createdAt: Date.now(),
    messages: [
      {
        id: createId(),
        role: "assistant",
        content:
          "Hello! I am your own ChatGPT demo. I am now connected to Groq API, so I can answer real questions in Chinese or English.",
        timestamp: Date.now(),
      },
    ],
  };
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTitleFromMessages(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "New Chat";
  return firstUserMessage.content.slice(0, 28) || "New Chat";
}

async function getAssistantReplyFromGroq(messages) {
  if (!GROQ_API_KEY) {
    return "Groq API key is missing. Please create a .env.local file and set VITE_GROQ_API_KEY.";
  }

  try {
    const apiMessages = [
      {
        role: "system",
        content:
          "You are an AI assistant powered by Groq API using a Llama model. Do NOT say you are ChatGPT. If asked, say you are a custom AI system built for a homework project. Answer clearly and naturally in Traditional Chinese or English depending on the user's language.",
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `Groq API error: ${response.status} ${errorText}`;
    }

    const data = await response.json();

    return data?.choices?.[0]?.message?.content || "The model returned an empty response.";
  } catch (error) {
    return `Request failed: ${error.message}`;
  }
}

function IconButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${
        props.className || ""
      }`}
    >
      {children}
    </button>
  );
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${className}`}
    >
      {children}
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Copy failed", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div className={`group max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-7 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
              : "rounded-2xl rounded-bl-md border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          }
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          <button
            onClick={handleCopy}
            className="opacity-0 transition group-hover:opacity-100"
            aria-label="Copy message"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {isUser && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
          <User className="h-5 w-5" />
        </div>
      )}
    </motion.div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState("light");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chats, setChats] = useState([createWelcomeChat()]);
  const [activeChatId, setActiveChatId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMounted(true);

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedChats = localStorage.getItem(CHAT_STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }

    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      } catch (error) {
        console.error("Failed to parse chats", error);
      }
    }

    const initialChat = createWelcomeChat();
    setChats([initialChat]);
    setActiveChatId(initialChat.id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
  }, [chats, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, mounted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId, isTyping]);

  const activeChat = useMemo(() => {
    return chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  }, [chats, activeChatId]);

  const createNewChat = () => {
    const newChat = createWelcomeChat();
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
  };

  const deleteChat = (chatId) => {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (filtered.length === 0) {
        const fallback = createWelcomeChat();
        setActiveChatId(fallback.id);
        return [fallback];
      }
      if (activeChatId === chatId) {
        setActiveChatId(filtered[0].id);
      }
      return filtered;
    });
  };

  const clearCurrentChat = () => {
    if (!activeChat) return;

    const resetMessages = [
      {
        id: createId(),
        role: "assistant",
        content: "This conversation has been cleared. Start a new question anytime.",
        timestamp: Date.now(),
      },
    ];

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: "New Chat",
              messages: resetMessages,
            }
          : chat
      )
    );
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !activeChat || isTyping) return;

    const userMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const updatedUserMessages = [...activeChat.messages, userMessage];

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title: getTitleFromMessages(updatedUserMessages),
              messages: updatedUserMessages,
            }
          : chat
      )
    );

    setInput("");
    setIsTyping(true);

    const assistantReply = await getAssistantReplyFromGroq(updatedUserMessages);

    const assistantMessage = {
      id: createId(),
      role: "assistant",
      content: assistantReply,
      timestamp: Date.now(),
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              messages: [...chat.messages, assistantMessage],
            }
          : chat
      )
    );

    setIsTyping(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (!mounted) {
    return <div className="p-6 text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex w-[290px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Button onClick={createNewChat} className="flex-1 justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  New Chat
                </Button>
                <IconButton onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </IconButton>
              </div>

              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <MessageSquare className="h-4 w-4" />
                  HW1 Demo Features
                </div>
                <div>• Multi-chat sidebar</div>
                <div>• Local storage</div>
                <div>• Dark / light mode</div>
                <div>• Responsive UI</div>
                <div>• Real Groq API replies</div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {chats.map((chat) => {
                  const active = chat.id === activeChatId;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`group w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{chat.title}</div>
                          <div
                            className={`mt-1 truncate text-xs ${
                              active ? "text-slate-200 dark:text-slate-700" : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {chat.messages[chat.messages.length - 1]?.content || "Empty conversation"}
                          </div>
                        </div>
                        <Trash2
                          className={`h-4 w-4 shrink-0 ${
                            active ? "text-white/80 dark:text-slate-700" : "text-slate-400"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteChat(chat.id);
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <IconButton onClick={() => setSidebarOpen((prev) => !prev)}>
                <PanelLeft className="h-5 w-5" />
              </IconButton>
              <div>
                <div className="text-sm font-semibold">HW1 — You Own ChatGPT</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Custom chat webpage demo</div>
              </div>
            </div>

            <OutlineButton onClick={clearCurrentChat} disabled={isTyping}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chat
            </OutlineButton>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
              {activeChat?.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-3xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-end gap-3">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message here..."
                    className="h-12 flex-1 rounded-2xl border-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-400"
                    disabled={isTyping}
                  />
                  <Button onClick={sendMessage} className="h-12 px-5" disabled={isTyping}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">
                  Powered by Groq API. Do not commit your .env.local file to GitHub.
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}