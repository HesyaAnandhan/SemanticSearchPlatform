const express = require("express");
const Resource = require("../models/Resource");
const Domain = require("../models/Domain");
const ChatHistory = require("../models/ChatHistory");
const authMiddleware = require("../middleware/authMiddleware");
const { generateEmbedding } = require("../services/embeddingService");
const Groq = require("groq-sdk");

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length === 0 || vectorB.length === 0) {
    return 0;
  }

  // Dimension mismatch guard — vectors must be same length
  if (vectorA.length !== vectorB.length) {
    console.warn(
      `Cosine similarity dimension mismatch: ${vectorA.length} vs ${vectorB.length}`,
    );
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function normalizeSimilarity(rawScore) {
  if (rawScore <= 0.15) return 0; // Absolute noise is zeroed out
  if (rawScore <= 0.25) return 0.1 + ((rawScore - 0.15) / 0.1) * 0.15; // Maps 0.15-0.25 to 10%-25%
  if (rawScore <= 0.45) return 0.25 + ((rawScore - 0.25) / 0.2) * 0.25; // 25% - 50%
  if (rawScore <= 0.65) return 0.5 + ((rawScore - 0.45) / 0.2) * 0.4; // 50% - 90%
  return 0.9 + ((rawScore - 0.65) / 0.35) * 0.1; // 90% - 100%
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "what",
  "who",
  "where",
  "when",
  "why",
  "how",
  "which",
  "can",
  "could",
  "would",
  "should",
  "do",
  "does",
  "did",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "to",
  "of",
  "in",
  "on",
  "for",
  "from",
  "with",
  "and",
  "or",
  "but",
  "about",
  "tell",
  "please",
  "give",
  "show",
  "explain",
  "tell",
]);

function getSearchKeywords(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !SEARCH_STOP_WORDS.has(word));
}

function calculateKeywordCoverage(queryKeywords, title, content) {
  if (queryKeywords.length === 0) return 0;

  const titleText = normalizeText(title);
  const contentText = normalizeText(content);

  let matched = 0;

  for (const keyword of queryKeywords) {
    if (titleText.includes(keyword) || contentText.includes(keyword)) {
      matched++;
    }
  }

  return matched / queryKeywords.length;
}

function calculateKeywordScore(queryKeywords, title, content) {
  if (queryKeywords.length === 0) return 0;

  const titleText = normalizeText(title);
  const contentText = normalizeText(content);

  let score = 0;

  for (const keyword of queryKeywords) {
    if (titleText.includes(keyword)) {
      score += 1.0;
    } else if (contentText.includes(keyword)) {
      score += 0.5;
    }
  }

  return Math.min(score / queryKeywords.length, 1);
}

function calculatePhraseMatch(query, title, content) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return 0;

  const titleText = normalizeText(title);
  const contentText = normalizeText(content);

  if (
    titleText.includes(normalizedQuery) ||
    contentText.includes(normalizedQuery)
  ) {
    return 1;
  }

  return 0;
}

function calculateHybridScore({
  semanticScore,
  keywordScore,
  phraseMatch,
  keywordCoverage,
}) {
  let hybridScore =
    semanticScore * 0.6 + keywordScore * 0.3 + phraseMatch * 0.1;

  if (keywordCoverage >= 0.75) {
    hybridScore += 0.08;
  } else if (keywordCoverage >= 0.5) {
    hybridScore += 0.04;
  }

  return Math.min(Math.max(hybridScore, 0), 1);
}

// ─── INTENT DETECTION ────────────────────────────────────────────────────────
// Returns an intent string or null. Checks patterns in any language.
function detectIntent(text) {
  const t = text.toLowerCase().trim();

  // Greeting
  if (
    /^(hi+|hello+|hey+|howdy|sup|greetings|good (morning|afternoon|evening|night)|hola|bonjour|namaste|vanakkam|வணக்கம்|नमस्ते|こんにちは|你好|مرحبا)[\s!,.?]*$/i.test(
      t,
    )
  )
    return "greeting";

  // How are you / small talk
  if (
    /how are you|how r u|how's it going|you okay|you good|wassup|what's up|¿cómo estás|comment ça va|wie geht|कैसे हो|நீங்கள் எப்படி/i.test(
      t,
    )
  )
    return "small_talk";

  // Thanks
  if (
    /^(thanks|thank you|ty|thx|merci|danke|gracias|நன்றி|शुक्रिया|ありがとう|谢谢)[\s!.]*$/i.test(
      t,
    )
  )
    return "thanks";

  // Goodbye
  if (
    /^(bye|goodbye|see you|ciao|au revoir|tschüss|adios|வணக்கம்|बाय|さようなら)[\s!.]*$/i.test(
      t,
    )
  )
    return "goodbye";

  // Platform overview / about
  if (
    /what is (this|the) (project|platform|app|system|tool)|about (this|the) (project|app)|overview|purpose of (this|the)|what does (this|it) do|describe this|explain (this|the) (platform|app)/i.test(
      t,
    )
  )
    return "platform_overview";

  // What can you do / capabilities
  if (
    /what can you do|your (capabilities|features|functions|skills)|who are you|introduce yourself|tell me about yourself|help me understand|what do you (do|help)|how can you help/i.test(
      t,
    )
  )
    return "capabilities";

  // Domain management
  if (
    /how (do i|to|can i) (create|make|add|set up|build).*domain|create.*domain|make.*domain|domain.*create/i.test(
      t,
    )
  )
    return "how_create_domain";
  if (/how (do i|to|can i) (delete|remove|edit|update|rename).*domain/i.test(t))
    return "how_manage_domain";
  if (
    /(what|list|show|my) domains|how many domains|domains (i have|available)|list.*domain/i.test(
      t,
    )
  )
    return "list_domains";

  // Resource management
  if (
    /how (do i|to|can i) (add|create|upload|insert|import).*?(faq|resource|pdf|document|note|text)/i.test(
      t,
    )
  )
    return "how_add_resource";
  if (
    /how (do i|to|can i) (delete|remove|edit|update).*?(faq|resource|pdf|document)/i.test(
      t,
    )
  )
    return "how_manage_resource";
  if (/(what|list|show|my) resources|all resources|how many resources/i.test(t))
    return "list_resources";

  // Search
  if (
    /how (does|do) (semantic )?search (work|function)|what is semantic search|explain.*search|search.*explain|how to search|keyword.*search|vector.*search/i.test(
      t,
    )
  )
    return "how_search";

  // Voice commands
  if (
    /voice (command|control|input|instruction)|how to use voice|microphone|speech (recognition|input)|how.*voice|voice.*work|hands.?free/i.test(
      t,
    )
  )
    return "voice_commands";

  // Technical: Embeddings / Vectors / Cosine Similarity
  if (
    /cosine similarity|vector (embedding|space|search)|embedding|transformer|minilm|all-minilm|how.*embed|neural|semantic vector|dense vector|384/i.test(
      t,
    )
  )
    return "explain_embeddings";

  // Technical: PDF upload issues
  if (
    /(pdf|upload|file|document).*(fail|error|issue|problem|not work|can'?t|cannot|broken|stuck)|upload.*(error|fail|issue|problem)|failed to (upload|process|parse|extract)/i.test(
      t,
    )
  )
    return "troubleshoot_pdf";

  // Technical: Auth / Login issues
  if (
    /401|unauthorized|token (expired|invalid)|session (expired|invalid)|logged? out|can'?t (log|sign) in|login (fail|error|issue)|authentication (fail|error)|invalid (token|session)/i.test(
      t,
    )
  )
    return "troubleshoot_auth";

  // Technical: MongoDB / Database issues
  if (
    /mongodb|mongo|database.*(error|fail|issue|down|connect)|connection (fail|refuse|error|lost)|econnrefused|cannot connect|db (error|fail|issue)/i.test(
      t,
    )
  )
    return "troubleshoot_mongodb";

  // Search quality / accuracy
  if (
    /low similarity|improve (search|accuracy|results)|not matching|why (is|are) (results|similarity|score) (low|bad|wrong|incorrect)|bad (results|accuracy)|improve matching|better results/i.test(
      t,
    )
  )
    return "improve_search";

  // Embeddings regeneration
  if (
    /regenerate (embeddings|vectors)|recalculate|re.?embed|re.?compute|fix (embeddings|vectors)/i.test(
      t,
    )
  )
    return "regenerate_embeddings";

  // Settings / diagnostics
  if (
    /settings|diagnostics|system (info|status|health|check)|database status|model info|system diagnostics/i.test(
      t,
    )
  )
    return "settings";

  // Profile / password
  if (
    /change (my )?(password|name|profile)|update (profile|password|name|email)|profile settings/i.test(
      t,
    )
  )
    return "profile";

  // JWT / Security
  if (
    /jwt|json web token|how.*(auth|authentication|secure|login) work|token (system|work|how)|bearer token/i.test(
      t,
    )
  )
    return "explain_auth";

  // Time / date
  if (
    /^(what (time|date|day|year) is it|current (time|date)|today['']?s date)[\s?]*$/i.test(
      t,
    )
  )
    return "datetime";

  // Math
  if (/^[\d\s+\-*/().^%]+$/.test(t) && t.length < 100) return "math";

  // Joke
  if (/tell.*joke|make me laugh|say something funny|joke/i.test(t))
    return "joke";

  // Weather (can't actually fetch, but address gracefully)
  if (/weather|temperature|forecast|rain|sunny|hot|cold/i.test(t))
    return "weather";

  // General knowledge / factual questions (outside KB)
  if (
    /^(what|who|where|when|why|how|which|can you|could you|do you know|tell me|explain|describe|define|is it|are there|does|did|will|would)\b/i.test(
      t,
    )
  )
    return "general_question";

  return null;
}

// ─── BUILD SMART REPLY ───────────────────────────────────────────────────────
function buildIntentReply(intent, context) {
  const { domains = [], resources = [], message, langCode } = context;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  switch (intent) {
    case "greeting":
      return {
        reply: `Hello! 👋 I'm your **Semantic AI Assistant**, here to help you with anything — from managing your knowledge base to answering questions from your documents.\n\nYou currently have **${domains.length} domain(s)** and **${resources.length} resource(s)** in your workspace.\n\nHow can I help you today?`,
        suggestions: [
          "What can you do?",
          "How do I create a domain?",
          "How does semantic search work?",
          "Show my domains",
        ],
      };

    case "small_talk":
      return {
        reply: `I'm doing great and ready to help! 🚀\n\nI'm your AI assistant for this Semantic Search Platform. I can answer questions from your knowledge base, guide you around the platform, help with voice controls, and troubleshoot any errors.\n\nWhat would you like to do today?`,
        suggestions: [
          "What can you do?",
          "Show my domains",
          "How does semantic search work?",
        ],
      };

    case "thanks":
      return {
        reply: `You're very welcome! 😊 I'm always here if you need anything else — just ask!\n\nFeel free to ask me questions about your documents, platform features, or anything else.`,
        suggestions: [
          "How do I add a resource?",
          "Show my domains",
          "How does voice control work?",
        ],
      };

    case "goodbye":
      return {
        reply: `Goodbye! 👋 Have a great day! Come back anytime you need help with your knowledge base or the platform.\n\n*(Tip: Your chat history is saved — you can load it anytime from the history panel.)*`,
        suggestions: [],
      };

    case "platform_overview":
      return {
        reply: `## 🧠 Semantic Search Platform — Overview\n\nThis is an **enterprise-grade AI knowledge retrieval system** that understands meaning, not just keywords.\n\n**What it does:**\n1. **Neural Semantic Search** — Converts text into 384-dimensional vectors using \`all-MiniLM-L6-v2\` transformer. Searches by *meaning* using cosine similarity, not exact keyword matching.\n2. **Knowledge Domains** — Organize your documents into domains (e.g., HR, Legal, Engineering, Support).\n3. **Multi-Format Ingestion** — Add FAQ pairs, text/notes, or upload PDF documents. All are vectorized automatically.\n4. **Voice Control** — Control the entire platform hands-free in 8 languages (EN, ES, FR, DE, HI, ZH, JA, TA).\n5. **This AI Assistant** — Ask anything; I answer from your knowledge base or help guide you.\n\n**Your workspace:** ${domains.length} domain(s), ${resources.length} resource(s) indexed.`,
        suggestions: [
          "How do I create a domain?",
          "How does semantic search work?",
          "How to use voice controls?",
        ],
      };

    case "capabilities":
      return {
        reply: `## 🤖 What I Can Do For You\n\n**1. Answer questions from your knowledge base**\n   Ask me anything — I search your documents semantically and synthesize an answer.\n\n**2. Platform guidance**\n   - How to create domains, add resources, upload PDFs\n   - Navigate the platform (say "go to search", "open domains")\n   - Understand how features work\n\n**3. Troubleshoot errors**\n   - PDF upload failures\n   - Login / authentication (401) errors\n   - MongoDB connection issues\n   - Low similarity / poor search results\n\n**4. Voice control**\n   - Voice navigation to any tab\n   - Create domains and FAQs by voice\n   - Search your knowledge base by speaking\n\n**5. General assistance**\n   - Answer general questions to the best of my ability\n   - Explain AI/ML concepts like embeddings, cosine similarity\n\nJust type or speak naturally — I understand multiple languages!`,
        suggestions: [
          "How do I create a domain?",
          "Troubleshoot PDF upload",
          "Explain cosine similarity",
        ],
      };

    case "how_create_domain":
      return {
        reply: `## 📁 How to Create a Knowledge Domain\n\n**Method 1 — By Voice (Hands-Free):**\nSay: *"Create domain called [Your Domain Name]"*\nExample: *"Create domain called HR Policies"*\n\n**Method 2 — Via UI:**\n1. Click the **"Domains"** tab in the sidebar\n2. Click **"+ Create Domain"**\n3. Enter a name and optional description\n4. Click **"Create Domain"**\n\n**Method 3 — From Dashboard:**\nClick the **"+ New Domain"** quick-action card on the dashboard.\n\n> 💡 **Tip:** Give your domain a descriptive name (e.g., "Customer Support FAQs" instead of "CS") — it helps organize resources better.`,
        suggestions: [
          "How do I add a resource to a domain?",
          "How to upload a PDF?",
          "Create domain by voice",
        ],
      };

    case "how_manage_domain":
      return {
        reply: `## ✏️ How to Edit or Delete a Domain\n\n**Edit a Domain:**\n1. Go to the **Domains** tab\n2. Click the domain you want to edit\n3. Click the **Edit (✏️)** icon\n4. Update the name or description and save\n\n**Delete a Domain:**\n1. Go to the **Domains** tab\n2. Click the **Delete (🗑️)** icon on the domain card\n3. Confirm deletion\n\n> ⚠️ **Warning:** Deleting a domain also permanently deletes all its resources and associated files (cascading delete). This cannot be undone.`,
        suggestions: ["How do I create a domain?", "How to delete a resource?"],
      };

    case "list_domains":
      if (domains.length === 0) {
        return {
          reply: `You don't have any knowledge domains yet.\n\nTo get started, say *"Create domain called [Name]"* or click **"+ Create Domain"** in the Domains tab.`,
          suggestions: [
            "How do I create a domain?",
            "What is a knowledge domain?",
          ],
        };
      }
      const domainList = domains
        .map(
          (d, i) =>
            `${i + 1}. **${d.name}**${d.description ? ` — ${d.description}` : ""}`,
        )
        .join("\n");
      return {
        reply: `## 📂 Your Knowledge Domains (${domains.length})\n\n${domainList}\n\nYou can open any domain in the **Domains** tab to view, add, or manage its resources.`,
        suggestions: [
          "How do I add a resource?",
          "How does semantic search work?",
        ],
      };

    case "list_resources":
      return {
        reply: `You currently have **${resources.length} resource(s)** indexed across **${domains.length} domain(s)**.\n\nTo see all resources, go to the **"All Resources"** tab in the sidebar. You can filter by type (FAQ, Text, PDF) or by domain.`,
        suggestions: ["How do I add a resource?", "How to upload a PDF?"],
      };

    case "how_add_resource":
      return {
        reply: `## 📄 How to Add Resources\n\n**Add an FAQ (Question & Answer):**\n- **By Voice:** Say *"Add FAQ [question] answer [answer]"*\n  Example: *"Add FAQ What is our refund policy answer We offer 30-day full refunds"*\n- **Via UI:** Open a domain → Click "+ Add Resource" → Select "FAQ"\n\n**Add a Text/Note:**\n- **By Voice:** Say *"Add note [title] content [content]"*\n- **Via UI:** Open a domain → Click "+ Add Resource" → Select "Text"\n\n**Upload a PDF Document:**\n- **Via UI:** Open a domain → Click "+ Add Resource" → Select "PDF Document" → Choose your file\n- The server auto-extracts text, chunks it, and generates vector embeddings\n- Supported: Selectable-text PDFs up to 25MB\n\n> 💡 All resources are automatically vectorized using the \`all-MiniLM-L6-v2\` transformer for instant semantic search.`,
        suggestions: [
          "Troubleshoot PDF upload error",
          "How do I create a domain?",
          "How does semantic search work?",
        ],
      };

    case "how_manage_resource":
      return {
        reply: `## ✏️ How to Edit or Delete Resources\n\n**Edit a Resource:**\n1. Go to the domain containing the resource\n2. Find the resource and click the **Edit (✏️)** icon\n3. Update the content and save\n4. Embeddings are **automatically recalculated** on save\n\n**Delete a Resource:**\n1. Find the resource in its domain or in "All Resources"\n2. Click the **Delete (🗑️)** icon and confirm\n3. For PDF resources, the file is also deleted from the server\n\n**Bulk Operations:**\n- Go to **Settings & Diagnostics** → **"Regenerate All Embeddings"** to recompute vectors for all resources at once.`,
        suggestions: [
          "How to regenerate embeddings?",
          "How to add a resource?",
        ],
      };

    case "how_search":
      return {
        reply: `## 🔍 How Semantic Search Works\n\n**Traditional keyword search** looks for exact word matches.\n**Semantic search** understands *meaning and context*.\n\n**How it works step by step:**\n1. Your query (e.g., *"annual leave policy"*) is converted into a 384-dimensional vector by the \`all-MiniLM-L6-v2\` transformer model.\n2. Every resource in your knowledge base also has a stored vector embedding.\n3. The system calculates **cosine similarity** between your query vector and each resource vector.\n4. Results are ranked by similarity score (0–100%).\n\n**Key insight:** Searching *"vacation days"* will match *"annual leave entitlement"* even though none of the words are the same — because they mean the same thing!\n\n**How to use it:**\n- Go to the **Search** tab\n- Type a question or topic naturally\n- Adjust the **minimum similarity slider** to control result precision\n- Filter by domain using the dropdown`,
        suggestions: [
          "Explain cosine similarity",
          "How to improve search accuracy?",
          "Go to search",
        ],
      };

    case "voice_commands":
      return {
        reply: `## 🎙️ Voice Control — Full Command Reference\n\n**Navigation:**\n- *"Go to dashboard"* / *"Go home"*\n- *"Go to domains"* / *"Open domains"*\n- *"Go to search"* / *"Open search"*\n- *"Go to resources"*\n- *"Go to settings"*\n- *"Go to help"*\n- *"Open assistant"* / *"Open chat"*\n\n**Create Content:**\n- *"Create domain called [Name]"*\n- *"Add FAQ [question] answer [answer]"*\n- *"Add note [title] content [content]"*\n- *"Upload file [filename]"* / *"Upload PDF"*\n\n**Search:**\n- *"Search for [topic]"*\n- *"Find [topic]"*\n- *"What is [topic]?"* (auto-searches)\n\n**AI Assistant (when drawer is open):**\n- Just speak naturally — anything you say is sent to the AI\n- *"Close assistant"* to close\n- *"Stop speaking"* to stop audio\n\n**Multilingual:** Switch the language selector on the Voice HUD to speak in English, Spanish, French, German, Hindi, Chinese, Japanese, or Tamil.`,
        suggestions: [
          "How do I enable the microphone?",
          "What languages are supported?",
          "How does semantic search work?",
        ],
      };

    case "explain_embeddings":
      return {
        reply: `## 🧮 Vector Embeddings & Cosine Similarity Explained\n\n**What is a Vector Embedding?**\nWhen text is processed by the \`Xenova/all-MiniLM-L6-v2\` transformer model, it's converted into an array of **384 floating-point numbers** — a point in 384-dimensional space. Sentences with similar meaning are positioned close to each other in this space.\n\n**What is Cosine Similarity?**\nIt measures the angle between two vectors:\n\n| Score | Meaning |\n|---|---|\n| **1.00 (100%)** | Identical meaning |\n| **0.80–0.99** | Very strong semantic match |\n| **0.60–0.79** | Strong contextual relationship |\n| **0.40–0.59** | Related topics |\n| **0.20–0.39** | Loosely related |\n| **< 0.20** | Unrelated |\n\n**Why use it?**\n- *"vacation"* and *"annual leave"* score ~0.85 — correctly identified as related\n- Keyword search would score 0 (no common words)\n- This is the power of semantic/neural search over traditional methods!`,
        suggestions: [
          "How does semantic search work?",
          "How to improve search accuracy?",
        ],
      };

    case "troubleshoot_pdf":
      return {
        reply: `## 🔧 Troubleshooting PDF Upload Issues\n\n**Common causes and fixes:**\n\n**1. Scanned/Image PDF (most common)**\nThe platform uses \`pdf-parse\` which can only extract *selectable digital text*. If your PDF is a scanned image without OCR, no text can be extracted.\n✅ Fix: Open the PDF → try selecting text with your cursor. If you can't, run OCR first (e.g., using Adobe Acrobat or free tools like OCRmyPDF).\n\n**2. File too large**\nMaximum supported size is **25MB**.\n✅ Fix: Split large PDFs into smaller parts.\n\n**3. Password-protected PDF**\nEncrypted PDFs cannot be parsed.\n✅ Fix: Remove the password protection before uploading.\n\n**4. No domain selected**\nYou must open a Knowledge Domain before uploading.\n✅ Fix: Go to Domains → open a domain → then upload the PDF.\n\n**5. Network/Server error**\nCheck the browser console (F12) and server logs for specific error messages.`,
        suggestions: [
          "How do I add a FAQ instead?",
          "How to select a domain?",
          "What file types are supported?",
        ],
      };

    case "troubleshoot_auth":
      return {
        reply: `## 🔧 Troubleshooting Authentication Issues (401 Error)\n\n**What it means:**\nA 401 Unauthorized error means your JWT session token has expired or is invalid. JWT tokens in this platform are valid for **24 hours** after login.\n\n**How to fix:**\n1. Click **"Logout"** in the sidebar (bottom)\n2. Return to the login page\n3. Sign in again with your email and password\n4. A fresh JWT token will be stored in your browser's \`localStorage\`\n\n**Preventive tips:**\n- Don't share your \`localStorage\` token with others\n- If you clear browser data/cookies, you'll be logged out\n- If you change your password, all existing tokens are invalidated\n\n**Still having issues?**\nCheck \`server/.env\` to ensure \`JWT_SECRET\` is set correctly and the server was restarted after any changes.`,
        suggestions: [
          "How do I change my password?",
          "What is JWT?",
          "Check system diagnostics",
        ],
      };

    case "troubleshoot_mongodb":
      return {
        reply: `## 🔧 Troubleshooting MongoDB Connection Issues\n\n**Symptoms:** "MongoDB connection failed", ECONNREFUSED, database errors\n\n**Step-by-step fix:**\n\n**1. Check if MongoDB service is running**\nOpen PowerShell as Administrator and run:\n\`\`\`\nGet-Service MongoDB\n\`\`\`\nIf Status is "Stopped", start it:\n\`\`\`\nStart-Service MongoDB\n\`\`\`\n\n**2. Verify your connection URI**\nCheck \`server/.env\`:\n\`\`\`\nMONGO_URI=mongodb://127.0.0.1:27017/semanticsearch\n\`\`\`\n\n**3. Test the port**\nIn PowerShell:\n\`\`\`\nTest-NetConnection -ComputerName 127.0.0.1 -Port 27017\n\`\`\`\nShould show \`TcpTestSucceeded: True\`\n\n**4. Firewall**\nEnsure port 27017 is not blocked by Windows Firewall.`,
        suggestions: ["Check system diagnostics", "How to restart the server?"],
      };

    case "improve_search":
      return {
        reply: `## 🎯 How to Improve Semantic Search Accuracy\n\n**1. Write descriptive resources**\nThe transformer model works best with 2+ sentences of context. Avoid single-word titles.\n- ❌ Bad: Title: "Leave"\n- ✅ Good: "What is the annual leave policy? Employees are entitled to 21 days of paid annual leave per year..."\n\n**2. Ask natural questions**\nInstead of single keywords, use natural language:\n- ❌ "sick leave" → ✅ "How many sick days am I entitled to per year?"\n\n**3. Lower the similarity threshold**\nIn the Search tab, drag the **Minimum Similarity** slider down to 20–30% to capture broader matches.\n\n**4. Use domain-scoped search**\nFilter by a specific domain to reduce noise from unrelated content.\n\n**5. Regenerate embeddings**\nIf you edited resources directly in the database, go to **Settings & Diagnostics** → **"Regenerate All Embeddings"** to refresh all vectors.`,
        suggestions: [
          "Go to search",
          "How does cosine similarity work?",
          "Regenerate embeddings",
        ],
      };

    case "regenerate_embeddings":
      return {
        reply: `## 🔄 How to Regenerate All Embeddings\n\nIf your search results seem off after bulk edits or data migration, you can recompute all vector embeddings:\n\n1. Go to **Settings & Diagnostics** tab (gear icon in sidebar)\n2. Find the **"Regenerate All Embeddings"** button\n3. Click it and wait — the system will reprocess every resource through the transformer model\n4. This may take a few minutes depending on the number of resources\n\n> ⚠️ During regeneration, search quality may temporarily be reduced. Don't add new resources until it completes.\n\nThis is useful after:\n- Importing data directly into MongoDB\n- Bulk editing resources\n- Upgrading the embedding model`,
        suggestions: ["Go to settings", "How does semantic search work?"],
      };

    case "settings":
      return {
        reply: `## ⚙️ Settings & Diagnostics\n\nGo to the **Settings** tab (gear icon in the sidebar) to access:\n\n**System Information:**\n- Embedding model: \`Xenova/all-MiniLM-L6-v2\`\n- Vector dimensions: 384\n- Similarity metric: Cosine Similarity\n- Database: MongoDB\n\n**Actions:**\n- **Regenerate All Embeddings** — Recompute vectors for all resources\n- **Database Status** — Check MongoDB connection health\n- **Profile Settings** — Update your name and password\n\n**Activity Log:**\nYour recent actions are tracked in localStorage and displayed on the dashboard.`,
        suggestions: [
          "How to regenerate embeddings?",
          "How to change my password?",
        ],
      };

    case "profile":
      return {
        reply: `## 👤 How to Update Your Profile\n\n1. Go to **Settings** tab in the sidebar\n2. Scroll to the **"Profile Settings"** section\n3. You can update:\n   - **Display Name** — your visible name in the platform\n   - **Password** — enter current password + new password to change it\n4. Click **"Save Changes"**\n\n> 🔒 Passwords are hashed using \`bcryptjs\` — they are never stored in plain text.`,
        suggestions: ["Go to settings", "How to troubleshoot login issues?"],
      };

    case "explain_auth":
      return {
        reply: `## 🔐 How Authentication Works\n\n**JWT (JSON Web Token) Authentication:**\n\n1. When you log in, the server verifies your credentials and generates a **JWT token** signed with \`JWT_SECRET\`.\n2. This token is stored in your browser's \`localStorage\`.\n3. Every API request includes this token in the \`Authorization: Bearer [token]\` header.\n4. The server middleware verifies the token signature and expiry before processing requests.\n5. Tokens expire after **24 hours** — you'll need to log in again.\n\n**Security features:**\n- Passwords are hashed with \`bcryptjs\` (bcrypt algorithm)\n- Tokens are signed — they cannot be tampered with\n- Each user's data is isolated (domains, resources, chat history)`,
        suggestions: ["Troubleshoot 401 error", "How to change my password?"],
      };

    case "datetime":
      return {
        reply: `🕐 The current date and time is:\n\n**${dateStr}**\n**${timeStr}** (IST)\n\nIs there anything else I can help you with?`,
        suggestions: [],
      };

    case "math": {
      try {
        // Safe eval for basic math
        const sanitized = message.replace(/[^0-9+\-*/().\s^%]/g, "");
        if (!sanitized.trim()) throw new Error("Invalid");
        const result = Function('"use strict"; return (' + sanitized + ")")();
        return {
          reply: `🔢 **${message} = ${result}**\n\nIs there anything else I can help you with?`,
          suggestions: [],
        };
      } catch {
        return {
          reply: `I couldn't calculate that expression. Could you rephrase it?\n\nExample: "2 + 2", "100 / 4", "(50 * 3) - 20"`,
          suggestions: [],
        };
      }
    }

    case "joke":
      const jokes = [
        "Why don't programmers like nature? Because it has too many bugs! 🐛",
        "What do you call a database administrator who can't commit? A rollback! 😄",
        "Why did the vector go to therapy? Because it had too many inner products! 🧮",
        "How many programmers does it take to change a light bulb? None — that's a hardware problem! 💡",
        "Why do Java developers wear glasses? Because they don't C#! 👓",
      ];
      return {
        reply: `😄 Here's one:\n\n*${jokes[Math.floor(Math.random() * jokes.length)]}*\n\nNow, how can I actually help you with your knowledge base? 😊`,
        suggestions: ["How does semantic search work?", "Show my domains"],
      };

    case "weather":
      return {
        reply: `I'm sorry, I don't have access to real-time weather data — I'm a knowledge base assistant, not a weather service! 🌤️\n\nFor weather, I'd recommend checking Google, Weather.com, or your phone's weather app.\n\nIs there anything else I can help you with regarding your knowledge base or the platform?`,
        suggestions: ["What can you do?", "How does semantic search work?"],
      };

    case "general_question":
      return null; // fall through to KB search

    default:
      return null; // fall through to KB search
  }
}

// ─── GENERATE SMART ANSWER FROM KB MATCHES ───────────────────────────────────
function buildKBAnswer(message, topMatches, domainMap) {
  if (topMatches.length === 0) return null;

  const best = topMatches[0];
  const simPct = Math.round(best.similarity * 100);

  // Very strong match — give direct confident answer
  if (best.similarity >= 0.7) {
    const content = best.content ? best.content.slice(0, 600) : best.title;
    const hasMore = best.content && best.content.length > 600;
    return {
      reply: `Based on **${best.title}** in *${best.domainName}* (${simPct}% match):\n\n${content}${hasMore ? "\n\n*...content continues. Open the resource for full details.*" : ""}`,
      sources: topMatches.slice(0, 3).map((m) => ({
        id: m.id,
        title: m.title,
        domainName: m.domainName,
        type: m.type,
        similarity: Math.round(m.similarity * 100),
      })),
      suggestions: [
        "Tell me more",
        "Search for related topics",
        "Show all resources",
      ],
    };
  }

  // Good match — answer with context and note similarity
  if (best.similarity >= 0.45) {
    const content = best.content ? best.content.slice(0, 500) : best.title;
    const hasMore = best.content && best.content.length > 500;
    let reply = `I found a related entry (${simPct}% match) from **${best.title}** in *${best.domainName}*:\n\n${content}${hasMore ? "..." : ""}`;
    if (topMatches.length > 1) {
      reply +=
        `\n\n**Also related:**\n` +
        topMatches
          .slice(1, 3)
          .map(
            (m) =>
              `- **${m.title}** (${Math.round(m.similarity * 100)}% match) — *${m.domainName}*`,
          )
          .join("\n");
    }
    return {
      reply,
      sources: topMatches.slice(0, 3).map((m) => ({
        id: m.id,
        title: m.title,
        domainName: m.domainName,
        type: m.type,
        similarity: Math.round(m.similarity * 100),
      })),
      suggestions: [
        "Show more results in search",
        "How to improve search accuracy?",
      ],
    };
  }

  // Weak match — mention it but be transparent
  if (best.similarity >= 0.35) {
    const content = best.content ? best.content.slice(0, 300) : best.title;
    return {
      reply: `I found a loosely related entry (${simPct}% match) — it may not be exactly what you're looking for:\n\n**${best.title}** (*${best.domainName}*): ${content}...\n\n*For better results, try rephrasing your question or use the **Search** tab with a lower similarity threshold.*`,
      sources: [
        {
          id: best.id,
          title: best.title,
          domainName: best.domainName,
          type: best.type,
        },
      ],
      suggestions: [
        "Go to search",
        "How to improve search accuracy?",
        "Add this information as a resource",
      ],
    };
  }

  return null;
}

// ─── MAIN CHAT ROUTE ──────────────────────────────────────────────────────────
router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { message, language = "en", conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const langCode = (language || "en").toLowerCase().slice(0, 2);
    const trimmedMsg = message.trim();

    // 1. Fetch user's domains and resources
    const domains = await Domain.find({ createdBy: req.user.userId }).select(
      "_id name description",
    );
    const domainMap = {};
    const domainIds = domains.map((d) => {
      domainMap[d._id.toString()] = d.name;
      return d._id;
    });

    const resources =
      domainIds.length > 0
        ? await Resource.find({
            domainId: { $in: domainIds },
            embedding: { $exists: true, $ne: [] },
          })
        : [];

    // 2. Detect intent first (handles greetings, platform questions, troubleshooting, etc.)
    const intent = detectIntent(trimmedMsg);
    const intentResult = intent
      ? buildIntentReply(intent, {
          domains,
          resources,
          message: trimmedMsg,
          langCode,
        })
      : null;

    if (intentResult) {
      return res.json({
        reply: intentResult.reply,
        language: langCode,
        sources: intentResult.sources || [],
        suggestions: intentResult.suggestions || [],
      });
    }

    // 3. No intent match — search the knowledge base using hybrid ranking
    // Same ranking strategy as the main semantic search:
    // 60% semantic + 30% keyword + 10% phrase + coverage boost.

    let topMatches = [];

    if (resources.length > 0) {
      const queryEmbedding = await generateEmbedding(trimmedMsg);

      const queryKeywords = getSearchKeywords(trimmedMsg);

      const scored = resources.map((r) => {
        const rawCosine = cosineSimilarity(queryEmbedding, r.embedding);

        // Keep the raw cosine score for the semantic component.
        const semanticScore = Math.min(Math.max(rawCosine, 0), 1);

        const keywordScore = calculateKeywordScore(
          queryKeywords,
          r.title,
          r.content,
        );

        const keywordCoverage = calculateKeywordCoverage(
          queryKeywords,
          r.title,
          r.content,
        );

        const phraseMatch = calculatePhraseMatch(
          trimmedMsg,
          r.title,
          r.content,
        );

        const hybridScore = calculateHybridScore({
          semanticScore,
          keywordScore,
          phraseMatch,
          keywordCoverage,
        });

        return {
          id: r._id,
          title: r.title,
          content: r.content,
          type: r.type,
          domainId: r.domainId,
          domainName: domainMap[r.domainId.toString()] || "Knowledge Domain",

          // Main score used by the Assistant
          similarity: hybridScore,

          // Detailed scoring information
          semanticScore,
          keywordScore,
          keywordCoverage,
          phraseMatch,
          hybridScore,
        };
      });

      scored.sort((a, b) => {
        if (b.hybridScore !== a.hybridScore) {
          return b.hybridScore - a.hybridScore;
        }

        return b.keywordCoverage - a.keywordCoverage;
      });

      topMatches = scored.slice(0, 5).filter((m) => {
        // Minimum useful hybrid score
        if (m.hybridScore < 0.3) {
          return false;
        }

        // For multi-word questions, require either
        // reasonable keyword coverage or strong semantic similarity.
        if (queryKeywords.length >= 2) {
          if (m.keywordCoverage < 0.25 && m.semanticScore < 0.7) {
            return false;
          }

          if (m.semanticScore < 0.55 && m.keywordCoverage === 0) {
            return false;
          }
        }

        return true;
      });

      console.log("🤖 Assistant hybrid search:", {
        query: trimmedMsg,
        keywords: queryKeywords,
        results: topMatches.map((m) => ({
          title: m.title,
          semantic: Math.round(m.semanticScore * 100),
          keyword: Math.round(m.keywordScore * 100),
          coverage: Math.round(m.keywordCoverage * 100),
          phrase: m.phraseMatch,
          hybrid: Math.round(m.hybridScore * 100),
        })),
      });
    }

    let contextText = "";
    let sources = [];

    if (topMatches.length > 0) {
      const primary = topMatches[0];
      const secondary = topMatches.slice(1, 3);

      sources = topMatches.map((m) => ({
        id: m.id,
        title: m.title,
        domainName: m.domainName,
        type: m.type,
        similarity: Math.round(m.hybridScore * 100),
      }));

      contextText = [
        "PRIMARY SOURCE (highest-ranked and most relevant):",
        `Title: ${primary.title}`,
        `Domain: ${primary.domainName}`,
        `Content: ${primary.content}`,

        secondary.length > 0
          ? "\nSECONDARY SOURCES (use ONLY if the primary source does not fully answer the question):\n" +
            secondary
              .map((m, index) =>
                [
                  `Secondary Resource ${index + 1}:`,
                  `Title: ${m.title}`,
                  `Domain: ${m.domainName}`,
                  `Content: ${m.content}`,
                ].join("\n"),
              )
              .join("\n\n---\n\n")
          : "",
      ].join("\n");
    } else {
      contextText = "No relevant knowledge-base resource was found.";
    }

    const systemPrompt = `You are the AI Assistant for a domain-independent Semantic Search Platform.

Answer the user's question using the retrieved knowledge-base resources.

STRICT RULES:

1. The PRIMARY SOURCE is the highest-ranked and most relevant resource.
2. Always try to answer the question using ONLY the PRIMARY SOURCE first.
3. If the PRIMARY SOURCE completely answers the question, STOP. Do not use information from secondary sources.
4. Use SECONDARY SOURCES only when the primary source is missing an important detail required to answer the question.
5. Never add extra facts simply because they appear in secondary sources.
6. Answer exactly what the user asked, but preserve the scope of every responsibility exactly as stated in the PRIMARY SOURCE.

7. Do not generalize a specific responsibility into overall management. For example, if the source says that a committee manages housekeeping, mess management, and related activities, do not say that the committee manages the entire hostel.

8. Do not combine separate responsibilities into a single responsibility unless the PRIMARY SOURCE explicitly does so.

9. Keep simple factual answers short and direct. Do not add interpretations or conclusions that are not explicitly supported by the PRIMARY SOURCE.
10. Do not mention similarity scores, embeddings, vectors, ranking, retrieval, or internal system details.
11. If the knowledge base does not contain enough information to answer the question, clearly say so.

For example:
If the user asks "Who manages the hostel?" and the PRIMARY SOURCE already identifies who manages the hostel, answer using that source only. Do not add information about the competent authority, block representatives, boarding, or other unrelated sections.`;

    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${contextText}\n\nUser query: ${trimmedMsg}`,
        },
      ],
      model: "openai/gpt-oss-20b", // Using an available model
    });

    const replyText =
      chatCompletion.choices[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    return res.json({
      reply: replyText,
      language: langCode,
      sources: sources,
      suggestions: [],
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    res.status(500).json({
      message: "AI Assistant failed to process message",
      error: error.message,
    });
  }
});

// Helper for date formatting
function getFormattedDateTime(date = new Date()) {
  const d = new Date(date);
  const monthNames = [
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
  const day = String(d.getDate()).padStart(2, "0");
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, "0");

  return {
    dateFormatted: `${day} ${month} ${year}`,
    timeFormatted: `${strHours}:${minutes} ${ampm}`,
    year: year,
  };
}

// POST save / update a chat history session
router.post("/history/save", authMiddleware, async (req, res) => {
  try {
    const { sessionId, title, messages } = req.body;
    if (!sessionId || !messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ message: "sessionId and messages array are required" });
    }

    const { dateFormatted, timeFormatted, year } = getFormattedDateTime();

    const formattedMessages = messages.map((m) => {
      const msgDate = m.timestamp ? new Date(m.timestamp) : new Date();
      const dt = getFormattedDateTime(msgDate);
      return {
        role: m.role || "user",
        content: m.content || "",
        timestamp: msgDate,
        dateString: dt.dateFormatted,
        timeString: dt.timeFormatted,
        year: dt.year,
        sources: m.sources || [],
      };
    });

    let historyDoc = await ChatHistory.findOne({
      userId: req.user.userId,
      sessionId,
    });

    if (historyDoc) {
      historyDoc.messages = formattedMessages;
      if (
        title &&
        (!historyDoc.title || historyDoc.title === "AI Assistant Conversation")
      ) {
        historyDoc.title = title;
      }
      historyDoc.dateFormatted = dateFormatted;
      historyDoc.timeFormatted = timeFormatted;
      historyDoc.year = year;
      await historyDoc.save();
    } else {
      historyDoc = new ChatHistory({
        userId: req.user.userId,
        sessionId,
        title:
          title ||
          (messages[0]?.content
            ? messages[0].content.slice(0, 50)
            : "AI Assistant Conversation"),
        messages: formattedMessages,
        dateFormatted,
        timeFormatted,
        year,
      });
      await historyDoc.save();
    }

    res.status(200).json({
      message: "Chat session saved to history successfully",
      history: historyDoc,
    });
  } catch (err) {
    console.error("Save chat history error:", err);
    res
      .status(500)
      .json({ message: "Failed to save chat history", error: err.message });
  }
});

// GET all chat history sessions for the authenticated user
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const histories = await ChatHistory.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(histories);
  } catch (err) {
    console.error("Fetch chat history error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch chat history", error: err.message });
  }
});

// DELETE single chat session from history
router.delete("/history/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await ChatHistory.findOneAndDelete({
      userId: req.user.userId,
      sessionId,
    });

    res.status(200).json({ message: "Chat session removed from history" });
  } catch (err) {
    console.error("Delete chat session error:", err);
    res
      .status(500)
      .json({ message: "Failed to delete chat session", error: err.message });
  }
});

// DELETE all chat history for user
router.delete("/history", authMiddleware, async (req, res) => {
  try {
    await ChatHistory.deleteMany({ userId: req.user.userId });
    res.status(200).json({ message: "All chat history cleared" });
  } catch (err) {
    console.error("Clear all chat history error:", err);
    res
      .status(500)
      .json({ message: "Failed to clear chat history", error: err.message });
  }
});

module.exports = router;
