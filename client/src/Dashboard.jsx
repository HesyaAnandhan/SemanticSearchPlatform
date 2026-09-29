import { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import "./Dashboard.css";

const API_BASE = "http://localhost:5000";

// Multilingual Confirmation Phrases for Voice Actions
const voiceConfirmations = {
  en: {
    dashboard: "Navigating to Dashboard",
    domains: "Opening Knowledge Domains",
    search: "Opening Semantic Search",
    resources: "Opening All Resources",
    settings: "Opening Settings",
    help: "Opening Help Dashboard",
    createDomain: "Opening Create Domain modal",
    searching: (q) => `Searching for ${q}`,
    logout: "Logging out of platform",
    error: "Voice command not recognized",
  },
  es: {
    dashboard: "Navegando al panel de control",
    domains: "Abriendo dominios de conocimiento",
    search: "Abriendo búsqueda semántica",
    resources: "Abriendo todos los recursos",
    settings: "Abriendo configuraciones",
    help: "Abriendo el panel de ayuda",
    createDomain: "Abriendo modal para crear dominio",
    searching: (q) => `Buscando ${q}`,
    logout: "Cerrando sesión",
    error: "Comando de voz no reconocido",
  },
  fr: {
    dashboard: "Navigation vers le tableau de bord",
    domains: "Ouverture des domaines de connaissances",
    search: "Ouverture de la recherche sémantique",
    resources: "Affichage de toutes les ressources",
    settings: "Ouverture des paramètres",
    help: "Ouverture du guide d'aide",
    createDomain: "Création d'un nouveau domaine",
    searching: (q) => `Recherche de ${q}`,
    logout: "Déconnexion en cours",
    error: "Commande vocale non reconnue",
  },
  de: {
    dashboard: "Navigiere zum Dashboard",
    domains: "Öffne Wissensbereiche",
    search: "Öffne semantische Suche",
    resources: "Öffne alle Ressourcen",
    settings: "Öffne Einstellungen",
    help: "Öffne Hilfe-Bereich",
    createDomain: "Erstelle neuen Wissensbereich",
    searching: (q) => `Suche nach ${q}`,
    logout: "Abmeldung",
    error: "Sprachbefehl nicht erkannt",
  },
  hi: {
    dashboard: "डैशबोर्ड पर जा रहे हैं",
    domains: "ज्ञान डोमेन खोल रहे हैं",
    search: "सिमेंटिक खोज खोल रहे हैं",
    resources: "सभी संसाधन खोल रहे हैं",
    settings: "सेटिंग्स खोल रहे हैं",
    help: "सहायता डैशबोर्ड खोल रहे हैं",
    createDomain: "नया डोमेन बनाने का विकल्प खोल रहे हैं",
    searching: (q) => `${q} की खोज कर रहे हैं`,
    logout: "लॉगआउट हो रहा है",
    error: "वॉइस कमांड समझ नहीं आया",
  },
  zh: {
    dashboard: "正在导航至仪表板",
    domains: "正在打开知识领域",
    search: "正在打开语义搜索",
    resources: "正在打开所有资源",
    settings: "正在打开设置",
    help: "正在打开帮助文档",
    createDomain: "打开创建领域窗口",
    searching: (q) => `正在搜索 ${q}`,
    logout: "正在退出登录",
    error: "未识别语音指令",
  },
  ja: {
    dashboard: "ダッシュボードを開きます",
    domains: "ナレッジドメインを開きます",
    search: "セマンティック検索を開きます",
    resources: "すべてのリソースを表示します",
    settings: "設定を開きます",
    help: "ヘルプダッシュボードを開きます",
    createDomain: "ドメイン作成を開きます",
    searching: (q) => `${q} を検索しています`,
    logout: "ログアウトします",
    error: "音声コマンドを認識できませんでした",
  },
  ta: {
    dashboard: "முகப்புப் பக்கத்திற்குச் செல்கிறது",
    domains: "அறிவு டொமைன்களைத் திறக்கிறது",
    search: "சொற்பொருள் தேடலைத் திறக்கிறது",
    resources: "அனைத்து வளங்களையும் காட்டுகிறது",
    settings: "அமைப்புகளைத் திறக்கிறது",
    help: "உதவி மையத்தைத் திறக்கிறது",
    createDomain: "புதிய டொமைன் படிவத்தைத் திறக்கிறது",
    searching: (q) => `${q} தேடப்படுகிறது`,
    logout: "வெளியேறுகிறது",
    error: "குரல் கட்டளை அடையாளம் காணப்படவில்லை",
  },
};

function Dashboard() {
  const getAuthConfig = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  // Navigation & View State
  const [currentTab, setCurrentTab] = useState("dashboard"); // "dashboard" | "domains" | "search" | "resources" | "settings" | "help" | "knowledge-gaps"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);
  const [loadingGaps, setLoadingGaps] = useState(false);

  const fetchKnowledgeGaps = async () => {
    try {
      setLoadingGaps(true);
      const response = await axios.get(
        `${API_BASE}/api/search/knowledge-gaps`,
        getAuthConfig(),
      );
      setKnowledgeGaps(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingGaps(false);
    }
  };

  const handleFeedback = async (query, feedbackValue) => {
    try {
      await axios.post(
        `${API_BASE}/api/search/feedback`,
        { query, feedback: feedbackValue },
        getAuthConfig(),
      );
      showToast("Feedback submitted. Thank you!", "success");
    } catch (error) {
      showToast("Failed to submit feedback", "error");
    }
  };

  // ==========================================
  // MULTILINGUAL VOICE CONTROL SYSTEM STATE
  // ==========================================
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-US"); // "en-US" | "es-ES" | "fr-FR" | "de-DE" | "hi-IN" | "zh-CN" | "ja-JP" | "ta-IN"
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Click mic to speak");
  const [voiceSpeechEnabled, setVoiceSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const voiceFileInputRef = useRef(null);

  // ==========================================
  // MOVABLE VOICE HUD (DRAGGABLE STATE)
  // ==========================================
  const [hudPosition, setHudPosition] = useState(() => {
    try {
      const saved = localStorage.getItem("voice_hud_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, window.innerWidth - 300);
          const maxY = Math.max(10, window.innerHeight - 80);
          return {
            x: Math.min(Math.max(10, parsed.x), maxX),
            y: Math.min(Math.max(10, parsed.y), maxY),
          };
        }
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [isDraggingHud, setIsDraggingHud] = useState(false);
  const dragStartRef = useRef(null);
  const hudRef = useRef(null);

  const handleHudPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Don't initiate drag if clicking interactive elements
    if (e.target.closest("button") || e.target.closest("select")) return;

    const hudEl = hudRef.current;
    if (!hudEl) return;

    const rect = hudEl.getBoundingClientRect();
    const currentX = hudPosition ? hudPosition.x : rect.left;
    const currentY = hudPosition ? hudPosition.y : rect.top;

    dragStartRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      elStartX: currentX,
      elStartY: currentY,
      width: rect.width,
      height: rect.height,
    };

    setIsDraggingHud(true);
  };

  useEffect(() => {
    if (!isDraggingHud) return;

    const handlePointerMove = (e) => {
      if (!dragStartRef.current) return;
      const {
        pointerStartX,
        pointerStartY,
        elStartX,
        elStartY,
        width,
        height,
      } = dragStartRef.current;
      const deltaX = e.clientX - pointerStartX;
      const deltaY = e.clientY - pointerStartY;

      const maxX = Math.max(10, window.innerWidth - width - 10);
      const maxY = Math.max(10, window.innerHeight - height - 10);

      const newX = Math.min(Math.max(10, elStartX + deltaX), maxX);
      const newY = Math.min(Math.max(10, elStartY + deltaY), maxY);

      setHudPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDraggingHud(false);
      if (hudRef.current) {
        const rect = hudRef.current.getBoundingClientRect();
        try {
          localStorage.setItem(
            "voice_hud_pos",
            JSON.stringify({ x: rect.left, y: rect.top }),
          );
        } catch {
          // ignore
        }
      }
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDraggingHud]);

  // ==========================================
  // AI ASSISTANT CHAT & RAG ENGINE STATE
  // ==========================================
  const formatChatDateTime = (dateInput = new Date()) => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[d.getMonth()];
    const fullMonthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const fullMonth = fullMonthNames[d.getMonth()];
    const day = String(d.getDate()).padStart(2, "0");

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const strHours = String(hours).padStart(2, "0");

    return {
      date: `${day} ${month} ${year}`,
      fullDate: `${day} ${fullMonth} ${year}`,
      time: `${strHours}:${minutes} ${ampm}`,
      timeWithSeconds: `${strHours}:${minutes}:${seconds} ${ampm}`,
      year: `${year}`,
      display: `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`,
      fullDisplay: `${day} ${fullMonth} ${year} at ${strHours}:${minutes}:${seconds} ${ampm}`,
      iso: d.toISOString(),
    };
  };

  const createInitialMessage = () => {
    const dt = formatChatDateTime();
    return {
      id: 1,
      role: "assistant",
      content:
        "Hello! I am your conversational AI Assistant. I can help clear any doubts about using this platform, troubleshoot errors (such as PDF uploads, 401 tokens, or mic permissions), or explain concepts. How can I help you today?",
      timestamp: dt.iso,
      dateTimeDisplay: dt.display,
      fullDateTime: dt.fullDisplay,
      dateString: dt.fullDate,
      timeString: dt.time,
      year: dt.year,
      sources: [],
      suggestions: [
        "How do I create a domain by voice?",
        "Troubleshoot PDF upload error",
        "Explain cosine similarity",
        "What domains do I have?",
      ],
    };
  };

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(
    () => `session_${Date.now()}`,
  );
  const [chatHistoryList, setChatHistoryList] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_chat_history_sessions");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [showChatHistoryView, setShowChatHistoryView] = useState(false);
  const [loadingChatHistory, setLoadingChatHistory] = useState(false);

  const [aiMessages, setAiMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_active_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [createInitialMessage()];
  });

  // ==========================================
  // MOVABLE AI ASSISTANT PANEL (DRAGGABLE STATE)
  // ==========================================
  const [aiPanelPosition, setAiPanelPosition] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_panel_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, window.innerWidth - 440);
          const maxY = Math.max(10, window.innerHeight - 150);
          return {
            x: Math.min(Math.max(10, parsed.x), maxX),
            y: Math.min(Math.max(10, parsed.y), maxY),
          };
        }
      }
    } catch {}
    return null;
  });

  const [isDraggingAiPanel, setIsDraggingAiPanel] = useState(false);
  const aiPanelDragStartRef = useRef(null);
  const aiPanelRef = useRef(null);
  const [isAiMinimized, setIsAiMinimized] = useState(false);

  const handleAiPanelPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("select")
    )
      return;

    const panelEl = aiPanelRef.current;
    if (!panelEl) return;

    const rect = panelEl.getBoundingClientRect();
    const currentX = aiPanelPosition ? aiPanelPosition.x : rect.left;
    const currentY = aiPanelPosition ? aiPanelPosition.y : rect.top;

    aiPanelDragStartRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      elStartX: currentX,
      elStartY: currentY,
      width: rect.width,
      height: rect.height,
    };

    setIsDraggingAiPanel(true);
  };

  useEffect(() => {
    if (!isDraggingAiPanel) return;

    const handlePointerMove = (e) => {
      if (!aiPanelDragStartRef.current) return;
      const {
        pointerStartX,
        pointerStartY,
        elStartX,
        elStartY,
        width,
        height,
      } = aiPanelDragStartRef.current;
      const deltaX = e.clientX - pointerStartX;
      const deltaY = e.clientY - pointerStartY;

      const newX = elStartX + deltaX;
      const newY = elStartY + deltaY;

      const maxX = Math.max(10, window.innerWidth - width - 10);
      const maxY = Math.max(10, window.innerHeight - height - 10);

      const clampedX = Math.min(Math.max(10, newX), maxX);
      const clampedY = Math.min(Math.max(10, newY), maxY);

      setAiPanelPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDraggingAiPanel(false);
      if (aiPanelRef.current) {
        const rect = aiPanelRef.current.getBoundingClientRect();
        try {
          localStorage.setItem(
            "ai_panel_pos",
            JSON.stringify({ x: rect.left, y: rect.top }),
          );
        } catch {}
      }
      aiPanelDragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDraggingAiPanel]);

  // Save and retrieve chat sessions with explicit date, time, year
  const saveSessionToHistory = async (sessionId, msgs, title = null) => {
    if (!msgs || msgs.length === 0) return;
    const dt = formatChatDateTime();
    const firstUserMsg = msgs.find((m) => m.role === "user");
    const sessionTitle =
      title ||
      (firstUserMsg
        ? firstUserMsg.content.slice(0, 48)
        : "AI Assistant Discussion");

    const sessionObj = {
      sessionId,
      title: sessionTitle,
      dateFormatted: dt.fullDate,
      timeFormatted: dt.time,
      year: dt.year,
      display: dt.display,
      messages: msgs,
      updatedAt: new Date().toISOString(),
    };

    setChatHistoryList((prev) => {
      const filtered = prev.filter((s) => s.sessionId !== sessionId);
      const updated = [sessionObj, ...filtered];
      try {
        localStorage.setItem(
          "ai_chat_history_sessions",
          JSON.stringify(updated),
        );
      } catch {}
      return updated;
    });

    try {
      localStorage.setItem("ai_active_messages", JSON.stringify(msgs));
      await axios.post(
        `${API_BASE}/api/assistant/history/save`,
        {
          sessionId,
          title: sessionTitle,
          messages: msgs,
        },
        getAuthConfig(),
      );
    } catch (err) {
      console.warn("MongoDB chat history save:", err.message);
    }
  };

  const fetchChatHistory = async () => {
    try {
      setLoadingChatHistory(true);
      const response = await axios.get(
        `${API_BASE}/api/assistant/history`,
        getAuthConfig(),
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        setChatHistoryList(response.data);
        try {
          localStorage.setItem(
            "ai_chat_history_sessions",
            JSON.stringify(response.data),
          );
        } catch {}
      }
    } catch {
      // fallback to local storage
    } finally {
      setLoadingChatHistory(false);
    }
  };

  const handleStartNewChat = () => {
    if (aiMessages.length > 1) {
      saveSessionToHistory(currentSessionId, aiMessages);
    }
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    const initMsg = createInitialMessage();
    setAiMessages([initMsg]);
    try {
      localStorage.setItem("ai_active_messages", JSON.stringify([initMsg]));
    } catch {}
    setShowChatHistoryView(false);
    showToast("Started new chat session", "info");
  };

  const handleLoadChatSession = (session) => {
    setCurrentSessionId(session.sessionId);
    setAiMessages(session.messages || []);
    try {
      localStorage.setItem(
        "ai_active_messages",
        JSON.stringify(session.messages || []),
      );
    } catch {}
    setShowChatHistoryView(false);
    showToast(
      `Loaded chat history (${session.dateFormatted || session.dateString || session.year})`,
      "info",
    );
  };

  const handleDeleteChatSession = async (sessionId, e) => {
    if (e) e.stopPropagation();
    setChatHistoryList((prev) => {
      const updated = prev.filter((s) => s.sessionId !== sessionId);
      try {
        localStorage.setItem(
          "ai_chat_history_sessions",
          JSON.stringify(updated),
        );
      } catch {}
      return updated;
    });
    try {
      await axios.delete(
        `${API_BASE}/api/assistant/history/${sessionId}`,
        getAuthConfig(),
      );
    } catch {}
    showToast("Chat session removed from history", "info");
  };

  const handleExportChatHistory = () => {
    const dt = formatChatDateTime();
    let content = `======================================================\n`;
    content += `SEMANTIC SEARCH PLATFORM - AI ASSISTANT CHAT HISTORY\n`;
    content += `Export Date & Time: ${dt.fullDisplay}\n`;
    content += `Year: ${dt.year}\n`;
    content += `Session ID: ${currentSessionId}\n`;
    content += `======================================================\n\n`;

    aiMessages.forEach((msg) => {
      const roleName = msg.role === "user" ? "USER" : "AI ASSISTANT";
      const timeTag = msg.dateTimeDisplay || dt.display;
      content += `[${timeTag}] ${roleName}:\n${msg.content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        content += `  Citations:\n`;
        msg.sources.forEach((src) => {
          content += `   - ${src.title} (${src.domainName || "Domain"})\n`;
        });
        content += `\n`;
      }
    });

    content += `======================================================\nEnd of Chat History\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI_Assistant_Chat_History_${dt.date.replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Chat history exported with date, time, and year!", "success");
  };

  // Fast mutable refs to prevent stale closure in speech recognition callbacks
  const aiDrawerOpenRef = useRef(aiDrawerOpen);
  const voiceLangRef = useRef(voiceLang);
  const voiceSpeechEnabledRef = useRef(voiceSpeechEnabled);

  useEffect(() => {
    aiDrawerOpenRef.current = aiDrawerOpen;
    if (aiDrawerOpen) {
      fetchChatHistory();
    }
  }, [aiDrawerOpen]);

  useEffect(() => {
    voiceLangRef.current = voiceLang;
  }, [voiceLang]);

  useEffect(() => {
    voiceSpeechEnabledRef.current = voiceSpeechEnabled;
  }, [voiceSpeechEnabled]);

  // Halt any active speech playback
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
    setIsSpeaking(false);
  };

  // Speak text aloud in matching language with markdown cleaning
  const speakAloud = (text, targetLang = null) => {
    if (!voiceSpeechEnabledRef.current || !window.speechSynthesis || !text)
      return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Clean markdown formatting, links, code snippets for crystal clear natural speech
      let cleanText = text
        .replace(/```[\s\S]*?```/g, "Code sample omitted for voice.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_#~>]/g, "")
        .replace(/[•\-\+]\s+/g, "")
        .replace(/\n+/g, ". ")
        .trim();

      if (!cleanText) return;

      const activeLang = targetLang || voiceLangRef.current || "en-US";
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = activeLang;

      const voices = window.speechSynthesis.getVoices();
      const prefix = activeLang.split("-")[0];
      const matchVoice = voices.find(
        (v) => v.lang === activeLang || v.lang.startsWith(prefix),
      );
      if (matchVoice) {
        utterance.voice = matchVoice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      utterance.onerror = (e) => {
        console.warn("Speech synthesis utterance error:", e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setIsSpeaking(false);
    }
  };

  // Send question to Conversational AI RAG Assistant and speak answer aloud
  const sendAiMessage = async (customPrompt = null) => {
    const queryText = (customPrompt !== null ? customPrompt : aiInput).trim();
    if (!queryText || aiLoading) return;

    // Auto-open AI drawer so the user sees the dialogue
    setAiDrawerOpen(true);
    aiDrawerOpenRef.current = true;
    setShowChatHistoryView(false);

    const dt = formatChatDateTime();
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: queryText,
      timestamp: dt.iso,
      dateTimeDisplay: dt.display,
      fullDateTime: dt.fullDisplay,
      dateString: dt.fullDate,
      timeString: dt.time,
      year: dt.year,
    };

    const updatedWithUser = [...aiMessages, userMsg];
    setAiMessages(updatedWithUser);
    if (customPrompt === null) setAiInput("");
    setAiLoading(true);

    try {
      const currentLang = voiceLangRef.current || voiceLang;
      const langCode = currentLang.slice(0, 2);
      // Include recent conversation history for multi-turn context
      const historyPayload = updatedWithUser.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await axios.post(
        `${API_BASE}/api/assistant/chat`,
        {
          message: queryText,
          language: langCode,
          conversationHistory: historyPayload,
        },
        getAuthConfig(),
      );

      const assistantDt = formatChatDateTime();
      const assistantMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.data.reply,
        sources: response.data.sources || [],
        suggestions: response.data.suggestions || [],
        timestamp: assistantDt.iso,
        dateTimeDisplay: assistantDt.display,
        fullDateTime: assistantDt.fullDisplay,
        dateString: assistantDt.fullDate,
        timeString: assistantDt.time,
        year: assistantDt.year,
      };

      const updatedWithAssistant = [...updatedWithUser, assistantMsg];
      setAiMessages(updatedWithAssistant);
      saveSessionToHistory(currentSessionId, updatedWithAssistant, queryText);

      // AI Assistant speaks its answer aloud in the user's language!
      speakAloud(response.data.reply, currentLang);
    } catch (error) {
      console.error("sendAiMessage error:", error);
      const errDt = formatChatDateTime();
      const errReply =
        "I encountered an issue retrieving that information. Please check your backend connection.";
      const errMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: errReply,
        sources: [],
        timestamp: errDt.iso,
        dateTimeDisplay: errDt.display,
        fullDateTime: errDt.fullDisplay,
        dateString: errDt.fullDate,
        timeString: errDt.time,
        year: errDt.year,
      };
      const updatedWithErr = [...updatedWithUser, errMsg];
      setAiMessages(updatedWithErr);
      saveSessionToHistory(currentSessionId, updatedWithErr);
      speakAloud(errReply);
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle Voice Recognition
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(
        "Speech Recognition not supported in this browser. Please use Chrome or Edge.",
        "error",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus("Listening for voice commands...");
        showToast("Microphone active: Speak a command...", "info");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceTranscript(transcript);
        setVoiceStatus(`Recognized: "${transcript}"`);
        handleVoiceCommand(transcript);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setVoiceStatus("Voice error or stopped");
        if (event.error !== "no-speech") {
          showToast(`Voice error: ${event.error}`, "error");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setVoiceStatus("Click mic to speak");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
    setVoiceStatus("Click mic to speak");
  };

  // Helper: Create domain directly via voice
  const createDomainDirectly = async (
    name,
    description = "Created via voice instructions",
  ) => {
    try {
      const cleanName = name.trim();
      const response = await axios.post(
        `${API_BASE}/api/domains`,
        { name: cleanName, description },
        getAuthConfig(),
      );
      const newDomain = {
        ...(response.data.domain || response.data),
        resourceCount: 0,
      };
      setDomains((prev) => [newDomain, ...prev]);
      setSelectedDomain(newDomain);
      logActivity(`Created domain "${cleanName}" via voice`, "domain");
      showToast(`Domain "${cleanName}" created via voice!`, "success");
      speakAloud(`Domain "${cleanName}" has been created successfully.`);
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to create domain",
        "error",
      );
      speakAloud("Sorry, I could not create the domain.");
    }
  };

  // Helper: Add FAQ directly via voice
  const addFaqDirectly = async (question, answer) => {
    let targetDomain = selectedDomain;
    if (!targetDomain && domains.length > 0) {
      targetDomain = domains[0];
      setSelectedDomain(domains[0]);
    }
    if (!targetDomain) {
      try {
        const dRes = await axios.post(
          `${API_BASE}/api/domains`,
          {
            name: "General Knowledge",
            description: "Default domain for voice knowledge",
          },
          getAuthConfig(),
        );
        targetDomain = { ...(dRes.data.domain || dRes.data), resourceCount: 0 };
        setDomains((prev) => [targetDomain, ...prev]);
        setSelectedDomain(targetDomain);
      } catch {
        showToast("Please create a domain before adding FAQs", "error");
        speakAloud("Please create a domain before adding an FAQ.");
        setShowCreateModal(true);
        return;
      }
    }

    try {
      const cleanQ = question.trim();
      const cleanA = answer.trim();
      const response = await axios.post(
        `${API_BASE}/api/resources/${targetDomain._id}`,
        {
          type: "faq",
          title: cleanQ,
          content: cleanA,
        },
        getAuthConfig(),
      );

      const newResource = response.data.resource;
      setResources((prev) => [newResource, ...prev]);
      setAllResources((prev) => [newResource, ...prev]);
      setDomains((prev) =>
        prev.map((d) =>
          d._id === targetDomain._id
            ? { ...d, resourceCount: (d.resourceCount || 0) + 1 }
            : d,
        ),
      );
      setSelectedDomain((prev) =>
        prev ? { ...prev, resourceCount: (prev.resourceCount || 0) + 1 } : prev,
      );

      logActivity(`Added FAQ "${cleanQ}" via voice`, "resource");
      showToast(`FAQ "${cleanQ}" added with vector embeddings!`, "success");
      speakAloud(
        `FAQ "${cleanQ}" added to ${targetDomain.name} with vector embeddings.`,
      );
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add FAQ", "error");
      speakAloud("Sorry, I could not add the FAQ.");
    }
  };

  // Helper: Add Text/Note resource directly via voice
  const addTextResourceDirectly = async (title, content) => {
    let targetDomain = selectedDomain;
    if (!targetDomain && domains.length > 0) {
      targetDomain = domains[0];
      setSelectedDomain(domains[0]);
    }
    if (!targetDomain) {
      try {
        const dRes = await axios.post(
          `${API_BASE}/api/domains`,
          {
            name: "General Notes",
            description: "Default domain for voice notes",
          },
          getAuthConfig(),
        );
        targetDomain = { ...(dRes.data.domain || dRes.data), resourceCount: 0 };
        setDomains((prev) => [targetDomain, ...prev]);
        setSelectedDomain(targetDomain);
      } catch {
        showToast("Please create a domain before adding notes", "error");
        speakAloud("Please create a domain before adding a note.");
        setShowCreateModal(true);
        return;
      }
    }

    try {
      const cleanTitle = title.trim();
      const cleanContent = content.trim();
      const response = await axios.post(
        `${API_BASE}/api/resources/${targetDomain._id}`,
        {
          type: "text",
          title: cleanTitle,
          content: cleanContent,
        },
        getAuthConfig(),
      );

      const newResource = response.data.resource;
      setResources((prev) => [newResource, ...prev]);
      setAllResources((prev) => [newResource, ...prev]);
      setDomains((prev) =>
        prev.map((d) =>
          d._id === targetDomain._id
            ? { ...d, resourceCount: (d.resourceCount || 0) + 1 }
            : d,
        ),
      );
      setSelectedDomain((prev) =>
        prev ? { ...prev, resourceCount: (prev.resourceCount || 0) + 1 } : prev,
      );

      logActivity(`Added text note "${cleanTitle}" via voice`, "resource");
      showToast(
        `Text note "${cleanTitle}" indexed with vector embeddings!`,
        "success",
      );
      speakAloud(
        `Text note "${cleanTitle}" added to ${targetDomain.name} with vector embeddings.`,
      );
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to add text note",
        "error",
      );
      speakAloud("Sorry, I could not add the text note.");
    }
  };

  // Helper: Automatically upload file from local filesystem by voice instruction
  const autoUploadFileDirectly = async (fileNameOrPath) => {
    let targetDomain = selectedDomain;
    if (!targetDomain && domains.length > 0) {
      targetDomain = domains[0];
      setSelectedDomain(domains[0]);
    }

    try {
      const cleanName = fileNameOrPath.trim();
      showToast(`Searching computer filesystem for "${cleanName}"...`, "info");
      speakAloud(`Searching your computer for ${cleanName}`);

      const response = await axios.post(
        `${API_BASE}/api/resources/auto-upload-local`,
        {
          domainId: targetDomain?._id,
          fileNameOrPath: cleanName,
        },
        getAuthConfig(),
      );

      const newResource = response.data.resource;
      setResources((prev) => [newResource, ...prev]);
      setAllResources((prev) => [newResource, ...prev]);
      if (targetDomain) {
        setDomains((prev) =>
          prev.map((d) =>
            d._id === targetDomain._id
              ? { ...d, resourceCount: (d.resourceCount || 0) + 1 }
              : d,
          ),
        );
        setSelectedDomain((prev) =>
          prev
            ? { ...prev, resourceCount: (prev.resourceCount || 0) + 1 }
            : prev,
        );
      } else {
        fetchDomains();
      }

      logActivity(
        `Auto-uploaded "${newResource.title}" from computer`,
        "resource",
      );
      showToast(
        `File "${newResource.title}" uploaded from computer and indexed!`,
        "success",
      );
      speakAloud(
        `File ${newResource.title} automatically uploaded from computer filesystem and embedded.`,
      );
    } catch (err) {
      console.warn("autoUploadFileDirectly error:", err);
      const isNotFound =
        err.response?.status === 404 || err.response?.data?.notFound;
      if (isNotFound) {
        showToast(
          `Could not find "${fileNameOrPath}" in common folders. Opening file chooser...`,
          "warning",
        );
        speakAloud(
          `Could not find ${fileNameOrPath} in standard folders. Opening file selector.`,
        );
        setTimeout(() => {
          voiceFileInputRef.current?.click();
        }, 600);
      } else {
        const msg = err.response?.data?.message || "Failed to auto-upload file";
        showToast(msg, "error");
        speakAloud("File upload from computer failed.");
      }
    }
  };

  // Fallback file input change handler
  const handleVoiceFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let targetDomain = selectedDomain;
    if (!targetDomain && domains.length > 0) {
      targetDomain = domains[0];
      setSelectedDomain(domains[0]);
    }
    if (!targetDomain) {
      showToast("Please create a domain before uploading files", "error");
      speakAloud("Please create a domain before uploading a file.");
      setShowCreateModal(true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("domainId", targetDomain._id);
      formData.append("pdf", file);

      showToast(`Uploading and embedding "${file.name}"...`, "info");
      const response = await axios.post(
        `${API_BASE}/api/resources/upload-pdf`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const newResource = response.data.resource;
      setResources((prev) => [newResource, ...prev]);
      setAllResources((prev) => [newResource, ...prev]);
      setDomains((prev) =>
        prev.map((d) =>
          d._id === targetDomain._id
            ? { ...d, resourceCount: (d.resourceCount || 0) + 1 }
            : d,
        ),
      );
      setSelectedDomain((prev) =>
        prev ? { ...prev, resourceCount: (prev.resourceCount || 0) + 1 } : prev,
      );

      logActivity(`Uploaded file "${file.name}" via voice`, "resource");
      showToast(
        `File "${file.name}" indexed with vector embeddings!`,
        "success",
      );
      speakAloud(
        `File ${file.name} uploaded and indexed with vector embeddings.`,
      );
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to upload file";
      showToast(msg, "error");
      speakAloud("Sorry, could not upload the file.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // ========================================================
  // NAVIGATION DETECTOR — detects nav commands in any language
  // Returns an action function if nav detected, null otherwise
  // ========================================================
  const detectNavigation = (text, i18n) => {
    // Dashboard / Home
    if (
      /(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?|take\s+me\s*(?:to\s*)?)(?:the\s+)?(?:dashboard|home|main\s*page|home\s*page|panel|tablero|accueil|startseite|முகப்பு|டேஷ்போர்டு|डैशबोर्ड|ホーム|首页)/i.test(
        text,
      ) ||
      /^(?:dashboard|home|panel|முகப்பு|டேஷ்போர்டு|डैशबोर्ड|go\s*dashboard|go\s*home|main\s*page)$/i.test(
        text,
      ) ||
      /dashboard\s*(?:pe|ko|par|me)?\s*(?:jao|chalo|le)/i.test(text)
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("dashboard");
        speakAloud(i18n.dashboard);
        showToast(i18n.dashboard, "info");
      };
    }

    // Domains
    if (
      /(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?)(?:the\s+)?(?:domains?|knowledge\s*domains?|dominios?|domaines?|bereiche|டொமைன்(?:கள்)?|डोमेन|ドメイン|领域)/i.test(
        text,
      ) ||
      /^(?:domains?|dominios|டொமைன்(?:கள்)?|डोमेन|go\s*domains?)$/i.test(text)
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("domains");
        speakAloud(i18n.domains);
        showToast(i18n.domains, "info");
      };
    }

    // Search — only navigate, NOT "search for X"
    if (
      /^(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?)(?:the\s+)?(?:search|semantic\s*search|search\s*page|búsqueda|recherche|suche|தேடல்|சொற்பொருள்\s*தேடல்|खोज|検索|搜索)\s*$/i.test(
        text,
      ) ||
      /^(?:search\s*page|semantic\s*search|தேடல்|சொற்பொருள்\s*தேடல்|खोज|go\s*search)$/i.test(
        text,
      )
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("search");
        speakAloud(i18n.search);
        showToast(i18n.search, "info");
      };
    }

    // Resources
    if (
      /^(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?)(?:the\s+)?(?:(?:all\s+)?resources?|catalog|recursos?|ressources|வளங்கள்?|ஆவணங்கள்?|संसाधन|リソース|资源)\s*$/i.test(
        text,
      ) ||
      /^(?:resources?|all\s*resources|recursos|வளங்கள்|ஆவணங்கள்|go\s*resources?)$/i.test(
        text,
      )
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("resources");
        speakAloud(i18n.resources);
        showToast(i18n.resources, "info");
      };
    }

    // Settings
    if (
      /^(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?)(?:the\s+)?(?:settings?|configuration|diagnostics?|configuraci[oó]n|paramètres?|einstellungen|அமைப்புகள்?|設定|设置|सेटिंग)\s*$/i.test(
        text,
      ) ||
      /^(?:settings?|diagnostics?|configuración|அமைப்புகள்|सेटिंग|go\s*settings?)$/i.test(
        text,
      )
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("settings");
        speakAloud(i18n.settings);
        showToast(i18n.settings, "info");
      };
    }

    // Help
    if (
      /^(?:go\s*(?:to\s*)?|open\s+|show\s+|navigate\s*(?:to\s*)?|switch\s*(?:to\s*)?)(?:the\s+)?(?:help|help\s*dashboard|guide|ayuda|aide|hilfe|உதவி|வழிகாட்டி|ヘルプ|帮助|मदद)\s*$/i.test(
        text,
      ) ||
      /^(?:help|help\s*dashboard|guide|ayuda|உதவி|வழிகாட்டி|go\s*help|मदद)$/i.test(
        text,
      )
    ) {
      return () => {
        setSelectedDomain(null);
        setCurrentTab("help");
        speakAloud(i18n.help);
        showToast(i18n.help, "info");
      };
    }

    // AI Assistant open
    if (
      /^(?:go\s*(?:to\s*)?|open\s+|show\s+|launch\s+|start\s+)(?:the\s+)?(?:ai\s+)?(?:assistant|chat|chatbot|உதவியாளர்|ஏஐ\s*உதவியாளர்)\s*$/i.test(
        text,
      ) ||
      /^(?:assistant|ai\s*assistant|open\s*assistant|chat|open\s*chat|open\s*ai|உதவியாளர்|ஏஐ\s*உதவியாளர்)$/i.test(
        text,
      )
    ) {
      return () => {
        setAiDrawerOpen(true);
        speakAloud("AI Assistant open. How can I help you?");
        showToast("AI Assistant open", "info");
      };
    }

    // Logout
    if (
      /^(?:log\s*out|sign\s*out|cerrar\s*sesión|வெளியேறு|லாக்\s*அவுட்|log\s*me\s*out)$/i.test(
        text,
      )
    ) {
      return () => {
        speakAloud(i18n.logout);
        setTimeout(() => handleLogout(), 1200);
      };
    }

    return null;
  };

  // Voice Command Handler
  const handleVoiceCommand = (rawText) => {
    const text = rawText.toLowerCase().trim();
    const currentLang = voiceLangRef.current || voiceLang;
    const langCode = currentLang.slice(0, 2);
    const i18n = voiceConfirmations[langCode] || voiceConfirmations["en"];

    // ========================================================
    // PRIORITY: NAVIGATION COMMANDS — checked BEFORE AI drawer
    // so "go to dashboard" ALWAYS works in any state/language
    // ========================================================
    const isNavCommand = detectNavigation(text, i18n);
    if (isNavCommand) {
      if (aiDrawerOpenRef.current) setAiDrawerOpen(false);
      stopSpeaking();
      isNavCommand();
      return;
    }

    // ========================================================
    // 1. DIRECT AI ASSISTANT CONVERSATION MODE
    // If the AI Assistant drawer is currently open, user is
    // conversing with the AI assistant.
    // ========================================================
    if (aiDrawerOpenRef.current) {
      if (
        text === "close assistant" ||
        text === "close chat" ||
        text === "hide assistant" ||
        text === "dismiss assistant" ||
        text === "close drawer" ||
        text === "close"
      ) {
        stopSpeaking();
        setAiDrawerOpen(false);
        speakAloud("AI Assistant closed");
        showToast("AI Assistant closed", "info");
        return;
      }

      if (
        text === "stop speaking" ||
        text === "stop talking" ||
        text === "shut up" ||
        text === "be quiet" ||
        text === "mute" ||
        text === "stop audio" ||
        text === "stop"
      ) {
        stopSpeaking();
        showToast("Audio stopped", "info");
        return;
      }

      // Route dialogue to AI Assistant
      sendAiMessage(rawText);
      return;
    }

    // ========================================================
    // 2. EXPLICIT AI ASSISTANT DOUBTS & ERROR TROUBLESHOOTING
    // AI Assistant is dedicated to clearing user doubts and
    // troubleshooting errors (e.g. "I have a doubt", "how to fix
    // error 401", "troubleshoot upload error", "Ask AI ...").
    // ========================================================
    const isAddressingAiExplicitly =
      /^(?:hey|ok|hi)?\s*(?:ai assistant|assistant|ai|உதவியாளர்|ஏஐ உதவியாளர்|ai உதவியாளர்)\b/i.test(
        rawText,
      ) ||
      /^(?:ask|tell|talk to|கேள்)\s+(?:ai|assistant|உதவியாளர்)/i.test(rawText);

    const isDoubtOrErrorHelp =
      /\b(?:doubt|doubts|clear my doubt|clear doubt|i have a doubt|troubleshoot|fix error|troubleshoot error|why did.*fail|error 401|upload error|pdf error|embedding error|mongodb error|microphone error|mic error|cors error|error in|பிழை|சந்தேகம்|சரிசெய்)\b/i.test(
        text,
      );

    if (isAddressingAiExplicitly || isDoubtOrErrorHelp) {
      const cleanQuery =
        rawText
          .replace(
            /^(?:hey|ok|hi)?\s*(?:ai assistant|assistant|ai|உதவியாளர்|ஏஐ உதவியாளர்|ai உதவியாளர்)\s*[,:]?\s*/i,
            "",
          )
          .replace(
            /^(?:ask|tell|talk to|கேள்)\s+(?:ai|assistant|உதவியாளர்)\s*[,:]?\s*/i,
            "",
          )
          .trim() || rawText;

      setAiDrawerOpen(true);
      sendAiMessage(cleanQuery);
      return;
    }

    // ========================================================
    // 3. MODAL CONTROLS (IF ACTIVE)
    // ========================================================
    if (showCreateModal) {
      if (
        text.startsWith("name is") ||
        text.startsWith("domain name is") ||
        text.startsWith("call it") ||
        text.startsWith("பெயர் ")
      ) {
        const val = text
          .replace(/^(name is|domain name is|call it|பெயர் )\s+/i, "")
          .trim();
        setDomainName(val);
        speakAloud(`Domain name set to ${val}`);
        return;
      }
      if (
        text.startsWith("description is") ||
        text.startsWith("description") ||
        text.startsWith("விளக்கம் ")
      ) {
        const val = text
          .replace(/^(description is|description|விளக்கம் )\s+/i, "")
          .trim();
        setDomainDescription(val);
        speakAloud("Description updated");
        return;
      }
      if (
        text === "create" ||
        text === "submit" ||
        text === "save domain" ||
        text === "save" ||
        text === "உருவாக்கு" ||
        text === "சேமி"
      ) {
        if (domainName.trim()) {
          createDomainDirectly(domainName, domainDescription);
          setShowCreateModal(false);
          setDomainName("");
          setDomainDescription("");
        } else {
          speakAloud("Please provide a domain name first");
        }
        return;
      }
      if (text === "cancel" || text === "close" || text === "ரத்து") {
        setShowCreateModal(false);
        speakAloud("Cancelled domain creation");
        return;
      }
    }

    if (showResourceModal) {
      if (
        text.startsWith("title is") ||
        text.startsWith("question is") ||
        text.startsWith("title") ||
        text.startsWith("question") ||
        text.startsWith("தலைப்பு ")
      ) {
        const val = text
          .replace(/^(title is|question is|title|question|தலைப்பு )\s+/i, "")
          .trim();
        setResourceTitle(val);
        speakAloud(`Title set to ${val}`);
        return;
      }
      if (
        text.startsWith("content is") ||
        text.startsWith("answer is") ||
        text.startsWith("content") ||
        text.startsWith("answer") ||
        text.startsWith("பதில் ")
      ) {
        const val = text
          .replace(/^(content is|answer is|content|answer|பதில் )\s+/i, "")
          .trim();
        setResourceContent(val);
        speakAloud("Content updated");
        return;
      }
      if (
        text === "submit" ||
        text === "save" ||
        text === "add" ||
        text === "save resource" ||
        text === "சேமி" ||
        text === "சேர்"
      ) {
        if (resourceTitle.trim()) {
          addFaqDirectly(resourceTitle, resourceContent);
          setShowResourceModal(false);
          setResourceTitle("");
          setResourceContent("");
        } else {
          speakAloud("Please provide a title first");
        }
        return;
      }
      if (text === "cancel" || text === "close" || text === "ரத்து") {
        setShowResourceModal(false);
        speakAloud("Cancelled");
        return;
      }
    }

    // ========================================================
    // 4. HANDS-FREE CREATION: DOMAIN, FAQ, TEXT, FILE UPLOAD
    // ========================================================

    // A. Domain Creation (English, Spanish, Tamil, Hindi)
    const domainCreateRegex =
      /(?:create|add|make|new)\s+(?:a\s+)?(?:new\s+)?domain\s+(?:called|named|with name)\s+(.+)/i;
    const domainMatch = text.match(domainCreateRegex);
    if (domainMatch && domainMatch[1]) {
      createDomainDirectly(domainMatch[1].trim());
      return;
    }

    const domainEsMatch = text.match(
      /crear (?:un )?dominio (?:llamado|con nombre)\s+(.+)/i,
    );
    if (domainEsMatch && domainEsMatch[1]) {
      createDomainDirectly(domainEsMatch[1].trim());
      return;
    }

    const domainTaMatch = text.match(
      /(?:புதிய\s+)?டொமைன்\s+உருவாக்கு\s+(?:பெயர்\s+)?(.+)/i,
    );
    if (domainTaMatch && domainTaMatch[1]) {
      createDomainDirectly(domainTaMatch[1].trim());
      return;
    }

    const domainHiMatch = text.match(
      /(?:नया\s+)?डोमेन\s+बनाएं\s+(?:नाम\s+)?(.+)/i,
    );
    if (domainHiMatch && domainHiMatch[1]) {
      createDomainDirectly(domainHiMatch[1].trim());
      return;
    }

    // B. FAQ Creation (English, Spanish, Tamil, Hindi)
    const faqRegex =
      /(?:add|create|new)\s+(?:an?\s+)?faq\s+(?:titled\s+|question\s+)?(.+?)\s+(?:with\s+)?(?:answer|content|reply)\s+(.+)/i;
    const faqMatch = text.match(faqRegex);
    if (faqMatch && faqMatch[1] && faqMatch[2]) {
      addFaqDirectly(faqMatch[1].trim(), faqMatch[2].trim());
      return;
    }

    const faqQuestionMatch = text.match(
      /(?:add|create)\s+question\s+(.+?)\s+(?:with\s+)?(?:answer|reply)\s+(.+)/i,
    );
    if (faqQuestionMatch && faqQuestionMatch[1] && faqQuestionMatch[2]) {
      addFaqDirectly(faqQuestionMatch[1].trim(), faqQuestionMatch[2].trim());
      return;
    }

    const faqDirectMatch = text.match(
      /^faq\s+question\s+(.+?)\s+answer\s+(.+)/i,
    );
    if (faqDirectMatch && faqDirectMatch[1] && faqDirectMatch[2]) {
      addFaqDirectly(faqDirectMatch[1].trim(), faqDirectMatch[2].trim());
      return;
    }

    const faqEsMatch = text.match(
      /(?:agregar|crear)\s+faq\s+(?:pregunta\s+)?(.+?)\s+respuesta\s+(.+)/i,
    );
    if (faqEsMatch && faqEsMatch[1] && faqEsMatch[2]) {
      addFaqDirectly(faqEsMatch[1].trim(), faqEsMatch[2].trim());
      return;
    }

    // Tamil FAQ addition: "கேள்வி [கேள்வி] பதில் [பதில்]" or "faq சேர் கேள்வி [கேள்வி] பதில் [பதில்]"
    if (
      text.includes("பதில்") &&
      (text.includes("கேள்வி") || text.includes("faq") || text.includes("சேர்"))
    ) {
      const faqTaMatch = text.match(
        /(?:faq\s+சேர்\s+)?(?:கேள்வி\s+)?(.+?)\s+பதில்\s+(.+)/i,
      );
      if (faqTaMatch && faqTaMatch[1] && faqTaMatch[2]) {
        addFaqDirectly(faqTaMatch[1].trim(), faqTaMatch[2].trim());
        return;
      }
    }

    const faqHiMatch = text.match(
      /(?:faq|सवाल|प्रश्न)\s+जोड़ें\s+(.+?)\s+(?:उत्तर|जवाब)\s+(.+)/i,
    );
    if (faqHiMatch && faqHiMatch[1] && faqHiMatch[2]) {
      addFaqDirectly(faqHiMatch[1].trim(), faqHiMatch[2].trim());
      return;
    }

    // C. Text / Note Resource Creation (English, Spanish, Tamil, Hindi)
    const textRegex =
      /(?:add|create)\s+(?:a\s+)?(?:text|note|article|memo)\s+(?:titled\s+|named\s+|called\s+)?(.+?)\s+(?:with\s+)?(?:content|body|text)\s+(.+)/i;
    const textMatch = text.match(textRegex);
    if (textMatch && textMatch[1] && textMatch[2]) {
      addTextResourceDirectly(textMatch[1].trim(), textMatch[2].trim());
      return;
    }

    const textShortMatch = text.match(
      /(?:add|create)\s+(?:text|note)\s+(.+?)\s+content\s+(.+)/i,
    );
    if (textShortMatch && textShortMatch[1] && textShortMatch[2]) {
      addTextResourceDirectly(
        textShortMatch[1].trim(),
        textShortMatch[2].trim(),
      );
      return;
    }

    const textTaMatch = text.match(
      /(?:உரை|குறிப்பு)\s+சேர்\s+(?:தலைப்பு\s+)?(.+?)\s+உள்ளடக்கம்\s+(.+)/i,
    );
    if (textTaMatch && textTaMatch[1] && textTaMatch[2]) {
      addTextResourceDirectly(textTaMatch[1].trim(), textTaMatch[2].trim());
      return;
    }

    const textEsMatch = text.match(
      /(?:agregar|crear)\s+texto\s+(?:título\s+)?(.+?)\s+contenido\s+(.+)/i,
    );
    if (textEsMatch && textEsMatch[1] && textEsMatch[2]) {
      addTextResourceDirectly(textEsMatch[1].trim(), textEsMatch[2].trim());
      return;
    }

    const textHiMatch = text.match(
      /(?:टेक्स्ट|नोट)\s+जोड़ें\s+(?:शीर्षक\s+)?(.+?)\s+(?:सामग्री|विवरण)\s+(.+)/i,
    );
    if (textHiMatch && textHiMatch[1] && textHiMatch[2]) {
      addTextResourceDirectly(textHiMatch[1].trim(), textHiMatch[2].trim());
      return;
    }

    // D. File Auto-Upload from Computer Filesystem (by Name)
    const fileNamedUploadRegex =
      /(?:upload|attach|import)\s+(?:the\s+)?(?:file|pdf|document)\s+(?:named\s+|called\s+)?(.+)/i;
    const fileNamedMatch = text.match(fileNamedUploadRegex);
    if (fileNamedMatch && fileNamedMatch[1]) {
      const fileName = fileNamedMatch[1].trim();
      autoUploadFileDirectly(fileName);
      return;
    }

    const fileExtUploadRegex =
      /(?:auto\s+upload|upload)\s+(.+?\.(?:pdf|txt|md|doc|docx))/i;
    const fileExtMatch = text.match(fileExtUploadRegex);
    if (fileExtMatch && fileExtMatch[1]) {
      const fileName = fileExtMatch[1].trim();
      autoUploadFileDirectly(fileName);
      return;
    }

    const fileTaUploadMatch = text.match(
      /(?:கோப்பு|ஆவணம்|pdf)\s+(?:பதிவேற்று|சேர்)\s+(.+)/i,
    );
    if (fileTaUploadMatch && fileTaUploadMatch[1]) {
      autoUploadFileDirectly(fileTaUploadMatch[1].trim());
      return;
    }

    const fileEsUploadMatch = text.match(
      /(?:subir|cargar)\s+(?:archivo|pdf|documento)\s+(.+)/i,
    );
    if (fileEsUploadMatch && fileEsUploadMatch[1]) {
      autoUploadFileDirectly(fileEsUploadMatch[1].trim());
      return;
    }

    const fileHiUploadMatch = text.match(
      /(?:फ़ाइल|दस्तावेज़|पीडीएफ)\s+अपलोड\s+करें\s+(.+)/i,
    );
    if (fileHiUploadMatch && fileHiUploadMatch[1]) {
      autoUploadFileDirectly(fileHiUploadMatch[1].trim());
      return;
    }

    // Standalone file upload command: opens native file selector dialog
    if (
      /^(?:upload|attach)\s+(?:a\s+)?(?:file|pdf|document)$/i.test(text) ||
      /^(?:subir|cargar)\s+archivo$/i.test(text) ||
      /^(?:கோப்பு|ஆவணம்)\s+பதிவேற்று$/i.test(text) ||
      /^(?:फ़ाइल\s+अपलोड\s+करें)$/i.test(text)
    ) {
      speakAloud("Opening file chooser");
      voiceFileInputRef.current?.click();
      return;
    }

    // ========================================================
    // 5. VOICE CONTROLLER SEMANTIC SEARCH (PRIMARY SEARCH ENGINE)
    // Searches relevant content, displays results on the console,
    // and speaks the top result with similarity percentage aloud!
    // ========================================================
    const searchTriggers = [
      "search for",
      "search",
      "find",
      "look up",
      "give me",
      "buscar",
      "chercher",
      "suche nach",
      "khojo",
      "dhundo",
      "தேடு",
      "கண்டுபிடி",
      "thedu",
    ];

    for (const trigger of searchTriggers) {
      if (text.startsWith(trigger + " ")) {
        const query = text
          .replace(new RegExp("^" + trigger + "\\s+", "i"), "")
          .trim();
        if (query) {
          setSelectedDomain(null);
          setCurrentTab("search");
          setSearchQuery(query);
          handleGlobalSemanticSearch(null, query, true);
          showToast(`Voice Search: "${query}"`, "info");
          return;
        }
      }
    }

    // Question words for Voice Controller Search
    const questionSearchRegex =
      /^(?:what|who|where|when|which|how|tell me about|look up|give me info on|qué|cómo|dónde|qu'est-ce|was|wie|kya|kaise|enna|enge|yaar|udhavu|sollu|என்ன|எப்படி|ஏன்|எங்கே|யார்|சொல்லு)\b/i;
    if (questionSearchRegex.test(text)) {
      setSelectedDomain(null);
      setCurrentTab("search");
      setSearchQuery(rawText);
      handleGlobalSemanticSearch(null, rawText, true);
      showToast(`Voice Search: "${rawText}"`, "info");
      return;
    }

    // ========================================================
    // 6. ACTION & MODAL OPENING
    // ========================================================
    if (
      /^(?:open\s+)?create\s+domain/i.test(text) ||
      text === "new domain" ||
      /crear dominio/i.test(text) ||
      text === "டொமைன் உருவாக்கு" ||
      text === "புதிய டொமைன்"
    ) {
      setShowCreateModal(true);
      speakAloud(
        "Opening Create Domain modal. What would you like to name it?",
      );
      showToast("Opening Create Domain modal", "info");
      return;
    }

    if (
      /^(?:open\s+)?(?:add resource|open add resource|agregar recurso|open faq)/i.test(
        text,
      ) ||
      text === "வளம் சேர்" ||
      text === "ஆவணம் சேர்"
    ) {
      if (selectedDomain) {
        setShowResourceModal(true);
        speakAloud(`Opening Add Resource in ${selectedDomain.name}`);
      } else if (domains.length > 0) {
        openDomain(domains[0]);
        setShowResourceModal(true);
        speakAloud(`Opening Add Resource in ${domains[0].name}`);
      } else {
        setShowCreateModal(true);
        speakAloud("Please create a domain first");
      }
      return;
    }

    // ========================================================
    // 7. (NAVIGATION MOVED TO TOP via detectNavigation)
    // ========================================================

    // ========================================================
    // 8. FALLBACK: EXECUTE AS VOICE CONTROLLER SEMANTIC SEARCH!
    // Searches relevant documents and speaks top match aloud!
    // ========================================================
    setSelectedDomain(null);
    setCurrentTab("search");
    setSearchQuery(rawText);
    handleGlobalSemanticSearch(null, rawText, true);
    showToast(`Voice Search: "${rawText}"`, "info");
  };

  // Toasts State
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Activity Log
  const [activities, setActivities] = useState([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("semantic_search_activities");
      if (saved) {
        setActivities(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
  }, []);

  const logActivity = (action, meta = "") => {
    const newAct = {
      id: Date.now(),
      action,
      meta,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: Date.now(),
    };
    setActivities((prev) => {
      const updated = [newAct, ...prev.slice(0, 19)];
      try {
        localStorage.setItem(
          "semantic_search_activities",
          JSON.stringify(updated),
        );
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Domains State
  const [domains, setDomains] = useState([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [domainError, setDomainError] = useState("");
  const [domainSearchFilter, setDomainSearchFilter] = useState("");

  // Domain Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [domainDescription, setDomainDescription] = useState("");
  const [creatingDomain, setCreatingDomain] = useState(false);

  const [editingDomain, setEditingDomain] = useState(null);
  const [editDomainName, setEditDomainName] = useState("");
  const [editDomainDesc, setEditDomainDesc] = useState("");
  const [savingDomainEdit, setSavingDomainEdit] = useState(false);

  const [domainToDelete, setDomainToDelete] = useState(null);
  const [deletingDomain, setDeletingDomain] = useState(false);

  // Selected Domain & Resources State
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceFilterType, setResourceFilterType] = useState("all");
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");

  // In-Domain Search State
  const [domainSearchInput, setDomainSearchInput] = useState("");
  const [domainSearchResults, setDomainSearchResults] = useState(null);
  const [searchingInDomain, setSearchingInDomain] = useState(false);

  // Resource Modals State
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceType, setResourceType] = useState("faq");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceContent, setResourceContent] = useState("");
  const [resourceFile, setResourceFile] = useState(null);
  const [addingResource, setAddingResource] = useState(false);

  const [editingResource, setEditingResource] = useState(null);
  const [editResourceTitle, setEditResourceTitle] = useState("");
  const [editResourceContent, setEditResourceContent] = useState("");
  const [savingResourceEdit, setSavingResourceEdit] = useState(false);

  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [deletingResource, setDeletingResource] = useState(false);

  const [viewingResource, setViewingResource] = useState(null);

  // Dedicated Semantic Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDomainFilter, setSearchDomainFilter] = useState("");
  const [searchMinSimilarity, setSearchMinSimilarity] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchStats, setSearchStats] = useState(null);

  // All Resources State
  const [allResources, setAllResources] = useState([]);
  const [loadingAllResources, setLoadingAllResources] = useState(false);
  const [allResTypeFilter, setAllResTypeFilter] = useState("all");
  const [allResDomainFilter, setAllResDomainFilter] = useState("");
  const [allResSearchFilter, setAllResSearchFilter] = useState("");

  // Settings Profile State
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [regeneratingEmbeddings, setRegeneratingEmbeddings] = useState(false);

  // Initial Load
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setProfileName(parsed.name || "");
    }
    fetchDomains();

    // Warm up speech synthesis voices
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Load all resources when switching to "resources" tab
  useEffect(() => {
    if (currentTab === "resources") {
      fetchAllResources();
    }
  }, [currentTab]);

  // Domains Fetching
  const fetchDomains = async () => {
    try {
      setLoadingDomains(true);
      setDomainError("");
      const response = await axios.get(
        `${API_BASE}/api/domains`,
        getAuthConfig(),
      );
      setDomains(response.data);
    } catch (error) {
      const msg =
        error.response?.data?.message || "Failed to load knowledge domains";
      setDomainError(msg);
      showToast(msg, "error");
    } finally {
      setLoadingDomains(false);
    }
  };

  // All Resources Fetching
  const fetchAllResources = async () => {
    try {
      setLoadingAllResources(true);
      const response = await axios.get(
        `${API_BASE}/api/resources/user/all`,
        getAuthConfig(),
      );
      setAllResources(response.data);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to load all resources",
        "error",
      );
    } finally {
      setLoadingAllResources(false);
    }
  };

  // Domain CRUD
  const handleCreateDomain = async (e) => {
    e.preventDefault();
    if (!domainName.trim()) return;

    try {
      setCreatingDomain(true);
      const response = await axios.post(
        `${API_BASE}/api/domains`,
        { name: domainName.trim(), description: domainDescription.trim() },
        getAuthConfig(),
      );

      const newDomain = {
        ...(response.data.domain || response.data),
        resourceCount: 0,
      };

      setDomains((prev) => [newDomain, ...prev]);
      setDomainName("");
      setDomainDescription("");
      setShowCreateModal(false);
      logActivity(`Created domain "${newDomain.name}"`, "domain");
      showToast(`Domain "${newDomain.name}" created!`, "success");
      speakAloud(`Domain ${newDomain.name} created successfully`);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to create domain",
        "error",
      );
    } finally {
      setCreatingDomain(false);
    }
  };

  const openEditDomainModal = (domain, e) => {
    if (e) e.stopPropagation();
    setEditingDomain(domain);
    setEditDomainName(domain.name);
    setEditDomainDesc(domain.description || "");
  };

  const handleSaveDomainEdit = async (e) => {
    e.preventDefault();
    if (!editDomainName.trim() || !editingDomain) return;

    try {
      setSavingDomainEdit(true);
      const response = await axios.put(
        `${API_BASE}/api/domains/${editingDomain._id}`,
        { name: editDomainName.trim(), description: editDomainDesc.trim() },
        getAuthConfig(),
      );

      const updated = response.data.domain;
      setDomains((prev) =>
        prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)),
      );
      if (selectedDomain && selectedDomain._id === updated._id) {
        setSelectedDomain((prev) => ({ ...prev, ...updated }));
      }

      logActivity(`Updated domain "${updated.name}"`, "domain");
      showToast("Domain updated successfully!", "success");
      setEditingDomain(null);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update domain",
        "error",
      );
    } finally {
      setSavingDomainEdit(false);
    }
  };

  const confirmDeleteDomain = (domain, e) => {
    if (e) e.stopPropagation();
    setDomainToDelete(domain);
  };

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return;
    try {
      setDeletingDomain(true);
      await axios.delete(
        `${API_BASE}/api/domains/${domainToDelete._id}`,
        getAuthConfig(),
      );

      setDomains((prev) => prev.filter((d) => d._id !== domainToDelete._id));
      if (selectedDomain && selectedDomain._id === domainToDelete._id) {
        setSelectedDomain(null);
        setResources([]);
      }

      logActivity(`Deleted domain "${domainToDelete.name}"`, "domain");
      showToast(`Domain "${domainToDelete.name}" deleted`, "info");
      setDomainToDelete(null);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to delete domain",
        "error",
      );
    } finally {
      setDeletingDomain(false);
    }
  };

  // Open Domain Details
  const openDomain = async (domain) => {
    setSelectedDomain(domain);
    setDomainSearchResults(null);
    setDomainSearchInput("");
    setResourceFilterType("all");
    setResourceSearchQuery("");
    try {
      setLoadingResources(true);
      const response = await axios.get(
        `${API_BASE}/api/resources/${domain._id}`,
        getAuthConfig(),
      );
      setResources(response.data);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to load domain resources",
        "error",
      );
    } finally {
      setLoadingResources(false);
    }
  };

  const goBackToDashboard = () => {
    setSelectedDomain(null);
    setResources([]);
    setDomainSearchResults(null);
    fetchDomains();
  };

  // In-Domain Search
  const handleDomainSearch = async (e) => {
    if (e) e.preventDefault();
    if (!domainSearchInput.trim() || !selectedDomain) return;

    try {
      setSearchingInDomain(true);
      const response = await axios.post(
        `${API_BASE}/api/search`,
        { query: domainSearchInput.trim(), domainId: selectedDomain._id },
        getAuthConfig(),
      );
      setDomainSearchResults(response.data.results || []);
      logActivity(
        `Searched "${domainSearchInput.trim()}" in ${selectedDomain.name}`,
        "search",
      );
    } catch (error) {
      showToast(
        error.response?.data?.message || "Search inside domain failed",
        "error",
      );
    } finally {
      setSearchingInDomain(false);
    }
  };

  const clearDomainSearch = () => {
    setDomainSearchInput("");
    setDomainSearchResults(null);
  };

  // Add Resource (FAQ, Text, PDF)
  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;
    if (resourceType === "pdf" && !resourceFile) {
      showToast("Please choose a PDF file to upload", "error");
      return;
    }
    if (resourceType !== "pdf" && !resourceTitle.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      setAddingResource(true);
      let response;

      if (resourceType === "pdf") {
        const formData = new FormData();
        formData.append("domainId", selectedDomain._id);
        formData.append("pdf", resourceFile);

        response = await axios.post(
          `${API_BASE}/api/resources/upload-pdf`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );
      } else {
        response = await axios.post(
          `${API_BASE}/api/resources/${selectedDomain._id}`,
          {
            type: resourceType,
            title: resourceTitle.trim(),
            content: resourceContent.trim(),
          },
          getAuthConfig(),
        );
      }

      const newResource = response.data.resource;
      setResources((prev) => [newResource, ...prev]);

      setDomains((prev) =>
        prev.map((d) =>
          d._id === selectedDomain._id
            ? { ...d, resourceCount: (d.resourceCount || 0) + 1 }
            : d,
        ),
      );
      setSelectedDomain((prev) => ({
        ...prev,
        resourceCount: (prev.resourceCount || 0) + 1,
      }));

      logActivity(
        `Added ${resourceType.toUpperCase()} "${newResource.title}"`,
        "resource",
      );
      showToast(
        `Resource "${newResource.title}" indexed with vector embeddings!`,
        "success",
      );
      speakAloud(
        `Resource ${newResource.title} added and embedded successfully`,
      );

      setShowResourceModal(false);
      setResourceTitle("");
      setResourceContent("");
      setResourceFile(null);
      setResourceType("faq");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to add resource",
        "error",
      );
    } finally {
      setAddingResource(false);
    }
  };

  // Edit Resource
  const openEditResourceModal = (resource, e) => {
    if (e) e.stopPropagation();
    setEditingResource(resource);
    setEditResourceTitle(resource.title);
    setEditResourceContent(resource.content || "");
  };

  const handleSaveResourceEdit = async (e) => {
    e.preventDefault();
    if (!editResourceTitle.trim() || !editingResource) return;

    try {
      setSavingResourceEdit(true);
      const targetDomainId =
        editingResource.domainId?._id ||
        editingResource.domainId ||
        selectedDomain?._id;
      const response = await axios.put(
        `${API_BASE}/api/resources/${targetDomainId}/${editingResource._id}`,
        {
          title: editResourceTitle.trim(),
          content: editResourceContent.trim(),
        },
        getAuthConfig(),
      );

      const updated = response.data.resource;
      setResources((prev) =>
        prev.map((r) => (r._id === updated._id ? updated : r)),
      );
      setAllResources((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)),
      );

      logActivity(`Updated resource "${updated.title}"`, "resource");
      showToast("Resource updated and embedding recalculated!", "success");
      setEditingResource(null);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update resource",
        "error",
      );
    } finally {
      setSavingResourceEdit(false);
    }
  };

  // Delete Resource
  const confirmDeleteResource = (resource, e) => {
    if (e) e.stopPropagation();
    setResourceToDelete(resource);
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete) return;

    const targetDomainId =
      resourceToDelete.domainId?._id ||
      resourceToDelete.domainId ||
      selectedDomain?._id;

    try {
      setDeletingResource(true);

      // Delete the selected resource from the backend
      await axios.delete(
        `${API_BASE}/api/resources/${targetDomainId}/${resourceToDelete._id}`,
        getAuthConfig(),
      );

      // ---------------------------------------------------------
      // Refresh resources inside the currently opened domain
      // ---------------------------------------------------------
      if (selectedDomain && selectedDomain._id === targetDomainId) {
        const domainResponse = await axios.get(
          `${API_BASE}/api/resources/${targetDomainId}`,
          getAuthConfig(),
        );

        setResources(domainResponse.data);
      }

      // ---------------------------------------------------------
      // Refresh the All Resources catalog
      // ---------------------------------------------------------
      const allResourcesResponse = await axios.get(
        `${API_BASE}/api/resources/user/all`,
        getAuthConfig(),
      );

      setAllResources(allResourcesResponse.data);

      // ---------------------------------------------------------
      // Refresh domain resource counts
      // ---------------------------------------------------------
      await fetchDomains();

      // ---------------------------------------------------------
      // Activity log
      // ---------------------------------------------------------
      logActivity(`Deleted resource "${resourceToDelete.title}"`, "resource");

      // ---------------------------------------------------------
      // Success message
      // ---------------------------------------------------------
      showToast("Resource deleted successfully", "info");

      // Close confirmation modal
      setResourceToDelete(null);
    } catch (error) {
      console.error("Delete resource error:", error);

      showToast(
        error.response?.data?.message || "Failed to delete resource",
        "error",
      );
    } finally {
      setDeletingResource(false);
    }
  };

  // Dedicated Semantic Search
  const handleGlobalSemanticSearch = async (
    e,
    forcedQuery = null,
    speakTopResult = false,
  ) => {
    if (e) e.preventDefault();
    const query = (forcedQuery !== null ? forcedQuery : searchQuery).trim();
    if (!query) return;

    try {
      setSearching(true);
      setSearchError("");

      const payload = {
        query,
        minSimilarity: searchMinSimilarity / 100,
      };
      if (searchDomainFilter) {
        payload.domainId = searchDomainFilter;
      }

      const response = await axios.post(
        `${API_BASE}/api/search`,
        payload,
        getAuthConfig(),
      );
      const results = response.data.results || [];
      setSearchResults(results);
      setSearchStats(response.data.stats || null);

      logActivity(`Searched "${query}" (${results.length} matches)`, "search");

      // Voice Controller speaks aloud the relevant content and similarity percentage!
      if (speakTopResult) {
        const currentLang = voiceLangRef.current || voiceLang || "en";
        const langCode = currentLang.slice(0, 2);

        if (results.length > 0) {
          const top = results[0];
          const pct = Math.round((top.similarity || 0) * 100);
          const snippet = (top.content || top.title || "")
            .slice(0, 180)
            .replace(/\s+/g, " ");

          let speechText = `Found top match in ${top.domainName || "documents"}: ${top.title}, with ${pct} percent similarity. ${snippet}`;
          if (langCode === "ta") {
            speechText = `${top.title} ஆவணத்தில் ${pct} சதவீத பொருத்தத்துடன் தகவல் கண்டறியப்பட்டது: ${snippet}`;
          } else if (langCode === "es") {
            speechText = `Encontrado en ${top.domainName || "documentos"}: ${top.title}, con ${pct} por ciento de similitud. ${snippet}`;
          } else if (langCode === "hi") {
            speechText = `${top.title} में ${pct} प्रतिशत समानता के साथ परिणाम मिला: ${snippet}`;
          } else if (langCode === "fr") {
            speechText = `Trouvé dans ${top.domainName || "documents"}: ${top.title}, avec ${pct} pour cent de similarité. ${snippet}`;
          } else if (langCode === "de") {
            speechText = `Gefunden in ${top.domainName || "Dokumenten"}: ${top.title}, mit ${pct} Prozent Ähnlichkeit. ${snippet}`;
          }
          speakAloud(speechText);
        } else {
          let noMatchText = `No documents matched "${query}" with current similarity threshold.`;
          if (langCode === "ta") {
            noMatchText = `"${query}" தொடர்பாக எந்த ஆவணமும் கிடைக்கவில்லை.`;
          } else if (langCode === "es") {
            noMatchText = `No se encontraron documentos para "${query}".`;
          } else if (langCode === "hi") {
            noMatchText = `"${query}" के लिए कोई दस्तावेज नहीं मिला।`;
          }
          speakAloud(noMatchText);
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Semantic search failed";
      setSearchError(msg);
      setSearchResults([]);
      showToast(msg, "error");
      if (speakTopResult) {
        speakAloud(
          "Search failed. Please check your query or server connection.",
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const clearGlobalSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchStats(null);
    setSearchError("");
  };

  // Profile & Password Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setUpdatingProfile(true);
      const payload = { name: profileName.trim() };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const response = await axios.put(
        `${API_BASE}/api/auth/profile`,
        payload,
        getAuthConfig(),
      );
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setCurrentPassword("");
      setNewPassword("");
      showToast("Profile settings updated successfully!", "success");
      logActivity("Updated account profile", "profile");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update profile",
        "error",
      );
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Regenerate Embeddings
  const handleRegenerateEmbeddings = async () => {
    try {
      setRegeneratingEmbeddings(true);
      const response = await axios.post(
        `${API_BASE}/api/resources/generate-embeddings`,
        {},
        getAuthConfig(),
      );
      showToast(
        `Regenerated embeddings for ${response.data.updated} resources!`,
        "success",
      );
      logActivity("Regenerated all vector embeddings", "system");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to regenerate embeddings",
        "error",
      );
    } finally {
      setRegeneratingEmbeddings(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  const copyToClipboard = (text, label = "Content") => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "info");
  };

  // Computed Stats
  const totalResources = useMemo(() => {
    return domains.reduce((sum, d) => sum + (d.resourceCount || 0), 0);
  }, [domains]);

  const filteredDomains = useMemo(() => {
    if (!domainSearchFilter.trim()) return domains;
    const q = domainSearchFilter.toLowerCase();
    return domains.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q),
    );
  }, [domains, domainSearchFilter]);

  const displayedDomainResources = useMemo(() => {
    let list = domainSearchResults !== null ? domainSearchResults : resources;
    if (resourceFilterType !== "all") {
      list = list.filter((r) => r.type === resourceFilterType);
    }
    if (resourceSearchQuery.trim()) {
      const q = resourceSearchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.content || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [resources, domainSearchResults, resourceFilterType, resourceSearchQuery]);

  const displayedAllResources = useMemo(() => {
    let list = allResources;
    if (allResTypeFilter !== "all") {
      list = list.filter((r) => r.type === allResTypeFilter);
    }
    if (allResDomainFilter) {
      list = list.filter(
        (r) => (r.domainId?._id || r.domainId) === allResDomainFilter,
      );
    }
    if (allResSearchFilter.trim()) {
      const q = allResSearchFilter.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.content || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [allResources, allResTypeFilter, allResDomainFilter, allResSearchFilter]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-orb dashboard-orb-one"></div>
      <div className="dashboard-orb dashboard-orb-two"></div>

      {/* Mobile Navigation Toggle */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation"
      >
        {mobileMenuOpen ? "✕" : "☰"}
      </button>

      {/* Toast System */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success"
                ? "✓"
                : toast.type === "error"
                  ? "⚠"
                  : "ℹ"}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* ========================================================
               MULTILINGUAL VOICE HUD (FLOATING & DRAGGABLE CONTROLLER)
               ======================================================== */}
      <div
        ref={hudRef}
        className={`voice-hud ${isListening ? "listening" : ""} ${isDraggingHud ? "is-dragging" : ""}`}
        onPointerDown={handleHudPointerDown}
        style={
          hudPosition
            ? {
                left: `${hudPosition.x}px`,
                top: `${hudPosition.y}px`,
                bottom: "auto",
                right: "auto",
              }
            : undefined
        }
        title="Voice Control Panel • Drag anywhere to move on screen • Double-click handle to reset dock"
      >
        {/* Drag Handle Grip */}
        <div
          className="voice-drag-handle"
          title="Drag anywhere to reposition • Double-click to reset dock"
          onDoubleClick={() => {
            setHudPosition(null);
            try {
              localStorage.removeItem("voice_hud_pos");
            } catch {
              // ignore
            }
            showToast("Voice panel reset to default dock", "info");
          }}
        >
          ⠿
        </div>

        <button
          type="button"
          className={`voice-mic-btn ${isListening ? "active" : ""}`}
          onClick={toggleListening}
          title={
            isListening ? "Stop listening" : "Click to give voice commands"
          }
        >
          {isListening ? "⏹" : "🎤"}
        </button>

        <div className="voice-status-info">
          <span className={`voice-status-label ${isListening ? "active" : ""}`}>
            {isListening ? "LIVE LISTENING" : "VOICE CONTROL"}
          </span>
          <span
            className="voice-transcript-text"
            title={voiceTranscript || voiceStatus}
          >
            {voiceTranscript || voiceStatus}
          </span>
        </div>

        {/* Multilingual Selector */}
        <select
          className="voice-lang-select"
          value={voiceLang}
          onChange={(e) => {
            setVoiceLang(e.target.value);
            showToast(
              `Voice language switched to ${e.target.options[e.target.selectedIndex].text}`,
              "info",
            );
          }}
          title="Select spoken / recognition language"
        >
          <option value="en-US">English (US)</option>
          <option value="es-ES">Español (ES)</option>
          <option value="fr-FR">Français (FR)</option>
          <option value="de-DE">Deutsch (DE)</option>
          <option value="hi-IN">हिन्दी (Hindi)</option>
          <option value="zh-CN">中文 (Mandarin)</option>
          <option value="ja-JP">日本語 (Japanese)</option>
          <option value="ta-IN">தமிழ் (Tamil)</option>
        </select>

        {/* Speech Synthesis Audio Response Toggle */}
        <button
          type="button"
          className={`voice-speak-toggle ${voiceSpeechEnabled ? "active" : ""}`}
          onClick={() => {
            setVoiceSpeechEnabled(!voiceSpeechEnabled);
            showToast(
              voiceSpeechEnabled
                ? "Voice speech responses muted"
                : "Voice speech responses enabled",
              "info",
            );
          }}
          title={
            voiceSpeechEnabled
              ? "Mute audio response"
              : "Enable audio speech response"
          }
        >
          {voiceSpeechEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {/* ========================================================
               AI ASSISTANT FLOATING BUTTON & DRAWER
               ======================================================== */}
      <button
        type="button"
        className="ai-assistant-toggle"
        onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
        title="Open AI Assistant"
      >
        <span>✦</span>
        <span>AI Assistant</span>
      </button>

      {aiDrawerOpen && (
        <div
          ref={aiPanelRef}
          className={`ai-assistant-drawer ${isDraggingAiPanel ? "dragging" : ""} ${isAiMinimized ? "minimized" : ""}`}
          style={
            aiPanelPosition
              ? {
                  left: `${aiPanelPosition.x}px`,
                  top: `${aiPanelPosition.y}px`,
                  bottom: "auto",
                  right: "auto",
                }
              : undefined
          }
        >
          {/* Floating Draggable Header */}
          <div
            className="ai-drawer-header"
            onPointerDown={handleAiPanelPointerDown}
            title="Click and drag anywhere on this header to move AI Assistant across the screen"
          >
            <div className="ai-drawer-header-left">
              <div
                className="ai-drag-grip-icon"
                title="Drag to reposition panel"
              >
                ⠿
              </div>
              <div className="ai-avatar-badge">✦</div>
              <div className="ai-drawer-title">
                <strong>Semantic AI Assistant</strong>
                <span>
                  {showChatHistoryView
                    ? "Chat History Archive"
                    : `Active Session • ${formatChatDateTime().year}`}
                </span>
              </div>
            </div>

            <div className="ai-drawer-header-actions">
              {/* Toggle Chat History View */}
              <button
                type="button"
                className={`ai-header-btn ${showChatHistoryView ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChatHistoryView(!showChatHistoryView);
                  if (!showChatHistoryView) fetchChatHistory();
                }}
                title="View Saved AI Assistant Chat History"
              >
                📜 History ({chatHistoryList.length})
              </button>

              {/* Start New Chat Session */}
              <button
                type="button"
                className="ai-header-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartNewChat();
                }}
                title="Start New Chat Session"
              >
                + New
              </button>

              {/* Export Chat History with Date/Time/Year */}
              <button
                type="button"
                className="ai-header-btn icon-only"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportChatHistory();
                }}
                title="Download / Export Chat History with Date, Time and Year"
              >
                📥
              </button>

              {/* Speech Status indicator if currently speaking */}
              {isSpeaking && (
                <button
                  type="button"
                  className="ai-speech-status-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopSpeaking();
                  }}
                  title="AI is speaking aloud. Click to stop audio."
                >
                  <span className="pulse-dot">●</span>
                  <span>Stop ⏹</span>
                </button>
              )}

              {/* Minimize / Expand Toggle */}
              <button
                type="button"
                className="ai-header-btn icon-only"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAiMinimized(!isAiMinimized);
                }}
                title={isAiMinimized ? "Expand AI Panel" : "Minimize AI Panel"}
              >
                {isAiMinimized ? "⤢" : "🗕"}
              </button>

              {/* Close Panel */}
              <button
                type="button"
                className="ai-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  stopSpeaking();
                  setAiDrawerOpen(false);
                }}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* If Minimized, show clean compact bar */}
          {isAiMinimized ? (
            <div
              className="ai-minimized-hint"
              onClick={() => setIsAiMinimized(false)}
              title="Click to restore AI Assistant window"
            >
              <span>✦ AI Assistant Minimized • Click to expand</span>
            </div>
          ) : showChatHistoryView ? (
            /* CHAT HISTORY VIEW */
            <div className="ai-history-container">
              <div className="ai-history-toolbar">
                <div className="ai-history-toolbar-left">
                  <strong>Saved Chat History</strong>
                  <span>Organized by Date, Time & Year</span>
                </div>
                <button
                  type="button"
                  className="ai-history-back-btn"
                  onClick={() => setShowChatHistoryView(false)}
                >
                  ← Back to Chat
                </button>
              </div>

              <div className="ai-history-list">
                {loadingChatHistory ? (
                  <div className="ai-history-empty">
                    Loading saved chat history...
                  </div>
                ) : chatHistoryList.length === 0 ? (
                  <div className="ai-history-empty">
                    <p>No archived chat sessions yet.</p>
                    <small>
                      Your conversations will be saved here automatically with
                      date, time, and year.
                    </small>
                  </div>
                ) : (
                  chatHistoryList.map((session, index) => (
                    <div
                      key={session.sessionId || index}
                      className={`ai-history-item ${session.sessionId === currentSessionId ? "active" : ""}`}
                      onClick={() => handleLoadChatSession(session)}
                    >
                      <div className="ai-history-item-top">
                        <div className="ai-history-badges-row">
                          <span className="ai-history-badge date">
                            📅{" "}
                            {session.dateFormatted ||
                              session.dateString ||
                              "27 Sep 2026"}
                          </span>
                          <span className="ai-history-badge time">
                            🕒{" "}
                            {session.timeFormatted ||
                              session.timeString ||
                              "02:45 PM"}
                          </span>
                          <span className="ai-history-badge year">
                            {session.year || 2026}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="ai-history-del-btn"
                          onClick={(e) =>
                            handleDeleteChatSession(session.sessionId, e)
                          }
                          title="Delete this session from history"
                        >
                          🗑
                        </button>
                      </div>

                      <div className="ai-history-title">
                        {session.title || "AI Assistant Discussion"}
                      </div>

                      <div className="ai-history-snippet">
                        {session.messages && session.messages.length > 1
                          ? session.messages[1].content.slice(0, 90) + "..."
                          : session.messages?.[0]?.content?.slice(0, 90) ||
                            "No preview"}
                      </div>

                      <div className="ai-history-footer">
                        <span>💬 {session.messages?.length || 0} messages</span>
                        <span className="ai-history-load-action">
                          {session.sessionId === currentSessionId
                            ? "● Active Now"
                            : "Open Session →"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT VIEW */
            <>
              <div className="ai-chat-body">
                {aiMessages.map((msg) => (
                  <div key={msg.id} className={`ai-message ${msg.role}`}>
                    <div className="ai-msg-bubble">{msg.content}</div>

                    {/* Date, Time, and Year Stamp */}
                    <div className="ai-msg-timestamp">
                      <span>
                        📅{" "}
                        {msg.dateTimeDisplay ||
                          (msg.timestamp
                            ? formatChatDateTime(msg.timestamp).display
                            : formatChatDateTime().display)}
                      </span>
                    </div>

                    {msg.role === "assistant" && (
                      <div className="ai-msg-actions-row">
                        <button
                          type="button"
                          className="ai-speak-btn"
                          onClick={() => speakAloud(msg.content)}
                          title="Read response aloud"
                        >
                          🔊 Listen
                        </button>
                      </div>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="ai-msg-sources">
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            fontWeight: 700,
                            width: "100%",
                          }}
                        >
                          CITATIONS & SOURCES:
                        </span>
                        {msg.sources.map((src, i) => (
                          <span key={i} className="ai-source-chip">
                            ◈ {src.domainName}: {src.title} (
                            {src.similarity || "Relevant"})
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="ai-suggestions-row">
                        {msg.suggestions.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            className="ai-suggestion-btn"
                            onClick={() => sendAiMessage(sug)}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {aiLoading && (
                  <div className="ai-message assistant">
                    <div className="ai-msg-bubble" style={{ color: "#64748b" }}>
                      ✦ Clearing doubts & preparing answer...
                    </div>
                  </div>
                )}
              </div>

              {isListening && (
                <div className="ai-listening-indicator">
                  <span className="pulse-mic">🎙️</span>
                  <span>
                    Listening... Speak your doubt or error question to the AI
                    Assistant!
                  </span>
                </div>
              )}

              <div className="ai-chat-input-bar">
                <input
                  type="text"
                  placeholder="Ask anything to clear doubts or troubleshoot errors..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendAiMessage();
                  }}
                />

                <button
                  type="button"
                  className={`ai-mic-btn ${isListening ? "active" : ""}`}
                  onClick={toggleListening}
                  title={
                    isListening
                      ? "Listening... Click to stop"
                      : "Speak question via microphone"
                  }
                >
                  🎤
                </button>

                <button
                  type="button"
                  className="ai-send-btn"
                  onClick={() => sendAiMessage()}
                  disabled={aiLoading}
                  title="Send question to AI Assistant"
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">✦</div>
          <div>
            <div className="sidebar-title">
              SEMANTIC<span>SEARCH</span>
            </div>
            <div className="sidebar-subtitle">Enterprise Knowledge Engine</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">WORKSPACE</div>

          <button
            className={`nav-item ${currentTab === "dashboard" && !selectedDomain ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("dashboard");
              setMobileMenuOpen(false);
            }}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={`nav-item ${currentTab === "domains" || selectedDomain ? "active" : ""}`}
            onClick={() => {
              setCurrentTab("domains");
              setMobileMenuOpen(false);
            }}
          >
            <span>◈</span>
            Knowledge Domains
          </button>

          <button
            className={`nav-item ${currentTab === "search" ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("search");
              setMobileMenuOpen(false);
            }}
          >
            <span>⌕</span>
            Semantic Search
          </button>

          <button
            className={`nav-item ${currentTab === "resources" ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("resources");
              setMobileMenuOpen(false);
            }}
          >
            <span>▤</span>
            All Resources
          </button>

          <button
            className={`nav-item ${currentTab === "knowledge-gaps" ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("knowledge-gaps");
              setMobileMenuOpen(false);
              fetchKnowledgeGaps();
            }}
          >
            <span>⚠</span>
            Knowledge Gaps
          </button>

          <div className="nav-label" style={{ marginTop: "24px" }}>
            PREFERENCES
          </div>

          <button
            className={`nav-item ${aiDrawerOpen ? "active" : ""}`}
            onClick={() => {
              setAiDrawerOpen(true);
              setMobileMenuOpen(false);
            }}
          >
            <span>✦</span>
            AI Assistant
          </button>

          <div className="nav-label second-label">SYSTEM & SUPPORT</div>

          <button
            className={`nav-item ${currentTab === "help" ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("help");
              setMobileMenuOpen(false);
            }}
          >
            <span>❓</span>
            Help & Voice Guide
          </button>

          <button
            className={`nav-item ${currentTab === "settings" ? "active" : ""}`}
            onClick={() => {
              setSelectedDomain(null);
              setCurrentTab("settings");
              setMobileMenuOpen(false);
            }}
          >
            <span>⚙</span>
            Settings & Diagnostics
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="user-info">
              <strong>{user?.name || "User"}</strong>
              <span>{user?.email || "Account"}</span>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* 1. SELECTED DOMAIN DETAIL VIEW */}
        {selectedDomain ? (
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">
                  Workspace /{" "}
                  <span
                    style={{ cursor: "pointer", color: "#2563eb" }}
                    onClick={goBackToDashboard}
                  >
                    Knowledge Domains
                  </span>{" "}
                  / {selectedDomain.name}
                </div>
                <h1>{selectedDomain.name}</h1>
                <p>
                  {selectedDomain.description ||
                    "Manage the documents and knowledge entries inside this domain."}
                </p>
              </div>

              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                <button
                  className="create-button"
                  onClick={() => setShowResourceModal(true)}
                >
                  <span>+</span> Add Resource
                </button>
                <button className="cancel-button" onClick={goBackToDashboard}>
                  ← Back to Domains
                </button>
              </div>
            </header>

            {/* In-Domain Semantic Search Panel */}
            <form className="search-panel" onSubmit={handleDomainSearch}>
              <div className="search-icon">⌕</div>
              <input
                type="text"
                value={domainSearchInput}
                onChange={(e) => setDomainSearchInput(e.target.value)}
                placeholder={`Search by meaning within ${selectedDomain.name}...`}
              />
              {domainSearchResults !== null && (
                <button
                  type="button"
                  className="cancel-button"
                  style={{ height: "40px" }}
                  onClick={clearDomainSearch}
                >
                  Clear
                </button>
              )}
              <button type="submit" disabled={searchingInDomain}>
                {searchingInDomain ? "Searching..." : "Search"}
                <span>→</span>
              </button>
            </form>

            {domainSearchResults !== null && (
              <div className="search-stats-banner">
                <span>
                  Showing {domainSearchResults.length} semantic matches in "
                  {selectedDomain.name}"
                </span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#166534",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onClick={clearDomainSearch}
                >
                  Reset to all resources ✕
                </button>
              </div>
            )}

            {/* Filters Toolbar */}
            <div className="filter-toolbar">
              <div className="filter-group">
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  TYPE:
                </span>
                {["all", "faq", "text", "pdf"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip-btn ${resourceFilterType === type ? "active" : ""}`}
                    onClick={() => setResourceFilterType(type)}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="filter-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Filter by title/text..."
                  value={resourceSearchQuery}
                  onChange={(e) => setResourceSearchQuery(e.target.value)}
                />
                {resourceSearchQuery && (
                  <button
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                    }}
                    onClick={() => setResourceSearchQuery("")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Domain Resources Grid */}
            <section className="domain-grid">
              {loadingResources ? (
                <div className="domain-card">
                  <h3>Loading domain resources...</h3>
                  <p>Fetching embedded vectors from knowledge storage.</p>
                </div>
              ) : displayedDomainResources.length > 0 ? (
                displayedDomainResources.map((resource) => (
                  <div className="domain-card" key={resource._id}>
                    <div className="domain-card-top">
                      <div className="domain-icon">
                        {resource.type === "faq"
                          ? "?"
                          : resource.type === "pdf"
                            ? "📄"
                            : "▤"}
                      </div>

                      <div className="card-actions-row">
                        <button
                          className="action-icon-btn primary"
                          title="View Full Content"
                          onClick={() => setViewingResource(resource)}
                        >
                          👁
                        </button>
                        {resource.type !== "pdf" && (
                          <button
                            className="action-icon-btn"
                            title="Edit Resource"
                            onClick={(e) => openEditResourceModal(resource, e)}
                          >
                            ✎
                          </button>
                        )}
                        <button
                          className="action-icon-btn danger"
                          title="Delete Resource"
                          onClick={(e) => confirmDeleteResource(resource, e)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <span className={`badge badge-${resource.type}`}>
                        {resource.type}
                      </span>
                      {resource.similarity !== undefined && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            width: "100%",
                          }}
                        >
                          <div
                            style={{
                              padding: "10px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              background: "#f8fafc",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                  color: "#334155",
                                }}
                              >
                                Search Quality
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "bold",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  backgroundColor:
                                    resource.confidenceLevel === "High"
                                      ? "#dcfce7"
                                      : resource.confidenceLevel === "Medium"
                                        ? "#fef08a"
                                        : "#fee2e2",
                                  color:
                                    resource.confidenceLevel === "High"
                                      ? "#166534"
                                      : resource.confidenceLevel === "Medium"
                                        ? "#854d0e"
                                        : "#991b1b",
                                }}
                              >
                                {resource.confidenceLevel || "Low"} Confidence
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "10px",
                                fontSize: "11px",
                                color: "#64748b",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <span>Keyword</span>
                                <b style={{ color: "#0f172a" }}>
                                  {((resource.keywordScore || 0) * 100).toFixed(
                                    1,
                                  )}
                                  %
                                </b>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <span>Semantic</span>
                                <b style={{ color: "#0f172a" }}>
                                  {(
                                    (resource.semanticScore || 0) * 100
                                  ).toFixed(1)}
                                  %
                                </b>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <span>Hybrid</span>
                                <b style={{ color: "#0f172a" }}>
                                  {(
                                    (resource.hybridScore ||
                                      resource.similarity ||
                                      0) * 100
                                  ).toFixed(1)}
                                  %
                                </b>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <h3>{resource.title}</h3>
                    <p className="resource-card-content">
                      {resource.content || "No text content available."}
                    </p>

                    <div className="domain-footer">
                      {resource.type === "pdf" ? (
                        <a
                          href={`${API_BASE}${resource.fileUrl || `/uploads/${resource.fileName}`}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-file-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📥 Open PDF File
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              resource.content,
                              "Resource content",
                            )
                          }
                          style={{
                            border: "none",
                            background: "none",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Copy Text
                        </button>
                      )}

                      <button
                        className="action-icon-btn"
                        onClick={() => setViewingResource(resource)}
                        style={{
                          fontSize: "11px",
                          width: "auto",
                          padding: "0 10px",
                        }}
                      >
                        Expand ↗
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="domain-card" style={{ gridColumn: "1 / -1" }}>
                  <div className="domain-card-top">
                    <div className="domain-icon">◌</div>
                  </div>
                  <h3>No resources matched</h3>
                  <p>
                    Try clearing your filter or add a new FAQ, text snippet, or
                    PDF document.
                  </p>
                  <div className="domain-footer" style={{ marginTop: "20px" }}>
                    <button
                      className="create-button"
                      onClick={() => setShowResourceModal(true)}
                    >
                      + Add Resource
                    </button>
                  </div>
                </div>
              )}

              <button
                className="add-domain-card"
                onClick={() => setShowResourceModal(true)}
              >
                <div className="add-icon">+</div>
                <strong>Add a new resource</strong>
                <span>Upload FAQ, structured text, or PDF documents</span>
              </button>
            </section>
          </>
        ) : currentTab === "dashboard" ? (
          /* 2. OVERVIEW DASHBOARD VIEW */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">Workspace / Dashboard</div>
                <h1>
                  Welcome back, <span>{user?.name || "Explorer"}</span>
                </h1>
                <p>
                  Discover knowledge across enterprise documents through neural
                  semantic search and voice commands.
                </p>
              </div>

              <div className="header-profile">
                <div className="header-avatar">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <strong>{user?.name || "User"}</strong>
                  <span>Workspace Admin</span>
                </div>
              </div>
            </header>

            {/* Quick Semantic Search Bar */}
            <form
              className="search-panel"
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  setCurrentTab("search");
                  handleGlobalSemanticSearch(e);
                }
              }}
            >
              <div className="search-icon">⌕</div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all knowledge domains by meaning (or speak via microphone below)..."
              />
              <button type="submit">
                Search <span>→</span>
              </button>
            </form>

            {/* High-Level Metric Cards */}
            <section className="stats-grid">
              <div
                className="stat-card"
                onClick={() => setCurrentTab("domains")}
                style={{ cursor: "pointer" }}
              >
                <div className="stat-icon blue">◈</div>
                <div>
                  <span>Knowledge Domains</span>
                  <strong>{loadingDomains ? "..." : domains.length}</strong>
                </div>
                <div className="stat-trend">Manage →</div>
              </div>

              <div
                className="stat-card"
                onClick={() => setCurrentTab("resources")}
                style={{ cursor: "pointer" }}
              >
                <div className="stat-icon purple">▤</div>
                <div>
                  <span>Total Resources</span>
                  <strong>{loadingDomains ? "..." : totalResources}</strong>
                </div>
                <div className="stat-trend">Indexed</div>
              </div>

              <div
                className="stat-card"
                onClick={() => setCurrentTab("search")}
                style={{ cursor: "pointer" }}
              >
                <div className="stat-icon cyan">✦</div>
                <div>
                  <span>Multilingual Engine</span>
                  <strong>8 Languages</strong>
                </div>
                <div className="stat-trend">Voice Active</div>
              </div>
            </section>

            {/* Knowledge Domains Section */}
            <section className="section-header" style={{ marginTop: "40px" }}>
              <div>
                <h2>Knowledge Domains</h2>
                <p>
                  Organize information into domain-specific knowledge bases.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="create-button"
                  onClick={() => setShowCreateModal(true)}
                >
                  <span>+</span> Create Domain
                </button>
              </div>
            </section>

            {domainError && <div className="domain-error">{domainError}</div>}

            <section className="domain-grid">
              {loadingDomains ? (
                <div className="domain-card">
                  <h3>Loading knowledge collections...</h3>
                  <p>Connecting to vector storage...</p>
                </div>
              ) : domains.length > 0 ? (
                domains.slice(0, 5).map((domain) => (
                  <div
                    className="domain-card"
                    key={domain._id}
                    onClick={() => openDomain(domain)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="domain-card-top">
                      <div className="domain-icon">◈</div>
                      <div className="card-actions-row">
                        <button
                          className="action-icon-btn"
                          title="Edit domain"
                          onClick={(e) => openEditDomainModal(domain, e)}
                        >
                          ✎
                        </button>
                        <button
                          className="action-icon-btn danger"
                          title="Delete domain"
                          onClick={(e) => confirmDeleteDomain(domain, e)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <h3>{domain.name}</h3>
                    <p>{domain.description || "No description provided."}</p>

                    <div className="domain-footer">
                      <span>
                        <b>{domain.resourceCount || 0}</b> Resources
                      </span>
                      <button onClick={() => openDomain(domain)}>
                        Open Domain →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="domain-card">
                  <div className="domain-card-top">
                    <div className="domain-icon">◈</div>
                  </div>
                  <h3>No domains yet</h3>
                  <p>
                    Create your first domain to begin organizing FAQs,
                    documents, and PDFs.
                  </p>
                </div>
              )}

              <button
                className="add-domain-card"
                onClick={() => setShowCreateModal(true)}
              >
                <div className="add-icon">+</div>
                <strong>Create a new domain</strong>
                <span>Start a new knowledge collection</span>
              </button>
            </section>

            {/* Recent Activity & Quick Actions */}
            <section className="bottom-grid" style={{ marginTop: "40px" }}>
              <div className="activity-card">
                <div className="section-title">
                  <div>
                    <h2>Recent Activity</h2>
                    <p>Your recent searches, additions, and domain updates</p>
                  </div>
                  <span className="live-indicator">
                    <i></i> Live
                  </span>
                </div>

                {activities.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "14px",
                    }}
                  >
                    {activities.slice(0, 5).map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "#f8fafc",
                          borderRadius: "10px",
                          border: "1px solid #edf2f7",
                          fontSize: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>
                            {act.meta === "search"
                              ? "⌕"
                              : act.meta === "domain"
                                ? "◈"
                                : "▤"}
                          </span>
                          <span style={{ color: "#1e293b", fontWeight: 600 }}>
                            {act.action}
                          </span>
                        </div>
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                          {act.time}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-activity">
                    <div className="empty-icon">◌</div>
                    <strong>No recent activity</strong>
                    <span>
                      Add resources or perform searches to see live activity
                      here.
                    </span>
                  </div>
                )}
              </div>

              <div className="quick-card">
                <div className="section-title">
                  <div>
                    <h2>Quick Actions</h2>
                    <p>Shortcuts for common operations</p>
                  </div>
                </div>

                <button
                  className="quick-action"
                  onClick={() => setAiDrawerOpen(true)}
                >
                  <span className="quick-icon blue">✦</span>
                  <div>
                    <strong>Ask AI Assistant</strong>
                    <small>Chat with your knowledge base</small>
                  </div>
                  <span>→</span>
                </button>

                <button
                  className="quick-action"
                  onClick={() => toggleListening()}
                >
                  <span className="quick-icon purple">🎤</span>
                  <div>
                    <strong>Voice Control</strong>
                    <small>
                      {isListening ? "Listening..." : "Click to speak"}
                    </small>
                  </div>
                  <span>→</span>
                </button>

                <button
                  className="quick-action"
                  onClick={() => setCurrentTab("help")}
                >
                  <span className="quick-icon cyan">❓</span>
                  <div>
                    <strong>Help & Voice Guide</strong>
                    <small>Browse cheatsheet & tutorials</small>
                  </div>
                  <span>→</span>
                </button>
              </div>
            </section>
          </>
        ) : currentTab === "domains" ? (
          /* 3. DEDICATED DOMAINS TAB */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">Workspace / Knowledge Domains</div>
                <h1>
                  Knowledge <span>Domains</span>
                </h1>
                <p>
                  Create, organize, and manage knowledge collections across your
                  company or project.
                </p>
              </div>

              <button
                className="create-button"
                onClick={() => setShowCreateModal(true)}
              >
                <span>+</span> Create Domain
              </button>
            </header>

            <div className="filter-toolbar">
              <div className="filter-group">
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  TOTAL: {domains.length} DOMAINS
                </span>
              </div>
              <div className="filter-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Filter domains by name..."
                  value={domainSearchFilter}
                  onChange={(e) => setDomainSearchFilter(e.target.value)}
                />
                {domainSearchFilter && (
                  <button
                    style={{
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                    }}
                    onClick={() => setDomainSearchFilter("")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <section className="domain-grid">
              {filteredDomains.map((domain) => (
                <div
                  className="domain-card"
                  key={domain._id}
                  onClick={() => openDomain(domain)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="domain-card-top">
                    <div className="domain-icon">◈</div>
                    <div className="card-actions-row">
                      <button
                        className="action-icon-btn"
                        title="Edit domain"
                        onClick={(e) => openEditDomainModal(domain, e)}
                      >
                        ✎
                      </button>
                      <button
                        className="action-icon-btn danger"
                        title="Delete domain"
                        onClick={(e) => confirmDeleteDomain(domain, e)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <h3>{domain.name}</h3>
                  <p>{domain.description || "No description provided."}</p>

                  <div className="domain-footer">
                    <span>
                      <b>{domain.resourceCount || 0}</b> Resources
                    </span>
                    <button onClick={() => openDomain(domain)}>
                      Open Domain →
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="add-domain-card"
                onClick={() => setShowCreateModal(true)}
              >
                <div className="add-icon">+</div>
                <strong>Create a new domain</strong>
                <span>Add another knowledge collection</span>
              </button>
            </section>
          </>
        ) : currentTab === "search" ? (
          /* 4. DEDICATED SEMANTIC SEARCH CONSOLE */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">
                  Workspace / Semantic Search Engine
                </div>
                <h1>
                  Semantic <span>Knowledge Discovery</span>
                </h1>
                <p>
                  Search beyond keywords: find answers based on meaning,
                  context, and semantic similarity.
                </p>
              </div>
            </header>

            {/* Search Input Bar */}
            <form
              className="search-panel"
              onSubmit={(e) => handleGlobalSemanticSearch(e)}
            >
              <div className="search-icon">⌕</div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Describe what you are looking for in plain language..."
                autoFocus
              />
              {searchResults.length > 0 && (
                <button
                  type="button"
                  className="cancel-button"
                  style={{ height: "40px" }}
                  onClick={clearGlobalSearch}
                >
                  Clear
                </button>
              )}
              <button type="submit" disabled={searching}>
                {searching ? "Analyzing..." : "Search Meaning"}
                <span>→</span>
              </button>
            </form>

            {/* Search Controls Bar */}
            <div className="search-controls-bar">
              <label>
                Domain:
                <select
                  value={searchDomainFilter}
                  onChange={(e) => setSearchDomainFilter(e.target.value)}
                >
                  <option value="">All Knowledge Domains</option>
                  {domains.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ marginLeft: "auto" }}>
                Min Match: {searchMinSimilarity}%
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={searchMinSimilarity}
                  onChange={(e) =>
                    setSearchMinSimilarity(Number(e.target.value))
                  }
                />
              </label>
            </div>

            {/* Query Suggestions */}
            <div className="search-chips-row">
              <span
                style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}
              >
                Suggestions:
              </span>
              {[
                "What is the policy for leave?",
                "How to configure API authentication?",
                "Troubleshooting server connection",
                "Employee benefits overview",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="search-chip"
                  onClick={(e) => {
                    setSearchQuery(s);
                    handleGlobalSemanticSearch(e, s);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Stats Banner */}
            {searchStats && (
              <div className="search-stats-banner">
                <span>
                  Found {searchStats.totalCount} matches in {searchStats.timeMs}
                  ms
                </span>
                <span>Highest Similarity: {searchStats.maxSimilarity}%</span>
              </div>
            )}

            {searchError && <div className="domain-error">{searchError}</div>}

            {/* Search Results Display */}
            <section style={{ marginTop: "24px" }}>
              {searching ? (
                <div className="domain-card">
                  <h3>Generating vector embeddings...</h3>
                  <p>
                    Computing cosine similarity across knowledge vectors in
                    real-time.
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result, idx) => {
                  const displayScore =
                    result.hybridScore ?? result.similarity ?? 0;

                  return (
                    <div className="search-result-card" key={result._id || idx}>
                      <div className="search-result-top">
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <span className={`badge badge-${result.type}`}>
                            {result.type}
                          </span>

                          <span
                            className="badge badge-domain"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              const target = domains.find(
                                (d) => d._id === result.domainId,
                              );

                              if (target) {
                                openDomain(target);
                              }
                            }}
                          >
                            ◈ {result.domainName || "Domain"}
                          </span>
                        </div>

                        {/* Main Hybrid Match Score */}
                        <div
                          className={`similarity-badge ${
                            displayScore >= 0.8
                              ? "high"
                              : displayScore >= 0.5
                                ? "medium"
                                : "low"
                          }`}
                        >
                          <div className="similarity-bar-bg">
                            <div
                              className="similarity-bar-fill"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, displayScore * 100),
                                )}%`,
                              }}
                            ></div>
                          </div>

                          <span>{(displayScore * 100).toFixed(1)}% match</span>
                        </div>
                      </div>

                      <h3
                        style={{
                          margin: "0 0 6px",
                          fontSize: "16px",
                          color: "#0f172a",
                        }}
                      >
                        {result.title}
                      </h3>

                      <p className="search-result-body">
                        {result.content || "No text content available."}
                      </p>

                      {/* Explainable Results & Search Quality */}
                      <div
                        style={{
                          marginTop: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {result.matchReason && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#059669",
                              background: "#d1fae5",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            🔍 <b>Why this matched:</b> {result.matchReason}
                          </div>
                        )}

                        {/* Search Quality Evaluation */}
                        <div
                          style={{
                            padding: "10px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            background: "#f8fafc",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "bold",
                                color: "#334155",
                              }}
                            >
                              Search Quality Evaluation
                            </span>

                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "bold",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor:
                                  result.confidenceLevel === "High"
                                    ? "#dcfce7"
                                    : result.confidenceLevel === "Medium"
                                      ? "#fef08a"
                                      : "#fee2e2",
                                color:
                                  result.confidenceLevel === "High"
                                    ? "#166534"
                                    : result.confidenceLevel === "Medium"
                                      ? "#854d0e"
                                      : "#991b1b",
                              }}
                            >
                              {result.confidenceLevel || "Low"} Confidence
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "20px",
                              fontSize: "11px",
                              color: "#64748b",
                            }}
                          >
                            {/* Keyword Score */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span>Keyword Match</span>

                              <b style={{ color: "#0f172a" }}>
                                {((result.keywordScore ?? 0) * 100).toFixed(1)}%
                              </b>
                            </div>

                            {/* Semantic Score */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span>Semantic Match</span>

                              <b style={{ color: "#0f172a" }}>
                                {((result.semanticScore ?? 0) * 100).toFixed(1)}
                                %
                              </b>
                            </div>

                            {/* Hybrid Score */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span>Hybrid Accuracy</span>

                              <b style={{ color: "#0f172a" }}>
                                {(
                                  (result.hybridScore ??
                                    result.similarity ??
                                    0) * 100
                                ).toFixed(1)}
                                %
                              </b>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Result Footer */}
                      <div className="search-result-footer">
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                          }}
                        >
                          {result.type === "pdf" && (
                            <a
                              href={`${API_BASE}${
                                result.fileUrl || `/uploads/${result.fileName}`
                              }`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-file-link"
                            >
                              📥 View PDF Source
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(result.content, "Result content")
                            }
                            style={{
                              border: "none",
                              background: "none",
                              color: "#2563eb",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "11px",
                            }}
                          >
                            Copy Content
                          </button>
                        </div>

                        {/* Search Feedback */}
                        <div
                          style={{
                            display: "flex",
                            gap: "5px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleFeedback(searchQuery, 1)}
                            style={{
                              border: "1px solid #e2e8f0",
                              background: "white",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                            title="Good result"
                          >
                            👍
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFeedback(searchQuery, -1)}
                            style={{
                              border: "1px solid #e2e8f0",
                              background: "white",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                            title="Bad result"
                          >
                            👎
                          </button>
                        </div>

                        {/* Jump to Domain */}
                        <button
                          className="cancel-button"
                          style={{
                            height: "32px",
                            padding: "0 12px",
                            fontSize: "11px",
                          }}
                          onClick={() => {
                            const target = domains.find(
                              (d) => d._id === result.domainId,
                            );

                            if (target) {
                              openDomain(target);
                            }
                          }}
                        >
                          Jump to Domain →
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : searchStats && searchStats.totalCount === 0 ? (
                <div className="domain-card">
                  <div className="domain-card-top">
                    <div className="domain-icon">⌕</div>
                  </div>

                  <h3>No resources matched this query</h3>

                  <p>
                    Try reducing the minimum match slider or searching with
                    different contextual phrases.
                  </p>
                </div>
              ) : null}
            </section>
          </>
        ) : currentTab === "resources" ? (
          /* 5. ALL RESOURCES CATALOG TAB */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">
                  Workspace / Master Resource Catalog
                </div>
                <h1>
                  All <span>Knowledge Resources</span>
                </h1>
                <p>
                  Unified catalog of all FAQs, text documents, and uploaded PDF
                  files across all domains.
                </p>
              </div>

              <button
                className="create-button"
                onClick={() => fetchAllResources()}
                disabled={loadingAllResources}
              >
                ⟳ Refresh Index
              </button>
            </header>

            {/* Toolbar */}
            <div className="filter-toolbar">
              <div className="filter-group">
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  TYPE:
                </span>
                {["all", "faq", "text", "pdf"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-chip-btn ${allResTypeFilter === type ? "active" : ""}`}
                    onClick={() => setAllResTypeFilter(type)}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="filter-group">
                <select
                  value={allResDomainFilter}
                  onChange={(e) => setAllResDomainFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                  }}
                >
                  <option value="">All Domains</option>
                  {domains.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Filter by title/content..."
                  value={allResSearchFilter}
                  onChange={(e) => setAllResSearchFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Resources Table */}
            <div className="resources-table-wrapper">
              <table className="resources-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Domain</th>
                    <th>Content Preview</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAllResources ? (
                    <tr>
                      <td
                        colSpan="6"
                        style={{ textAlign: "center", padding: "30px" }}
                      >
                        Loading master catalog...
                      </td>
                    </tr>
                  ) : displayedAllResources.length > 0 ? (
                    displayedAllResources.map((res) => (
                      <tr key={res._id}>
                        <td>
                          <span className={`badge badge-${res.type}`}>
                            {res.type}
                          </span>
                        </td>
                        <td className="resource-title-cell" title={res.title}>
                          {res.title}
                        </td>
                        <td>
                          <span className="badge badge-domain">
                            {res.domainName || "Domain"}
                          </span>
                        </td>
                        <td
                          className="resource-content-preview-cell"
                          title={res.content}
                        >
                          {res.content ||
                            (res.type === "pdf" ? "PDF Document" : "-")}
                        </td>
                        <td style={{ color: "#94a3b8", fontSize: "11px" }}>
                          {new Date(res.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="card-actions-row"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              className="action-icon-btn primary"
                              title="View"
                              onClick={() => setViewingResource(res)}
                            >
                              👁
                            </button>
                            {res.type !== "pdf" && (
                              <button
                                className="action-icon-btn"
                                title="Edit"
                                onClick={(e) => openEditResourceModal(res, e)}
                              >
                                ✎
                              </button>
                            )}
                            {res.type === "pdf" && (
                              <a
                                href={`${API_BASE}${res.fileUrl || `/uploads/${res.fileName}`}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-icon-btn"
                                title="Open PDF"
                              >
                                📥
                              </a>
                            )}
                            <button
                              className="action-icon-btn danger"
                              title="Delete"
                              onClick={(e) => confirmDeleteResource(res, e)}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "#94a3b8",
                        }}
                      >
                        No resources found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : currentTab === "help" ? (
          /* 6. HELP DASHBOARD & VOICE MANUAL TAB */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">Workspace / Help & Voice Guide</div>
                <h1>
                  Platform <span>Help Center & Guide</span>
                </h1>
                <p>
                  Comprehensive manual for multilingual voice commands, semantic
                  neural search, and AI assistant.
                </p>
              </div>
            </header>

            {/* Interactive Semantic Search Explainer */}
            <div className="interactive-demo-card">
              <h3>🧠 How Does Semantic Search Work?</h3>
              <p>
                Traditional search engines look for exact words. If you search
                for "vacation leave", traditional search fails if the document
                only says "time off". This platform uses a Hugging Face
                Transformer model (<code>all-MiniLM-L6-v2</code>) to compute{" "}
                <strong>384-dimensional dense vectors</strong> representing
                mathematical meaning, then compares them using{" "}
                <strong>Cosine Similarity</strong>.
              </p>
              <div className="comparison-table-wrapper">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Traditional Keyword Search</th>
                      <th>Semantic Search (This Platform)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Mechanism</strong>
                      </td>
                      <td>
                        Exact string substring matching (
                        <code>LIKE '%query%'</code>)
                      </td>
                      <td>Dense Vector Cosine Similarity (Transformer AI)</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Synonyms & Context</strong>
                      </td>
                      <td>Fails unless exact synonyms are configured</td>
                      <td>
                        Understands context (e.g. "holiday" = "vacation" = "time
                        off")
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Voice & Multilingual</strong>
                      </td>
                      <td>English text-only</td>
                      <td>
                        Speech-to-text + Text-to-speech in 8 languages
                        (including தமிழ் Tamil)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step-by-Step Quickstart */}
            <h3 className="help-section-title">
              🚀 Platform Quickstart in 4 Steps
            </h3>
            <div className="step-cards-row">
              <div className="step-card">
                <div className="step-num-badge">1</div>
                <h4>Create a Domain</h4>
                <p>
                  Organize topics into dedicated collections like "HR Policies",
                  "Engineering", or "Legal".
                </p>
              </div>

              <div className="step-card">
                <div className="step-num-badge">2</div>
                <h4>Add FAQs or PDFs</h4>
                <p>
                  Upload PDF documents or add FAQ Q&A pairs. Text is
                  automatically parsed and vectors generated.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num-badge">3</div>
                <h4>Search by Meaning</h4>
                <p>
                  Use the search bar or microphone to ask questions in plain
                  natural language.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num-badge">4</div>
                <h4>Ask the AI Assistant</h4>
                <p>
                  Open the AI Assistant drawer to get summarized answers citing
                  your documents directly.
                </p>
              </div>
            </div>

            {/* Voice Control Cheatsheet */}
            <h3 className="help-section-title">
              🎤 Multilingual Voice Commands Cheatsheet (8 Languages)
            </h3>
            <p
              style={{ color: "#64748b", fontSize: "12px", margin: "0 0 16px" }}
            >
              Click the microphone button at the bottom of the screen or say any
              of the following commands in English, தமிழ் (Tamil), Español,
              Français, Deutsch, हिन्दी, 中文, or 日本語:
            </p>

            <div className="voice-commands-grid">
              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">Hands-Free Action</span>
                </div>
                <div className="voice-command-phrase">
                  "Create domain called [Name]" / "டொமைன் உருவாக்கு [பெயர்]"
                </div>
                <p className="voice-command-desc">
                  Instantly creates a new domain with the spoken name without
                  opening any modal.
                </p>
              </div>

              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">Hands-Free Action</span>
                </div>
                <div className="voice-command-phrase">
                  "Add FAQ [Q] answer [A]" / "கேள்வி [கே] பதில் [ப]"
                </div>
                <p className="voice-command-desc">
                  Directly adds an FAQ with text embeddings to the active
                  knowledge domain.
                </p>
              </div>

              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">Search</span>
                </div>
                <div className="voice-command-phrase">
                  "Search for [query]" / "தேடு [வினவல்]"
                </div>
                <p className="voice-command-desc">
                  Triggers semantic search across documents and speaks the top
                  match aloud.
                </p>
              </div>

              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">AI Assistant</span>
                </div>
                <div className="voice-command-phrase">
                  "Ask AI [doubt / error]" / "உதவியாளர் [கேள்வி]"
                </div>
                <p className="voice-command-desc">
                  Queries the conversational assistant to clear doubts, explain
                  errors, or find answers.
                </p>
              </div>

              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">Navigation</span>
                </div>
                <div className="voice-command-phrase">
                  "Go to Dashboard" / "முகப்பு" / "டொமைன்கள்"
                </div>
                <p className="voice-command-desc">
                  Instantly jumps between workspaces and speaks confirmation.
                </p>
              </div>

              <div className="voice-command-card">
                <div className="voice-cmd-header">
                  <span className="voice-cmd-badge">Modal Dictation</span>
                </div>
                <div className="voice-command-phrase">
                  "Name is [x]" / "பெயர் [x]" / "சேமி"
                </div>
                <p className="voice-command-desc">
                  Fills out open modal inputs with your spoken voice and
                  triggers submission.
                </p>
              </div>
            </div>
          </>
        ) : currentTab === "knowledge-gaps" ? (
          /* 6.5 KNOWLEDGE GAPS TAB */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">Workspace / Knowledge Gaps</div>
                <h1>
                  Knowledge <span>Gaps & Analytics</span>
                </h1>
                <p>
                  Discover frequently searched questions with no good answers.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={fetchKnowledgeGaps}
                disabled={loadingGaps}
              >
                ↻ Refresh Data
              </button>
            </header>

            <div style={{ padding: "20px" }}>
              {loadingGaps ? (
                <p>Loading gaps data...</p>
              ) : knowledgeGaps.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✓</div>
                  <h3>No Knowledge Gaps Detected</h3>
                  <p>All searches seem to have relevant results. Great job!</p>
                </div>
              ) : (
                <div className="resources-grid">
                  {knowledgeGaps.map((gap, i) => (
                    <div className="domain-card" key={i}>
                      <h3 style={{ fontSize: "18px", marginBottom: "10px" }}>
                        "{gap._id}"
                      </h3>
                      <p style={{ margin: "5px 0", color: "#64748b" }}>
                        Searched <b>{gap.count} times</b>
                      </p>
                      <p style={{ margin: "5px 0", color: "#64748b" }}>
                        Avg. Similarity:{" "}
                        <b>{(gap.avgSimilarity * 100).toFixed(1)}%</b>
                      </p>
                      {gap.thumbsDownCount > 0 && (
                        <p style={{ margin: "5px 0", color: "#ef4444" }}>
                          👎 {gap.thumbsDownCount} negative feedbacks
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : currentTab === "settings" ? (
          /* 7. SETTINGS & SYSTEM DIAGNOSTICS TAB */
          <>
            <header className="dashboard-header">
              <div>
                <div className="breadcrumb">
                  Workspace / Settings & Diagnostics
                </div>
                <h1>
                  System <span>Settings & Health</span>
                </h1>
                <p>
                  Manage your user account credentials and inspect the semantic
                  neural embedding pipeline.
                </p>
              </div>
            </header>

            <div className="settings-grid">
              {/* Profile Information */}
              <div className="settings-card">
                <h3>Account Profile</h3>
                <p>Update your display name or change your account password.</p>

                <form onSubmit={handleUpdateProfile}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={user?.email || ""}
                      disabled
                      style={{ background: "#f8fafc" }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Current Password (optional)</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password to change"
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password (optional)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="save-domain-button"
                    disabled={updatingProfile}
                  >
                    {updatingProfile ? "Saving Changes..." : "Update Profile"}
                  </button>
                </form>
              </div>

              {/* System Diagnostics & Engine Info */}
              <div className="settings-card">
                <h3>Embedding Engine & Storage</h3>
                <p>Neural pipeline configuration and health diagnostics.</p>

                <div className="system-spec-list">
                  <div className="spec-item">
                    <span>Transformer Model</span>
                    <strong>Xenova/all-MiniLM-L6-v2</strong>
                  </div>

                  <div className="spec-item">
                    <span>Vector Dimensions</span>
                    <strong>384-dimensional dense float32</strong>
                  </div>

                  <div className="spec-item">
                    <span>Distance Metric</span>
                    <strong>Cosine Similarity (Normalized dot product)</strong>
                  </div>

                  <div className="spec-item">
                    <span>Database Backend</span>
                    <span className="spec-status-tag">
                      <span className="spec-status-dot"></span>
                      MongoDB Connected
                    </span>
                  </div>

                  <div className="spec-item">
                    <span>Voice Engine</span>
                    <span className="spec-status-tag">
                      <span className="spec-status-dot"></span>
                      Web Speech API (8 Languages)
                    </span>
                  </div>

                  <div className="spec-item">
                    <span>Total Knowledge Domains</span>
                    <strong>{domains.length}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Total Indexed Resources</span>
                    <strong>{totalResources}</strong>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "24px",
                    paddingTop: "20px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <h4 style={{ margin: "0 0 6px", fontSize: "14px" }}>
                    Vector Maintenance
                  </h4>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    Recompute embeddings for all stored resources using the
                    neural embedding model.
                  </p>
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={handleRegenerateEmbeddings}
                    disabled={regeneratingEmbeddings}
                  >
                    {regeneratingEmbeddings
                      ? "Computing Vectors..."
                      : "Regenerate All Embeddings"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* MODAL 1: Create Domain Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => !creatingDomain && setShowCreateModal(false)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Create Knowledge Domain</h2>
                <p>
                  Create a dedicated searchable collection for documentation or
                  topics.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateDomain}>
              <div className="form-group">
                <label>Domain Name</label>
                <input
                  type="text"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  placeholder="e.g. Engineering Handbook, HR Policies, API Reference"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={domainDescription}
                  onChange={(e) => setDomainDescription(e.target.value)}
                  placeholder="Describe the nature of documents and topics stored in this domain..."
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-domain-button"
                  disabled={creatingDomain}
                >
                  {creatingDomain ? "Creating..." : "Create Domain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Domain Modal */}
      {editingDomain && (
        <div
          className="modal-overlay"
          onClick={() => !savingDomainEdit && setEditingDomain(null)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit Knowledge Domain</h2>
                <p>Update domain name and description.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setEditingDomain(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveDomainEdit}>
              <div className="form-group">
                <label>Domain Name</label>
                <input
                  type="text"
                  value={editDomainName}
                  onChange={(e) => setEditDomainName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editDomainDesc}
                  onChange={(e) => setEditDomainDesc(e.target.value)}
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setEditingDomain(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-domain-button"
                  disabled={savingDomainEdit}
                >
                  {savingDomainEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Domain Confirmation Modal */}
      {domainToDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deletingDomain && setDomainToDelete(null)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="danger-modal-icon">⚠</div>
            <div className="modal-header">
              <div>
                <h2>Delete Domain "{domainToDelete.name}"?</h2>
                <p>
                  This will permanently delete this domain and all of its
                  associated FAQs, text resources, and uploaded PDF files.
                </p>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "25px" }}>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setDomainToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDeleteDomain}
                disabled={deletingDomain}
              >
                {deletingDomain ? "Deleting Domain..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Resource Modal */}
      {showResourceModal && (
        <div
          className="modal-overlay"
          onClick={() => !addingResource && setShowResourceModal(false)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add Knowledge Resource</h2>
                <p>
                  Add to{" "}
                  {selectedDomain ? selectedDomain.name : "Knowledge Base"}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowResourceModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddResource}>
              <div className="form-group">
                <label>Resource Type</label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                >
                  <option value="faq">FAQ (Question & Answer)</option>
                  <option value="text">Text / Note / Documentation</option>
                  <option value="pdf">PDF Document Upload</option>
                </select>
              </div>

              {resourceType === "pdf" ? (
                <div className="form-group">
                  <label>Upload PDF Document</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setResourceFile(e.target.files[0] || null)}
                    required
                  />
                  <small
                    style={{
                      color: "#64748b",
                      marginTop: "6px",
                      display: "block",
                    }}
                  >
                    Text will be automatically extracted and neural embeddings
                    generated. Max 25MB.
                  </small>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>
                      {resourceType === "faq"
                        ? "Question / FAQ Title"
                        : "Document Title"}
                    </label>
                    <input
                      type="text"
                      value={resourceTitle}
                      onChange={(e) => setResourceTitle(e.target.value)}
                      placeholder={
                        resourceType === "faq"
                          ? "e.g. How do I request vacation leave?"
                          : "e.g. Remote Work Security Guidelines"
                      }
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {resourceType === "faq"
                        ? "Answer Content"
                        : "Full Document Text Content"}
                    </label>
                    <textarea
                      value={resourceContent}
                      onChange={(e) => setResourceContent(e.target.value)}
                      placeholder="Type or paste the knowledge content here..."
                      rows="7"
                      required
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowResourceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-domain-button"
                  disabled={addingResource}
                >
                  {addingResource
                    ? "Processing & Embedding..."
                    : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Resource Modal */}
      {editingResource && (
        <div
          className="modal-overlay"
          onClick={() => !savingResourceEdit && setEditingResource(null)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit Resource</h2>
                <p>
                  Update resource title and content. Vector embeddings will
                  automatically recompute.
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setEditingResource(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveResourceEdit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editResourceTitle}
                  onChange={(e) => setEditResourceTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={editResourceContent}
                  onChange={(e) => setEditResourceContent(e.target.value)}
                  rows="8"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setEditingResource(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-domain-button"
                  disabled={savingResourceEdit}
                >
                  {savingResourceEdit ? "Re-indexing..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Resource Confirmation Modal */}
      {resourceToDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deletingResource && setResourceToDelete(null)}
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="danger-modal-icon">✕</div>
            <div className="modal-header">
              <div>
                <h2>Delete Resource "{resourceToDelete.title}"?</h2>
                <p>
                  This will remove the resource, its vector embeddings, and any
                  associated uploaded file.
                </p>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "25px" }}>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setResourceToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDeleteResource}
                disabled={deletingResource}
              >
                {deletingResource ? "Deleting..." : "Delete Resource"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: View Full Resource Modal */}
      {viewingResource && (
        <div className="modal-overlay" onClick={() => setViewingResource(null)}>
          <div
            className="create-modal"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span
                  className={`badge badge-${viewingResource.type}`}
                  style={{ marginBottom: "8px" }}
                >
                  {viewingResource.type}
                </span>
                <h2>{viewingResource.title}</h2>
                <p>
                  Domain:{" "}
                  {viewingResource.domainName ||
                    selectedDomain?.name ||
                    "Knowledge Base"}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setViewingResource(null)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginTop: "16px",
                maxHeight: "350px",
                overflowY: "auto",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  lineHeight: "1.7",
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                }}
              >
                {viewingResource.content || "No text content available."}
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                {viewingResource.type === "pdf" && (
                  <a
                    href={`${API_BASE}${viewingResource.fileUrl || `/uploads/${viewingResource.fileName}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-file-link"
                  >
                    📥 Open Original PDF
                  </a>
                )}
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    copyToClipboard(viewingResource.content, "Content")
                  }
                >
                  Copy Content
                </button>
              </div>

              <button
                type="button"
                className="save-domain-button"
                onClick={() => setViewingResource(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden native file input for voice auto-upload fallback or voice upload commands */}
      <input
        type="file"
        ref={voiceFileInputRef}
        style={{ display: "none" }}
        onChange={handleVoiceFileSelected}
        accept=".pdf,.txt,.md,.doc,.docx"
      />
    </div>
  );
}

export default Dashboard;
