"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getAnonId } from "@/lib/anonymousId";
import {
  Plus, MessageSquare, Heart, Send,
  LogOut, Activity, Thermometer, Wind,
  Stethoscope, Brain, HeartPulse, X,
  AlertCircle, Menu, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  flagged?: boolean;
}

interface Chat {
  id: string;
  title: string;
  type: "general" | "signs";
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const defaultVitals = {
  Patient_ID: "Guest",
  Respiratory_Rate: "",
  Oxygen_Saturation: "",
  O2_Scale: 0,
  Systolic_BP: "",
  Heart_Rate: "",
  Temperature: "",
  Consciousness: "Alert",
  On_Oxygen: "",
};

const getTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Component ────────────────────────────────────────────────
export default function ChatPage() {
  const supabase = createClient();

  // Anonymous ID
  const [anonId, setAnonId] = useState<string>("");

  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Vitals state
  const [showVitalsPanel, setShowVitalsPanel] = useState(false);
  const [vitals, setVitals] = useState(defaultVitals);
  const [vitalsActive, setVitalsActive] = useState(false);
  const [vitalsBlinking, setVitalsBlinking] = useState(true);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userName = "there";

  // ─── Effects ────────────────────────────────────────────────
  useEffect(() => {
    const id = getAnonId();
    setAnonId(id);
    loadChats(id);
    const timer = setTimeout(() => setVitalsBlinking(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ─── Data functions ─────────────────────────────────────────
  const loadChats = async (id: string) => {
    const { data } = await supabase
      .from("chats")
      .select("*")
      .eq("anon_id", id)
      .order("created_at", { ascending: false });
    if (data) setChats(data);
  };

  const loadMessages = async (chatId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(
        data.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }))
      );
    }
  };

  const createNewChat = async (
    type: "general" | "signs" = "general"
  ): Promise<string | null> => {
    if (!anonId) return null;
    const { data } = await supabase
      .from("chats")
      .insert({
        anon_id: anonId,
        title: type === "signs" ? "Vital Signs Analysis" : "New Conversation",
        type,
      })
      .select()
      .single();

    if (data) {
      setChats((prev) => [data, ...prev]);
      setCurrentChatId(data.id);
      setMessages([]);
      setVitalsActive(type === "signs");
      return data.id;
    }
    return null;
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chats").delete().eq("id", chatId);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
      setVitalsActive(false);
    }
  };

  const saveMessage = async (
    chatId: string,
    role: string,
    content: string
  ) => {
    await supabase.from("messages").insert({ chat_id: chatId, role, content });
  };

  const updateChatTitle = async (chatId: string, title: string) => {
    await supabase.from("chats").update({ title }).eq("id", chatId);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title } : c))
    );
  };

  const clearAllHistory = () => {
    if (confirm("Clear all chat history? This cannot be undone.")) {
      supabase.from("chats").delete().eq("anon_id", anonId).then(() => {
        setChats([]);
        setCurrentChatId(null);
        setMessages([]);
        setVitalsActive(false);
      });
    }
  };

  // ─── Send message ────────────────────────────────────────────
  const sendMessage = async (
    e?: React.FormEvent,
    isVitalsAnalysis = false
  ) => {
    if (e) e.preventDefault();
    if (!isVitalsAnalysis && !input.trim()) return;
    if (!isOnline) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = await createNewChat(isVitalsAnalysis ? "signs" : "general");
      if (!chatId) return;
    }

    const userText = isVitalsAnalysis
      ? "Please analyse my vital signs and assess my health risk."
      : input;

    const processedVitals =
      vitalsActive || isVitalsAnalysis
        ? {
            ...vitals,
            Respiratory_Rate: Number(vitals.Respiratory_Rate) || 0,
            Oxygen_Saturation: Number(vitals.Oxygen_Saturation) || 0,
            Systolic_BP: Number(vitals.Systolic_BP) || 0,
            Heart_Rate: Number(vitals.Heart_Rate) || 0,
            Temperature: Number(vitals.Temperature) || 0,
            On_Oxygen: Number(vitals.On_Oxygen) || 0,
          }
        : null;

    const userMsg: Message = {
      role: "user",
      content: userText,
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (isVitalsAnalysis) {
      setShowVitalsPanel(false);
      setVitalsActive(true);
    }

    await saveMessage(chatId, "user", userText);
    if (messages.length === 0) {
      const title =
        userText.length > 45 ? userText.slice(0, 45) + "..." : userText;
      await updateChatTitle(chatId, title);
    }

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          vitals: processedVitals,
          history,
          user_name: userName,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: getTimestamp() },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const text = line.slice(6);
              if (text === "[DONE]") break;
              const restored = text.replace(/\\n/g, "\n");
              fullText += restored;

              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullText,
                  timestamp: getTimestamp(),
                };
                return updated;
              });
            }
          }
        }
      }

      await saveMessage(chatId, "assistant", fullText);
    } catch (error: any) {
      let errorText = "I could not reach the server. Please try again.";
      if (error?.message?.includes("500"))
        errorText = "The server encountered an error. Please try again.";
      if (error?.message?.includes("503"))
        errorText = "The AI service is temporarily unavailable. Please try again in a moment.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorText, timestamp: getTimestamp() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────
  const generalChats = chats.filter((c) => c.type === "general");
  const signsChats = chats.filter((c) => c.type === "signs");

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside
        className={`flex flex-col bg-[#f0efe9] border-r border-[#e5e4de] flex-shrink-0 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#e5e4de]">
          <Stethoscope size={20} className="text-teal-500" />
          <span className="font-semibold text-gray-800 text-sm">
            FirstClinic AI
          </span>
        </div>

        {/* New Chat */}
        <div className="p-3 border-b border-[#e5e4de]">
          <button
            onClick={() => {
              setCurrentChatId(null);
              setMessages([]);
              setVitalsActive(false);
              setVitals(defaultVitals);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-[#e5e4de] transition"
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">

          {/* General chats */}
          {generalChats.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                General
              </p>
              {generalChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    loadMessages(chat.id);
                    setVitalsActive(false);
                  }}
                  className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition mb-0.5 ${
                    currentChatId === chat.id
                      ? "bg-[#e2e0d9] text-gray-900"
                      : "text-gray-600 hover:bg-[#e8e7e1]"
                  }`}
                >
                  <MessageSquare size={13} className="flex-shrink-0 text-gray-400" />
                  <span className="truncate flex-1">{chat.title}</span>
                  <span
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition text-gray-400"
                  >
                    <Trash2 size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Signs chats */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Signs
              </p>
              <button
                onClick={() => {
                  createNewChat("signs");
                  setShowVitalsPanel(true);
                }}
                className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                  vitalsBlinking
                    ? "bg-teal-100 text-teal-600 animate-pulse"
                    : "text-teal-600 hover:bg-teal-50"
                }`}
              >
                <Plus size={10} />
                Add Vitals
              </button>
            </div>
            {signsChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setCurrentChatId(chat.id);
                  loadMessages(chat.id);
                  setVitalsActive(true);
                }}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition mb-0.5 ${
                  currentChatId === chat.id
                    ? "bg-[#e2e0d9] text-gray-900"
                    : "text-gray-600 hover:bg-[#e8e7e1]"
                }`}
              >
                <Heart size={13} className="flex-shrink-0 text-teal-400" />
                <span className="truncate flex-1">{chat.title}</span>
                <span
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition text-gray-400"
                >
                  <Trash2 size={12} />
                </span>
              </button>
            ))}
            {signsChats.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2">
                No vitals sessions yet
              </p>
            )}
          </div>
        </div>

        {/* Clear history */}
        <div className="p-3 border-t border-[#e5e4de]">
          <button
            onClick={clearAllHistory}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-[#e5e4de] transition"
          >
            <LogOut size={13} />
            Clear all history
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            {vitalsActive && (
              <span className="text-xs text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
                ● Vitals Active
              </span>
            )}
            <button
              onClick={() => setShowVitalsPanel(true)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition font-medium ${
                vitalsBlinking && !vitalsActive
                  ? "bg-teal-500 text-white animate-pulse shadow-sm"
                  : "bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-100"
              }`}
            >
              <Activity size={14} />
              Add Vitals
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Stethoscope size={48} className="text-teal-400 mb-4" />
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                How can I help you?
              </h2>
              <p className="text-gray-500 text-sm max-w-md leading-relaxed">
                I am FirstClinic AI, your personal health assistant. Ask me any
                health question, or tap{" "}
                <span className="text-teal-600 font-medium">Add Vitals</span>{" "}
                for a personalised risk assessment.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Stethoscope size={14} className="text-teal-500" />
                      <span className="text-xs font-medium text-gray-500">
                        FirstClinic AI
                      </span>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-tr-md"
                        : "text-gray-800"
                    }`}
                  >
                    {msg.flagged && (
                      <div className="flex items-center gap-1.5 text-amber-600 text-xs mb-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                        <AlertCircle size={12} />
                        Message flagged by safety filter
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>

                  <span className="text-xs text-gray-400 mt-1.5">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Stethoscope size={14} className="text-teal-500" />
                    <span className="text-xs font-medium text-gray-500">
                      FirstClinic AI
                    </span>
                  </div>
                  <div className="flex items-center gap-1 py-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:100ms]" />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:200ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 pb-5 pt-2 flex-shrink-0">
          {!isOnline && (
            <p className="text-xs text-red-400 text-center mb-2">
              You are offline — messages cannot be sent
            </p>
          )}
          <form
            onSubmit={(e) => sendMessage(e, false)}
            className="max-w-3xl mx-auto"
          >
            <div className="flex items-end gap-3 border border-gray-200 rounded-2xl px-4 py-3 bg-white shadow-sm focus-within:border-gray-300 focus-within:shadow-md transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) {
                      sendMessage(undefined, false);
                    }
                  }
                }}
                placeholder="Ask a health question..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent max-h-40"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              For informational purposes only — always consult a qualified healthcare professional.
            </p>
          </form>
        </div>
      </div>

      {/* ── VITALS PANEL ── */}
      {showVitalsPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/10"
            onClick={() => setShowVitalsPanel(false)}
          />
          <div className="w-96 bg-white shadow-2xl flex flex-col border-l border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-800">Vital Signs</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enter your current readings for risk assessment
                </p>
              </div>
              <button
                onClick={() => setShowVitalsPanel(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={17} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {[
                { icon: <Activity size={13} />, label: "Systolic BP (mmHg)", name: "Systolic_BP", placeholder: "e.g. 120" },
                { icon: <HeartPulse size={13} />, label: "Heart Rate (bpm)", name: "Heart_Rate", placeholder: "e.g. 80" },
                { icon: <Thermometer size={13} />, label: "Temperature (°C)", name: "Temperature", placeholder: "e.g. 36.5" },
                { icon: <Wind size={13} />, label: "Oxygen Saturation (%)", name: "Oxygen_Saturation", placeholder: "e.g. 98" },
                { icon: <Wind size={13} />, label: "Respiratory Rate", name: "Respiratory_Rate", placeholder: "e.g. 18" },
              ].map((field) => (
                <div key={field.name}>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                    {field.icon} {field.label}
                  </label>
                  <input
                    type="number"
                    name={field.name}
                    value={(vitals as any)[field.name]}
                    onChange={(e) =>
                      setVitals((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition"
                  />
                </div>
              ))}

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                  <Stethoscope size={13} /> On Oxygen Support?
                </label>
                <select
                  name="On_Oxygen"
                  value={vitals.On_Oxygen}
                  onChange={(e) =>
                    setVitals((prev) => ({ ...prev, On_Oxygen: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-teal-400 transition appearance-none bg-white"
                >
                  <option value="">Select...</option>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                  <Brain size={13} /> Level of Consciousness
                </label>
                <select
                  name="Consciousness"
                  value={vitals.Consciousness}
                  onChange={(e) =>
                    setVitals((prev) => ({
                      ...prev,
                      Consciousness: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-teal-400 transition appearance-none bg-white"
                >
                  <option value="Alert">Alert</option>
                  <option value="Pain">Response to Pain</option>
                  <option value="Verbal">Response to Verbal</option>
                  <option value="Unresponsive">Unresponsive</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowVitalsPanel(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => sendMessage(undefined, true)}
                className="flex-[2] py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition shadow-sm"
              >
                Analyse Risk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}