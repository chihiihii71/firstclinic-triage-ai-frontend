"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  HeartPulse,
  Activity,
  Thermometer,
  Wind,
  Stethoscope,
  Brain,
  ArrowLeft,
  Send,
  PlusCircle,
  Trash2,
  MessageSquareX,
} from "lucide-react";

const API_BASE_URL = "https://jaoooooo9-firstclinic-ai-triage-engine.hf.space";

const getTimestamp = () => {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

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

const initialMessages = [
  {
    sender: "bot",
    text: "Hello! I am FirstClinic AI, your personal health assistant. I can answer general health questions, or you can add your vital signs for a personalised risk assessment.",
    time: getTimestamp(),
  },
];

export default function Home() {
  const [currentView, setCurrentView] = useState("chat");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [vitalsActive, setVitalsActive] = useState(false);
  const [vitals, setVitals] = useState(defaultVitals);
  const [isOnline, setIsOnline] = useState(true);
  const messagesEndRef = useRef(null);

  // --- EFFECTS ---
  useEffect(() => {
    if (currentView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentView, isLoading]);

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

  // --- HANDLERS ---
  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  const clearVitals = () => {
    setVitalsActive(false);
    setVitals(defaultVitals);
    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text: "Vital signs cleared. Switched back to general consultation mode.",
        time: getTimestamp(),
      },
    ]);
  };

  const clearConversation = () => {
    setMessages(initialMessages);
    setVitalsActive(false);
    setVitals(defaultVitals);
  };

  // Build history for backend from current messages
  const buildHistory = () => {
    return messages
      .filter((m) => m.sender === "user" || m.sender === "bot")
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));
  };

  const sendMessage = async (e, isVitalsAnalysis = false) => {
    if (e) e.preventDefault();
    if (!isVitalsAnalysis && !input.trim()) return;

    if (!isOnline) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "You appear to be offline. Please check your internet connection and try again.",
          time: getTimestamp(),
          isError: true,
        },
      ]);
      return;
    }

    let userInput = input;
    let payloadVitals = null;

    const processedVitals = {
      ...vitals,
      Respiratory_Rate: Number(vitals.Respiratory_Rate) || 0,
      Oxygen_Saturation: Number(vitals.Oxygen_Saturation) || 0,
      Systolic_BP: Number(vitals.Systolic_BP) || 0,
      Heart_Rate: Number(vitals.Heart_Rate) || 0,
      Temperature: Number(vitals.Temperature) || 0,
      On_Oxygen: Number(vitals.On_Oxygen) || 0,
    };

    if (isVitalsAnalysis) {
      userInput = "Please analyse my vital signs and assess my health risk.";
      payloadVitals = processedVitals;
      setVitalsActive(true);
      setCurrentView("chat");
    } else {
      payloadVitals = vitalsActive ? processedVitals : null;
    }

    const history = buildHistory();
    const userMsg = { sender: "user", text: userInput, time: getTimestamp() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          vitals: payloadVitals,
          history: history,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.reply, time: getTimestamp() },
      ]);
    } catch (error) {
      console.error("Error:", error);
      let errorText =
        "I could not reach the server. Please wait a moment and try again.";
      if (error.message.includes("500")) {
        errorText =
          "The server encountered an error processing your request. Please try again.";
      } else if (error.message.includes("503")) {
        errorText =
          "The AI service is temporarily unavailable. Please try again in a few minutes.";
      }
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: errorText, time: getTimestamp(), isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- CHAT VIEW ---
  const renderChatView = () => (
    <>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-bold text-blue-400 flex items-center gap-2">
            🏥 FirstClinic AI
          </h1>
          <span
            className={`text-xs ${
              vitalsActive ? "text-green-400 animate-pulse" : "text-gray-400"
            }`}
          >
            {vitalsActive
              ? "● Personalised Mode — Vitals Active"
              : "● General Consultation Mode"}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {vitalsActive && (
            <button
              onClick={clearVitals}
              className="flex items-center gap-1 text-xs bg-red-900/30 text-red-300 px-3 py-2 rounded-lg hover:bg-red-900/50 border border-red-800/50 transition"
              title="Clear vital signs"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear Vitals</span>
            </button>
          )}
          <button
            onClick={clearConversation}
            className="flex items-center gap-1 text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-600 border border-gray-600 transition"
            title="Clear conversation"
          >
            <MessageSquareX size={13} />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
          <button
            onClick={() => setCurrentView("form")}
            className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg font-medium transition border bg-blue-600 border-blue-500 hover:bg-blue-500 text-white"
          >
            <PlusCircle size={14} />
            <span>Add Vitals</span>
          </button>
        </div>
      </div>

      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs flex-shrink-0">
          ⚠️ You are offline. Messages cannot be sent until your connection is restored.
        </div>
      )}

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto mb-4 p-3 sm:p-4 bg-gray-700/30 rounded-xl border border-gray-700 scrollbar-thin scrollbar-thumb-gray-600">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`p-3 max-w-[88%] sm:max-w-[80%] rounded-2xl shadow-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : msg.isError
                    ? "bg-red-900/40 text-red-200 rounded-bl-none border border-red-800/50"
                    : "bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
              {msg.time && (
                <span className="text-xs text-gray-500 mt-1 px-1">
                  {msg.time}
                </span>
              )}
            </div>
          ))}

          {/* TYPING INDICATOR */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="bg-gray-700/50 px-4 py-3 rounded-2xl rounded-bl-none border border-gray-600">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 mr-2">AI is thinking</span>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT AREA */}
      <form
        onSubmit={(e) => sendMessage(e, false)}
        className="flex gap-2 items-center flex-shrink-0"
      >
        <input
          type="text"
          className="flex-1 p-3 rounded-xl bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 transition text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            vitalsActive
              ? "Ask about your diagnosis, diet, or lifestyle..."
              : "Ask a health question..."
          }
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-blue-500 p-3 rounded-xl hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center justify-center min-w-[48px]"
          disabled={isLoading || !input.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </>
  );

  // --- FORM VIEW ---
  const renderFormView = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5 border-b border-gray-700 pb-4 flex-shrink-0">
        <button
          onClick={() => setCurrentView("chat")}
          className="p-2 hover:bg-gray-700 rounded-full transition text-gray-400 hover:text-white"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-blue-400">Update Vital Signs</h2>
          <p className="text-xs text-gray-400">
            Fill in your current readings for personalised risk assessment
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: <Activity size={13} />, label: "Systolic BP", name: "Systolic_BP", placeholder: "e.g. 120" },
            { icon: <HeartPulse size={13} />, label: "Heart Rate (bpm)", name: "Heart_Rate", placeholder: "e.g. 80" },
            { icon: <Thermometer size={13} />, label: "Temperature (°C)", name: "Temperature", placeholder: "e.g. 36.5" },
            { icon: <Wind size={13} />, label: "Oxygen Saturation (%)", name: "Oxygen_Saturation", placeholder: "e.g. 98" },
            { icon: <Wind size={13} />, label: "Respiratory Rate", name: "Respiratory_Rate", placeholder: "e.g. 18" },
          ].map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                {field.icon} {field.label}
              </label>
              <input
                type="number"
                name={field.name}
                value={vitals[field.name]}
                onChange={handleVitalChange}
                placeholder={field.placeholder}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition text-sm"
              />
            </div>
          ))}

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Stethoscope size={13} /> On Oxygen Support?
            </label>
            <select
              name="On_Oxygen"
              value={vitals.On_Oxygen}
              onChange={handleVitalChange}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 outline-none transition text-sm appearance-none"
            >
              <option value="">Select...</option>
              <option value="0">No</option>
              <option value="1">Yes</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Brain size={13} /> Level of Consciousness
            </label>
            <select
              name="Consciousness"
              value={vitals.Consciousness}
              onChange={handleVitalChange}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 outline-none transition text-sm appearance-none"
            >
              <option value="Alert">Alert</option>
              <option value="Pain">Response to Pain</option>
              <option value="Verbal">Response to Verbal</option>
              <option value="Unresponsive">Unresponsive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 pt-4 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={() => setCurrentView("chat")}
          className="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-gray-700 hover:bg-gray-600 transition text-sm"
        >
          Cancel
        </button>
        <button
          onClick={(e) => sendMessage(e, true)}
          className="flex-[2] py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg transition text-sm"
        >
          Submit & Analyse Risk
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-2 sm:p-4 font-sans">
      <div className="w-full max-w-3xl bg-gray-800 rounded-2xl shadow-2xl p-3 sm:p-6 flex flex-col h-[95vh] sm:h-[85vh] border border-gray-700">
        {currentView === "chat" ? renderChatView() : renderFormView()}
      </div>
      <p className="text-xs text-gray-600 mt-2">
        FirstClinic AI — For informational purposes only. Always consult a qualified healthcare professional.
      </p>
    </div>
  );
}
