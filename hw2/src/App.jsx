import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Brain,
  Calculator,
  Check,
  Clock,
  Copy,
  ImagePlus,
  MessageSquare,
  Moon,
  Plus,
  Route,
  Send,
  Sun,
  Trash2,
  User,
  PanelLeft,
  X,
} from "lucide-react";

const CHAT_STORAGE_KEY = "hw2-powerful-chatbot-chats";
const THEME_STORAGE_KEY = "hw2-powerful-chatbot-theme";
const MEMORY_STORAGE_KEY = "hw2-powerful-chatbot-memory";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODELS = {
  general: "llama-3.3-70b-versatile",
  reasoning: "openai/gpt-oss-120b",
  fast: "llama-3.1-8b-instant",
};

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
          "Hello! This is HW2 - My Very Powerful Chatbot. I support Groq API, long-term memory, image upload, model routing, and simple tools.",
        timestamp: Date.now(),
        meta: {
          feature: "system",
        },
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

function routeModel(userInput) {
  const text = userInput.toLowerCase();

  if (
    text.includes("code") ||
    text.includes("程式") ||
    text.includes("debug") ||
    text.includes("演算法") ||
    text.includes("algorithm") ||
    text.includes("reason") ||
    text.includes("推理")
  ) {
    return {
      model: MODELS.reasoning,
      route: "Reasoning / Coding Model",
      reason: "The message looks like a coding or reasoning task.",
    };
  }

  if (
    text.length < 30 ||
    text.includes("hi") ||
    text.includes("hello") ||
    text.includes("你好") ||
    text.includes("嗨")
  ) {
    return {
      model: MODELS.fast,
      route: "Fast Chat Model",
      reason: "The message is short or conversational.",
    };
  }

  return {
    model: MODELS.general,
    route: "General Model",
    reason: "The message is a general natural language task.",
  };
}

function isCalculationRequest(text) {
  const trimmed = text.trim();

  if (trimmed.includes("幾點") || trimmed.includes("現在時間")) return false;
  if (/[a-zA-Z\u4e00-\u9fff]/.test(trimmed)) {
    const mathKeywords = ["calculate", "calculator", "計算", "算", "等於"];
    const hasKeyword = mathKeywords.some((keyword) =>
      trimmed.toLowerCase().includes(keyword)
    );
    if (!hasKeyword) return false;
  }

  const expression = trimmed
    .replace(/calculate/gi, "")
    .replace(/calculator/gi, "")
    .replace(/計算/g, "")
    .replace(/請/g, "")
    .replace(/幫我/g, "")
    .replace(/算/g, "")
    .replace(/等於/g, "")
    .replace(/多少/g, "")
    .trim();

  return /^[0-9+\-*/().\s%^]+$/.test(expression) && /[+\-*/%^]/.test(expression);
}

function safeCalculate(text) {
  const expression = text
    .replace(/calculate/gi, "")
    .replace(/calculator/gi, "")
    .replace(/計算/g, "")
    .replace(/請/g, "")
    .replace(/幫我/g, "")
    .replace(/算/g, "")
    .replace(/等於/g, "")
    .replace(/多少/g, "")
    .replace(/\^/g, "**")
    .trim();

  if (!/^[0-9+\-*/().\s%*]+$/.test(expression)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return {
      expression,
      result,
    };
  } catch {
    return null;
  }
}

function isTimeRequest(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes("time") ||
    lower.includes("date") ||
    lower.includes("幾點") ||
    lower.includes("日期") ||
    lower.includes("今天") ||
    lower.includes("現在時間")
  );
}

function getTimeToolResult() {
  const now = new Date();
  return now.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function extractMemoryFromText(text) {
  const memoryItems = [];

  const chineseNameMatch = text.match(/我(?:叫|是)\s*([^\s，。,.!?]+)/);
  if (chineseNameMatch?.[1]) {
    memoryItems.push({
      key: "name",
      value: chineseNameMatch[1],
      text: `User's name is ${chineseNameMatch[1]}.`,
    });
  }

  const englishNameMatch = text.match(/my name is\s+([a-zA-Z\s]+)/i);
  if (englishNameMatch?.[1]) {
    const name = englishNameMatch[1].trim();
    memoryItems.push({
      key: "name",
      value: name,
      text: `User's name is ${name}.`,
    });
  }

  const rememberMatch = text.match(/(?:記住|remember that)\s*(.+)/i);
  if (rememberMatch?.[1]) {
    memoryItems.push({
      key: `note-${Date.now()}`,
      value: rememberMatch[1].trim(),
      text: rememberMatch[1].trim(),
    });
  }

  return memoryItems;
}

function mergeMemory(oldMemory, newItems) {
  const updated = [...oldMemory];

  for (const item of newItems) {
    if (item.key === "name") {
      const index = updated.findIndex((memory) => memory.key === "name");
      if (index >= 0) updated[index] = item;
      else updated.push(item);
    } else {
      updated.push(item);
    }
  }

  return updated;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getAssistantReplyFromGroq(messages, memory, routingInfo) {
  if (!GROQ_API_KEY) {
    return {
      content:
        "Groq API key is missing. Please create a .env.local file and set VITE_GROQ_API_KEY.",
      modelUsed: "none",
    };
  }

  const memoryText =
    memory.length > 0
      ? memory.map((item, index) => `${index + 1}. ${item.text}`).join("\n")
      : "No long-term memory has been stored yet.";

  const apiMessages = [
    {
      role: "system",
      content: `
You are a custom AI assistant built for a homework project called "HW2 - My Very Powerful Chatbot".
You are powered by Groq API.
Do NOT say you are ChatGPT.
Answer in Traditional Chinese if the user uses Chinese.
Answer in English if the user uses English.

Long-term memory:
${memoryText}

You also support:
1. Long-term memory
2. Multimodal image upload display
3. Auto routing between models
4. Tool use such as calculator and time tool

If the user asks what features you have, explain those features briefly.
      `.trim(),
    },
    ...messages.map((message) => ({
      role: message.role,
      content:
        message.images?.length > 0
          ? `${message.content}\n\n[User uploaded ${message.images.length} image(s). The frontend can display them, but this text-only API request does not analyze image pixels.]`
          : message.content,
    })),
  ];

  const tryRequest = async (model) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "The model returned an empty response.";
  };

  try {
    const content = await tryRequest(routingInfo.model);
    return {
      content,
      modelUsed: routingInfo.model,
    };
  } catch (error) {
    try {
      const fallbackContent = await tryRequest(MODELS.general);
      return {
        content: `${fallbackContent}\n\n[Fallback model used because the routed model was unavailable.]`,
        modelUsed: MODELS.general,
      };
    } catch (fallbackError) {
      return {
        content: `Groq API error: ${fallbackError.message}`,
        modelUsed: "error",
      };
    }
  }
}

function IconButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${className}`}
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

      <div className="max-w-[85%]">
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-7 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
              : "rounded-2xl rounded-bl-md border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          }
        >
          {message.images?.length > 0 && (
            <div className="mb-3 grid gap-2">
              {message.images.map((image) => (
                <div key={image.dataUrl} className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-600">
                  <img src={image.dataUrl} alt={image.name} className="max-h-64 w-full object-contain bg-white" />
                  <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                    {image.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="whitespace-pre-wrap">{message.content}</div>

          {message.meta && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {message.meta.route && (
                <div>
                  <Route className="mr-1 inline h-3.5 w-3.5" />
                  Route: {message.meta.route}
                </div>
              )}
              {message.meta.model && <div>Model: {message.meta.model}</div>}
              {message.meta.tool && <div>Tool: {message.meta.tool}</div>}
              {message.meta.memory && <div>Memory: {message.meta.memory}</div>}
            </div>
          )}
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>{formatTime(message.timestamp)}</span>
          <button onClick={handleCopy} aria-label="Copy message" title="Copy">
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
  const [pendingImages, setPendingImages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chats, setChats] = useState([createWelcomeChat()]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [memory, setMemory] = useState([]);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedChats = localStorage.getItem(CHAT_STORAGE_KEY);
    const savedMemory = localStorage.getItem(MEMORY_STORAGE_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }

    if (savedMemory) {
      try {
        const parsedMemory = JSON.parse(savedMemory);
        if (Array.isArray(parsedMemory)) setMemory(parsedMemory);
      } catch {
        setMemory([]);
      }
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
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
  }, [memory, mounted]);

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
    setPendingImages([]);
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

  const clearMemory = () => {
    setMemory([]);
  };

  const handleImageChange = async (event) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    const images = await Promise.all(imageFiles.map(fileToDataUrl));
    setPendingImages((prev) => [...prev, ...images]);

    event.target.value = "";
  };

  const removePendingImage = (dataUrl) => {
    setPendingImages((prev) => prev.filter((image) => image.dataUrl !== dataUrl));
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || !activeChat || isTyping) return;

    const extractedMemory = extractMemoryFromText(trimmed);
    const newMemory = extractedMemory.length > 0 ? mergeMemory(memory, extractedMemory) : memory;

    if (extractedMemory.length > 0) {
      setMemory(newMemory);
    }

    const userMessage = {
      id: createId(),
      role: "user",
      content: trimmed || "[Image uploaded]",
      images: pendingImages,
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
    setPendingImages([]);
    setIsTyping(true);

    let assistantMessage;

    if (isTimeRequest(trimmed)) {
      const timeText = getTimeToolResult();
      assistantMessage = {
        id: createId(),
        role: "assistant",
        content: `現在時間是：${timeText}`,
        timestamp: Date.now(),
        meta: {
          tool: "Current Time Tool",
        },
      };
    } else if (isCalculationRequest(trimmed)) {
      const calculation = safeCalculate(trimmed);

      assistantMessage = {
        id: createId(),
        role: "assistant",
        content: calculation
          ? `計算結果：${calculation.expression} = ${calculation.result}`
          : "我偵測到你想計算，但這個算式格式不安全或無法解析。",
        timestamp: Date.now(),
        meta: {
          tool: "Calculator Tool",
        },
      };
    } else {
      const routingInfo = routeModel(trimmed);
      const reply = await getAssistantReplyFromGroq(updatedUserMessages, newMemory, routingInfo);

      assistantMessage = {
        id: createId(),
        role: "assistant",
        content: reply.content,
        timestamp: Date.now(),
        meta: {
          route: routingInfo.route,
          model: reply.modelUsed,
          memory:
            extractedMemory.length > 0
              ? `Saved ${extractedMemory.length} new memory item(s).`
              : undefined,
        },
      };
    }

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
              className="flex w-[310px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
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
                  HW2 Demo Features
                </div>
                <div>• Long-term memory</div>
                <div>• Multimodal image upload</div>
                <div>• Auto model routing</div>
                <div>• Calculator / time tools</div>
                <div>• Groq API replies</div>
              </div>

              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <Brain className="h-4 w-4" />
                  Long-term Memory
                </div>
                {memory.length === 0 ? (
                  <div>No memory yet.</div>
                ) : (
                  <div className="space-y-1">
                    {memory.slice(0, 4).map((item) => (
                      <div key={item.key} className="truncate">
                        • {item.text}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={clearMemory}
                  className="mt-2 text-xs font-semibold text-red-500 hover:underline"
                >
                  Clear memory
                </button>
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
                <div className="text-sm font-semibold">HW2 — My Very Powerful Chatbot</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Memory • Multimodal • Routing • Tools • Groq API
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <OutlineButton onClick={clearCurrentChat} disabled={isTyping}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Chat
              </OutlineButton>
            </div>
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
              {pendingImages.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingImages.map((image) => (
                    <div
                      key={image.dataUrl}
                      className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700"
                    >
                      <img src={image.dataUrl} alt={image.name} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removePendingImage(image.dataUrl)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-3xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-end gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />

                  <IconButton onClick={() => fileInputRef.current?.click()} disabled={isTyping}>
                    <ImagePlus className="h-4 w-4" />
                  </IconButton>

                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything, upload an image, calculate , or say somrthing to save memory"
                    className="h-12 flex-1 rounded-2xl border-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-400"
                    disabled={isTyping}
                  />

                  <Button onClick={sendMessage} className="h-12 px-5" disabled={isTyping}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Brain className="h-3.5 w-3.5" /> Memory
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ImagePlus className="h-3.5 w-3.5" /> Image upload
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3.5 w-3.5" /> Model routing
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calculator className="h-3.5 w-3.5" /> Calculator
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Time tool
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}