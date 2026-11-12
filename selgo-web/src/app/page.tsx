"use client";

import React, { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://vx9-core-71a.vercel.app";

const ROOT_ROLES = [
  { key: "software_engineer", label: "Software Engineer", sub: "Full-stack, backend, cloud architecture & AI engineering" },
  { key: "data_scientist", label: "Data Scientist & Analyst", sub: "Machine learning, SQL, BI reporting & predictive analytics" },
  { key: "sales_growth", label: "Sales & Revenue Leader", sub: "Outbound prospecting, deal closing & pipeline automation" },
  { key: "founder_exec", label: "Founder & Executive", sub: "Building startups, agencies & scaling company operations" },
  { key: "student_researcher", label: "Student & Researcher", sub: "Academic study, coding labs, STEM & thesis research" },
  { key: "real_estate", label: "Real Estate & Property", sub: "Brokerage, buyer qualification, leasing & tour scheduling" },
  { key: "retail_ecommerce", label: "Retail & E-Commerce", sub: "Store inventory, supplier reorders & customer order flow" },
  { key: "agribusiness", label: "Agribusiness & Poultry", sub: "Flock/livestock health, feed conversion & wholesale supply" },
];

const ROLE_BRANCH_ROUTES: Record<string, any> = {
  software_engineer: {
    q2_title: "Which engineering workflow do you want an AI Agent to handle first?",
    q2_sub: "Tailored route for Software Engineers — choose your primary technical bottleneck.",
    q2_options: [
      { label: "Automated Code Review & Bug Detection", sub: "Audit pull requests, catch security flaws & refactor code" },
      { label: "API Architecture & Backend Scaffolding", sub: "Generate FastAPI/Node endpoints, schemas & database models" },
      { label: "DevOps, CI/CD & Cloud Log Monitoring", sub: "Detect server crashes, optimize containers & automate deploys" },
      { label: "Automated Unit Testing & QA Suites", sub: "Write high-coverage integration tests across your codebase" },
    ],
    q3_title: "What is your primary development stack?",
    q3_sub: "Final step — Selgo will rank engineering agents built for your stack.",
    q3_options: [
      { label: "Python, FastAPI & AI Microservices", sub: "Backend systems, LLMs & data pipelines" },
      { label: "TypeScript, React & Next.js Full-Stack", sub: "Modern web applications & cloud APIs" },
      { label: "Cloud Infrastructure, Docker & Kubernetes", sub: "Distributed systems & site reliability" },
      { label: "Multi-Language Enterprise Repositories", sub: "Large-scale polyglot production systems" },
    ],
  },
  data_scientist: {
    q2_title: "Which data bottleneck slows your analysis down the most?",
    q2_sub: "Tailored route for Data Scientists & Analysts — select your core workflow.",
    q2_options: [
      { label: "SQL Query Generation & Pipeline Cleaning", sub: "Transform messy tables into clean, validated datasets" },
      { label: "Automated Executive KPI & BI Reporting", sub: "Generate daily revenue, churn & growth insights automatically" },
      { label: "Predictive Forecasting & Anomaly Detection", sub: "Spot demand spikes, fraud & operational risks early" },
      { label: "Unstructured Document & CSV Extraction", sub: "Parse PDFs, invoices & raw logs into structured tables" },
    ],
    q3_title: "What type of data do you analyze daily?",
    q3_sub: "Final step — matching you with specialized data & analytics agents.",
    q3_options: [
      { label: "Financial, Revenue & Pricing Data", sub: "P&L ledgers, margins & transaction streams" },
      { label: "Customer Behavior & Product Telemetry", sub: "User retention, funnels & conversion cohorts" },
      { label: "Supply Chain, Inventory & Logistics Data", sub: "Stock velocity, lead times & warehouse metrics" },
      { label: "Scientific & Experimental Datasets", sub: "Research models & statistical benchmarks" },
    ],
  },
  sales_growth: {
    q2_title: "Where are you losing the most deals in your sales pipeline?",
    q2_sub: "Tailored route for Sales & Revenue Leaders — pick your #1 revenue priority.",
    q2_options: [
      { label: "24/7 Inbound Lead Qualification & Scoring", sub: "Respond in seconds and filter high-intent buyers" },
      { label: "Outbound Prospecting & Follow-Up Sequences", sub: "Write personalized multi-touch outreach that books calls" },
      { label: "Objection Handling & Proposal Generation", sub: "Draft tailored quotes, ROI breakdowns & deal terms" },
      { label: "Automated Calendar Booking & CRM Hygiene", sub: "Keep pipeline stages updated without manual data entry" },
    ],
    q3_title: "How do your customers primarily buy from you?",
    q3_sub: "Final step — matching you with high-converting sales agents.",
    q3_options: [
      { label: "High-Ticket B2B & Enterprise Deals", sub: "Multi-stakeholder consultative sales cycles" },
      { label: "High-Volume Inbound Phone & Voice Calls", sub: "Direct consumer or commercial phone inquiries" },
      { label: "Digital Self-Serve & Inbound Chat", sub: "Fast-moving online leads & subscriptions" },
      { label: "Field Sales & Local Territory Accounts", sub: "In-person meetings, site visits & wholesale orders" },
    ],
  },
  founder_exec: {
    q2_title: "Which department in your company needs an AI teammate first?",
    q2_sub: "Tailored route for Founders & Executives — choose where to unlock leverage.",
    q2_options: [
      { label: "Revenue, Sales & Client Acquisition", sub: "Grow top-line pipeline without hiring a bigger sales team" },
      { label: "Operations, Fulfillment & Team Workflows", sub: "Eliminate repetitive daily bottlenecks across operations" },
      { label: "Finance, Invoicing & Cashflow Auditing", sub: "Track unit economics, expenses & overdue receivables" },
      { label: "24/7 Customer Support & Client Retention", sub: "Resolve client requests instantly by voice and chat" },
    ],
    q3_title: "What stage is your organization currently in?",
    q3_sub: "Final step — ranking autonomous agents built for your scale.",
    q3_options: [
      { label: "Early-Stage Startup Building Traction", sub: "Moving fast with a lean founding team" },
      { label: "Growing SME Scaling Daily Operations", sub: "Standardizing processes across multiple staff" },
      { label: "Digital Agency Managing Client Accounts", sub: "Delivering automation & results for B2B clients" },
      { label: "Established Enterprise Optimizing Margins", sub: "Reducing overhead across large departments" },
    ],
  },
  student_researcher: {
    q2_title: "Which academic or research task do you want an AI Agent to accelerate?",
    q2_sub: "Tailored route for Students & Researchers — choose your primary study focus.",
    q2_options: [
      { label: "STEM Problem Solving (Math, Physics & Chemistry)", sub: "Step-by-step derivations, formulas & exam preparation" },
      { label: "Coding Projects, Algorithms & Debugging", sub: "Build software projects and master data structures" },
      { label: "Research Paper Summarization & Citations", sub: "Synthesize complex literature and technical PDFs" },
      { label: "Technical Writing, Essays & Presentations", sub: "Structure clear, high-scoring reports and books" },
    ],
    q3_title: "What is your primary field of study?",
    q3_sub: "Final step — matching you with academic & research agents.",
    q3_options: [
      { label: "Computer Science, AI & Data Science", sub: "Programming, machine learning & systems" },
      { label: "Natural Sciences, Physics & Engineering", sub: "Mathematics, chemistry, physics & mechanics" },
      { label: "Business, Leadership & Economics", sub: "Entrepreneurship, finance & management" },
      { label: "Medicine, Biology & Health Sciences", sub: "Clinical sciences & biotechnology" },
    ],
  },
  real_estate: {
    q2_title: "Which real estate bottleneck do you want automated first?",
    q2_sub: "Tailored route for Real Estate Professionals — choose your top priority.",
    q2_options: [
      { label: "24/7 Buyer Qualification & Budget Screening", sub: "Filter serious buyers from casual inquiries automatically" },
      { label: "Automated Property Tour & Viewing Scheduler", sub: "Book on-site visits directly into your calendar" },
      { label: "Property ROI, Rental Yield & Pricing Analysis", sub: "Compute instant investment numbers for clients" },
      { label: "Tenant Communications & Lease Follow-Ups", sub: "Automate rent reminders and maintenance requests" },
    ],
    q3_title: "What type of properties do you primarily handle?",
    q3_sub: "Final step — ranking real estate agents for your portfolio.",
    q3_options: [
      { label: "Residential Homes & Apartments", sub: "Home buyers, sellers & residential leasing" },
      { label: "Commercial Offices & Retail Spaces", sub: "Corporate tenants & commercial investors" },
      { label: "New Developments & Land Sales", sub: "Off-plan projects & construction marketing" },
      { label: "Property Management & Short-Term Rentals", sub: "Multi-unit operations & guest turnover" },
    ],
  },
  retail_ecommerce: {
    q2_title: "Which retail or e-commerce operation needs automation first?",
    q2_sub: "Tailored route for Retail & E-Commerce — select your daily bottleneck.",
    q2_options: [
      { label: "Stockout Prevention & Inventory Tracking", sub: "Monitor daily stock depletion and reorder points" },
      { label: "Automated Customer Order & Delivery Support", sub: "Answer buyer questions and track orders 24/7" },
      { label: "Supplier Purchase Orders & Cost Auditing", sub: "Compare vendor pricing and automate restocking" },
      { label: "Product Margin & Promotions Optimization", sub: "Identify best-sellers and dead stock immediately" },
    ],
    q3_title: "How do you primarily sell your products?",
    q3_sub: "Final step — matching you with retail operations agents.",
    q3_options: [
      { label: "Physical Retail Storefront or Multi-Branch", sub: "In-store POS, shelf stock & walk-in customers" },
      { label: "Online E-Commerce & Social Commerce", sub: "Digital catalog, direct-to-consumer & delivery" },
      { label: "Wholesale & B2B Distribution", sub: "Bulk orders, trade accounts & logistics" },
    ],
  },
  agribusiness: {
    q2_title: "Which farm or livestock operation do you want an AI Agent to manage?",
    q2_sub: "Tailored route for Agribusiness & Poultry — choose your operational focus.",
    q2_options: [
      { label: "Poultry Feed Conversion (FCR) & Ration Planning", sub: "Optimize daily feed weights and reduce feed waste" },
      { label: "Flock/Livestock Health & Mortality Monitoring", sub: "Track vaccination schedules, biosecurity & alerts" },
      { label: "Wholesale Egg, Broiler & Produce Order Tracking", sub: "Manage buyer orders, dispatches & daily pricing" },
      { label: "Farm Expense, Input Cost & Margin Accounting", sub: "Calculate exact profit per batch or harvest cycle" },
    ],
    q3_title: "What is the primary focus of your agricultural operation?",
    q3_sub: "Final step — ranking agribusiness agents for your farm.",
    q3_options: [
      { label: "Commercial Poultry (Layers & Broilers)", sub: "Egg production, hatchery & broiler flocks" },
      { label: "Livestock, Dairy & Cattle Operations", sub: "Herd nutrition, veterinary logs & yield tracking" },
      { label: "Crop Farming & Agri-Processing", sub: "Harvest planning, irrigation & commodity sales" },
    ],
  },
};

export default function SelgoReactApp() {
  // Auth & Session State
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [emailToast, setEmailToast] = useState<any>(null);

  // Forgot Password State
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverStep2, setRecoverStep2] = useState(false);
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverNewPassword, setRecoverNewPassword] = useState("");
  const [recoverStatus, setRecoverStatus] = useState("");

  // Core App State
  const [user, setUser] = useState<any>(null);
  const [devProfile, setDevProfile] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [activeSubId, setActiveSubId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"mentor" | "marketplace" | "workspace" | "developer">("mentor");

  // Mentor AI State
  const [mentorInput, setMentorInput] = useState("");
  const [mentorMemory, setMentorMemory] = useState<any>({ owner_name: null, industry: null, pain_point: null });
  const [mentorHistory, setMentorHistory] = useState<any[]>([]);
  const [canShowMarketBtn, setCanShowMarketBtn] = useState(false);

  // Marketplace & Branched Onboarding State
  const [agents, setAgents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [quizStep, setQuizStep] = useState(1);
  const [onboarding, setOnboarding] = useState<any>({
    completed: false,
    role_key: "",
    role_label: "",
    need_label: "",
    context_label: "",
  });

  // Modals: Public Creator, Sandbox Preview, Comments, Subscribe
  const [publicCreatorModal, setPublicCreatorModal] = useState<any>(null);
  const [sandboxAgent, setSandboxAgent] = useState<any>(null);
  const [sandboxPrompt, setSandboxPrompt] = useState("");
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const [commentsAgent, setCommentsAgent] = useState<any>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");

  const [subModalAgent, setSubModalAgent] = useState<any>(null);
  const [subBusinessName, setSubBusinessName] = useState("");
  const [subBusinessGoal, setSubBusinessGoal] = useState("");
  const [subPaymentMethod, setSubPaymentMethod] = useState("Card");

  // Workspace State
  const [wsInput, setWsInput] = useState("");
  const [wsKnowledge, setWsKnowledge] = useState("");
  const [wsKnowledgeStatus, setWsKnowledgeStatus] = useState("Ready for company data");
  const [wsTelemetry, setWsTelemetry] = useState<Record<string, any>>({});
  const [wsSpeedMs, setWsSpeedMs] = useState<string>("Ready");

  // Creator Profile & Agent Post State
  const [avatarUrl, setAvatarUrl] = useState(
    "https://api.dicebear.com/9.x/initials/svg?seed=Creator&backgroundColor=0f172a"
  );
  const [devDisplayName, setDevDisplayName] = useState("");
  const [devUsername, setDevUsername] = useState("");
  const [devHeadline, setDevHeadline] = useState("");
  const [devBio, setDevBio] = useState("");
  const [devSkills, setDevSkills] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);

  const [agName, setAgName] = useState("");
  const [agPrice, setAgPrice] = useState("49");
  const [agIndustry, setAgIndustry] = useState("");
  const [agTagline, setAgTagline] = useState("");
  const [agSystemPrompt, setAgSystemPrompt] = useState(
    "You are a dedicated AI specialist working inside this business. Give actionable calculations, draft high-converting client responses, and execute tasks accurately."
  );
  const [agDescription, setAgDescription] = useState("");
  const [agCode, setAgCode] = useState(
    `class AgentWorker:\n    def run(self, ctx, payload):\n        user_msg = payload.get("message", "Task")\n        total_runs = int(ctx.get_memory("runs", 0)) + 1\n        ctx.set_memory("runs", total_runs)\n        kb_status = "Loaded" if ctx.knowledge_base else "Empty"\n        return {\n            "tasks_handled": total_runs,\n            "company_knowledge": kb_status,\n            "status": "Executed & Verified Inside Selgo Cloud"\n        }`
  );
  const [deployMessage, setDeployMessage] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Telebirr Wallet");
  const [payoutAccount, setPayoutAccount] = useState("");

  // Voice Dictation & Gemini-Style Live Voice Call State
  const [dictatingTarget, setDictatingTarget] = useState<"mentor" | "workspace" | null>(null);
  const dictationRef = useRef<any>(null);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [liveVoiceTarget, setLiveVoiceTarget] = useState<"mentor" | "agent">("mentor");
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<"listening" | "thinking" | "speaking">("listening");
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState("Speak naturally — I'm listening.");
  const liveCallActiveRef = useRef(false);
  const liveRecRef = useRef<any>(null);

  const activeSub = subscriptions.find((s) => s.subscription_id === activeSubId) || subscriptions[0] || null;

  function triggerEmailToast(notice: any) {
    if (!notice) return;
    setEmailToast(notice);
    setTimeout(() => setEmailToast(null), 10000);
  }

  // Restore 30-Day Persistent Session on Startup
  useEffect(() => {
    const savedToken = localStorage.getItem("selgo_auth_token");
    const savedOnboarding = localStorage.getItem("selgo_onboarding_profile");
    if (savedOnboarding) {
      try {
        const parsed = JSON.parse(savedOnboarding);
        if (parsed?.completed) setOnboarding(parsed);
      } catch {}
    }
    if (savedToken) {
      fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          setToken(savedToken);
          setUser(data.user);
          setDevProfile(data.developer_profile);
          setSubscriptions(data.subscriptions || []);
          if (data.subscriptions?.length > 0) {
            setActiveSubId(data.subscriptions[0].subscription_id);
            setWsKnowledge(data.subscriptions[0].knowledge_base_text || "");
          }
          if (data.user?.onboarding?.completed) {
            setOnboarding(data.user.onboarding);
            localStorage.setItem("selgo_onboarding_profile", JSON.stringify(data.user.onboarding));
          }
          setDevDisplayName(data.user.full_name);
          setDevUsername(data.user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_"));
          loadMarketplace(savedToken);
        })
        .catch(() => {
          localStorage.removeItem("selgo_auth_token");
        });
    }
  }, []);

  async function loadMarketplace(activeTok?: string | null) {
    const tok = activeTok ?? token;
    try {
      const res = await fetch(`${API_BASE}/api/v1/marketplace/agents`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch {}
  }

  // Password Strength Helper
  function getPasswordStrength(pw: string) {
    const hasLen = pw.length >= 8;
    const hasLet = /[A-Za-z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    return (hasLen ? 1 : 0) + (hasLet ? 1 : 0) + (hasNum ? 1 : 0);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "signup" ? "/api/v1/auth/signup" : "/api/v1/auth/login";
    const body =
      authMode === "signup"
        ? { full_name: fullName || email.split("@")[0], email, password }
        : { email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Authentication failed.");
        if (String(data.detail || "").toLowerCase().includes("already exists")) {
          setTimeout(() => setAuthMode("login"), 1200);
        }
        return;
      }
      localStorage.setItem("selgo_auth_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setDevProfile(data.developer_profile);
      setSubscriptions(data.subscriptions || []);
      if (data.subscriptions?.length > 0) {
        setActiveSubId(data.subscriptions[0].subscription_id);
        setWsKnowledge(data.subscriptions[0].knowledge_base_text || "");
      }
      if (data.user?.onboarding?.completed) {
        setOnboarding(data.user.onboarding);
        localStorage.setItem("selgo_onboarding_profile", JSON.stringify(data.user.onboarding));
      }
      if (data.email_notification) triggerEmailToast(data.email_notification);
      setDevDisplayName(data.user.full_name);
      setDevUsername(data.user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_"));
      loadMarketplace(data.token);
    } catch {
      setAuthError("Cannot reach FastAPI on port 8000. Make sure uvicorn main:app --reload is running.");
    }
  }

  async function handleSendRecoveryCode() {
    if (!recoverEmail.trim()) return;
    const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: recoverEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setRecoverStep2(true);
      setRecoverStatus(data.message);
      if (data.email_notification) triggerEmailToast(data.email_notification);
    } else {
      setRecoverStatus(data.detail || "Account not found.");
    }
  }

  async function handleConfirmPasswordReset() {
    const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: recoverEmail,
        recovery_code: recoverCode,
        new_password: recoverNewPassword,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("selgo_auth_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setDevProfile(data.developer_profile);
      setSubscriptions(data.subscriptions || []);
      if (data.email_notification) triggerEmailToast(data.email_notification);
      loadMarketplace(data.token);
    } else {
      setRecoverStatus(data.detail || "Reset failed.");
    }
  }

  // Voice Dictation (Speak-to-Type)
  function toggleVoiceDictation(target: "mentor" | "workspace") {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice input requires Google Chrome or Microsoft Edge.");
      return;
    }
    if (dictatingTarget && dictationRef.current) {
      dictationRef.current.stop();
      setDictatingTarget(null);
      return;
    }

    const rec = new SpeechRec();
    rec.interimResults = true;
    rec.continuous = false;
    dictationRef.current = rec;
    setDictatingTarget(target);

    const startVal = target === "mentor" ? (mentorInput ? mentorInput + " " : "") : wsInput ? wsInput + " " : "";
    rec.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      if (target === "mentor") setMentorInput(startVal + text);
      else setWsInput(startVal + text);
    };
    rec.onend = () => setDictatingTarget(null);
    rec.start();
  }

  // Gemini-Style Hands-Free Live Voice Call
  function startLiveVoice(mode: "mentor" | "agent") {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Live Voice requires Google Chrome or Microsoft Edge.");
      return;
    }
    setLiveVoiceTarget(mode);
    setLiveVoiceOpen(true);
    liveCallActiveRef.current = true;
    beginListeningTurn(mode);
  }

  function beginListeningTurn(mode: "mentor" | "agent") {
    if (!liveCallActiveRef.current) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (liveRecRef.current) {
      try {
        liveRecRef.current.stop();
      } catch {}
    }

    const rec = new SpeechRec();
    rec.interimResults = true;
    rec.continuous = false;
    liveRecRef.current = rec;

    setLiveVoiceStatus("listening");
    let finalSpoken = "";

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalSpoken += piece;
        else interim += piece;
      }
      setLiveVoiceTranscript(`"${finalSpoken || interim}"`);
    };

    rec.onend = async () => {
      if (!liveCallActiveRef.current) return;
      const clean = finalSpoken.trim();
      if (!clean) {
        if (liveCallActiveRef.current) {
          try {
            rec.start();
          } catch {}
        }
        return;
      }

      setLiveVoiceStatus("thinking");
      if (mode === "mentor") {
        const res = await fetch(`${API_BASE}/api/v1/mentor/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_message: clean,
            memory: mentorMemory,
            history: mentorHistory,
            voice_mode: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMentorMemory(data.memory || mentorMemory);
          setMentorHistory((prev) => [...prev, { role: "user", content: clean }, { role: "assistant", content: data.ai_reply }]);
          speakLiveReply(data.ai_reply, mode);
        }
      } else if (activeSub) {
        const res = await fetch(`${API_BASE}/api/v1/workspace/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription_id: activeSub.subscription_id,
            message: clean,
            voice_mode: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSubscriptions((prev) =>
            prev.map((s) =>
              s.subscription_id === activeSub.subscription_id
                ? {
                    ...s,
                    tasks_completed: data.metrics.tasks_completed,
                    minutes_saved: data.metrics.minutes_saved,
                    value_created_usd: data.metrics.value_created_usd,
                    chat_history: data.chat_history,
                  }
                : s
            )
          );
          speakLiveReply(data.agent_reply, mode);
        }
      }
    };

    try {
      rec.start();
    } catch {}
  }

  function speakLiveReply(replyText: string, mode: "mentor" | "agent") {
    if (!liveCallActiveRef.current) return;
    setLiveVoiceStatus("speaking");
    setLiveVoiceTranscript(replyText);

    if (!window.speechSynthesis) {
      setTimeout(() => beginListeningTurn(mode), 3000);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(replyText);
    utter.rate = 1.03;
    utter.onend = () => {
      if (liveCallActiveRef.current) beginListeningTurn(mode);
    };
    utter.onerror = () => {
      if (liveCallActiveRef.current) beginListeningTurn(mode);
    };
    window.speechSynthesis.speak(utter);
  }

  function stopLiveVoice() {
    liveCallActiveRef.current = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (liveRecRef.current) {
      try {
        liveRecRef.current.stop();
      } catch {}
    }
    setLiveVoiceOpen(false);
  }

  async function handleMentorSend(e: React.FormEvent) {
    e.preventDefault();
    if (!mentorInput.trim()) return;
    const msg = mentorInput.trim();
    setMentorInput("");
    const nextHist = [...mentorHistory, { role: "user", content: msg }];
    setMentorHistory(nextHist);

    const res = await fetch(`${API_BASE}/api/v1/mentor/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_message: msg,
        memory: mentorMemory,
        history: mentorHistory,
        voice_mode: false,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setMentorMemory(data.memory || mentorMemory);
      setCanShowMarketBtn(Boolean(data.can_show_marketplace_button));
      setMentorHistory([...nextHist, { role: "assistant", content: data.ai_reply }]);
    }
  }

  async function finishOnboarding(finalContextLabel: string) {
    const updated = {
      ...onboarding,
      completed: true,
      context_label: finalContextLabel,
    };
    setOnboarding(updated);
    localStorage.setItem("selgo_onboarding_profile", JSON.stringify(updated));
    if (token) {
      await fetch(`${API_BASE}/api/v1/auth/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
    }
  }

  function computeMatchScore(ag: any) {
    if (!onboarding.role_label && !onboarding.need_label && !mentorMemory.industry) return null;
    const hay = `${ag.name} ${ag.industry} ${ag.tagline} ${ag.description}`.toLowerCase();
    let score = 84;
    const roleWords = String(onboarding.role_label || mentorMemory.industry || "")
      .toLowerCase()
      .split(/\W+/);
    const needWords = String(onboarding.need_label || onboarding.context_label || "")
      .toLowerCase()
      .split(/\W+/);
    roleWords.forEach((w) => {
      if (w.length > 2 && hay.includes(w)) score += 7;
    });
    needWords.forEach((w) => {
      if (w.length > 2 && hay.includes(w)) score += 4;
    });
    return Math.min(99, score);
  }

  async function reactToAgent(agentId: number, reactionType: string) {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reaction_type: reactionType }),
    });
    if (res.ok) {
      const data = await res.json();
      setAgents((prev) =>
        prev.map((a) =>
          a.agent_id === agentId
            ? {
                ...a,
                likes_count: data.likes_count,
                fire_count: data.fire_count,
                rocket_count: data.rocket_count,
                user_liked: data.user_liked,
              }
            : a
        )
      );
    }
  }

  async function openCommentsDrawer(ag: any) {
    setCommentsAgent(ag);
    const res = await fetch(`${API_BASE}/api/v1/agents/${ag.agent_id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setCommentsList(data.comments || []);
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentsAgent || !commentInput.trim() || !token) return;
    const res = await fetch(`${API_BASE}/api/v1/agents/${commentsAgent.agent_id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: commentInput }),
    });
    if (res.ok) {
      const data = await res.json();
      setCommentsList(data.comments || []);
      setCommentInput("");
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === commentsAgent.agent_id ? { ...a, comments_count: (data.comments || []).length } : a))
      );
    }
  }

  async function handleRunSandbox(e: React.FormEvent) {
    e.preventDefault();
    if (!sandboxAgent || !sandboxPrompt.trim() || !token) return;
    setSandboxLoading(true);
    const res = await fetch(`${API_BASE}/api/v1/agents/preview-sandbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agent_id: sandboxAgent.agent_id,
        sample_prompt: sandboxPrompt,
      }),
    });
    const data = await res.json();
    setSandboxLoading(false);
    if (res.ok) setSandboxResult(data);
    else setSandboxResult({ agent_reply: String(data.detail || "Preview failed"), execution_speed_ms: 0 });
  }

  async function openPublicCreator(username: string) {
    const res = await fetch(`${API_BASE}/api/v1/developers/public/${encodeURIComponent(username)}`);
    if (res.ok) {
      setPublicCreatorModal(await res.json());
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/v1/developers/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username: devUsername,
        display_name: devDisplayName,
        avatar_url: avatarUrl,
        headline: devHeadline,
        bio: devBio,
        skills: devSkills,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDevProfile(data);
      setEditingProfile(false);
    }
  }

  async function handlePublishAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/v1/agents/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: agName,
        industry: agIndustry,
        tagline: agTagline,
        description: agDescription,
        system_prompt: agSystemPrompt,
        monthly_price_usd: parseInt(agPrice || "49", 10),
        python_code: agCode,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setDevProfile(data.developer_profile);
      setDeployMessage(`Published "${data.name}" under your profile!`);
      setAgName("");
      setAgTagline("");
      setAgDescription("");
      setShowPostForm(false);
      loadMarketplace();
    } else {
      setDeployMessage(JSON.stringify(data.detail));
    }
  }

  async function handleDeleteAgent(agentId: number) {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/v1/agents/${agentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setDevProfile(data.developer_profile);
      loadMarketplace();
    }
  }

  async function handleCreatorPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !payoutAccount.trim()) return;
    const res = await fetch(`${API_BASE}/api/v1/developers/payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        payout_method: payoutMethod,
        destination_account: payoutAccount,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setDevProfile(data.developer_profile);
      setPayoutAccount("");
      if (data.email_notification) triggerEmailToast(data.email_notification);
    } else {
      alert(data.detail || "Payout failed.");
    }
  }

  async function handleSubscribeConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !subModalAgent) return;
    const res = await fetch(`${API_BASE}/api/v1/subscriptions/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agent_id: subModalAgent.agent_id,
        business_name: subBusinessName,
        business_goal: subBusinessGoal,
        payment_method: subPaymentMethod,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubscriptions(data.all_subscriptions || []);
      setActiveSubId(data.subscription.subscription_id);
      setWsKnowledge(data.subscription.knowledge_base_text || "");
      if (data.email_notification) triggerEmailToast(data.email_notification);
      setSubModalAgent(null);
      setActiveView("workspace");
    }
  }

  async function handleWorkspaceSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSub || !wsInput.trim()) return;
    const msg = wsInput.trim();
    setWsInput("");

    const res = await fetch(`${API_BASE}/api/v1/workspace/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription_id: activeSub.subscription_id,
        message: msg,
        voice_mode: false,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setWsSpeedMs(`${data.execution_speed_ms} ms`);
      setWsTelemetry(data.structured_output || {});
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.subscription_id === activeSub.subscription_id
            ? {
                ...s,
                tasks_completed: data.metrics.tasks_completed,
                minutes_saved: data.metrics.minutes_saved,
                value_created_usd: data.metrics.value_created_usd,
                chat_history: data.chat_history,
              }
            : s
        )
      );
    }
  }

  async function syncKnowledgeBase() {
    if (!activeSub || !token) return;
    setWsKnowledgeStatus("Syncing...");
    const res = await fetch(`${API_BASE}/api/v1/workspace/knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription_id: activeSub.subscription_id,
        knowledge_base_text: wsKnowledge,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setWsKnowledgeStatus(`Synced (${data.char_count} chars active)`);
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.subscription_id === activeSub.subscription_id ? { ...s, knowledge_base_text: data.knowledge_base_text } : s
        )
      );
    }
  }

  const pwScore = getPasswordStrength(password);
  const currentBranch = ROLE_BRANCH_ROUTES[onboarding.role_key] || ROLE_BRANCH_ROUTES.founder_exec;

  // ===========================================================================
  // GATE 0: LOGIN / SIGNUP / PASSWORD RECOVERY
  // ===========================================================================
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center justify-center px-6 py-12">
        {emailToast && (
          <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900 border border-blue-500/40 rounded-2xl p-4 shadow-2xl">
            <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{emailToast.delivery}</div>
            <div className="text-xs font-bold text-white mt-0.5">{emailToast.subject}</div>
            <p className="text-xs text-slate-300 mt-2 whitespace-pre-line bg-slate-950 border border-slate-800 rounded-xl p-3">
              {emailToast.body}
            </p>
          </div>
        )}

        {/* OFFICIAL SELGO VECTOR LOGO */}
        <div className="flex flex-col items-center mb-9 select-none">
          <div className="flex items-center gap-4">
            <svg className="w-14 h-14 drop-shadow-[0_0_25px_rgba(0,82,255,0.4)]" viewBox="0 0 100 100" fill="none">
              <path
                d="M84 12 C52 22, 16 28, 16 48 C16 60, 34 65, 48 60 L38 52 C29 52, 28 46, 36 42 C48 36, 74 30, 84 12 Z"
                fill="#0066FF"
              />
              <path
                d="M16 88 C48 78, 84 72, 84 52 C84 40, 66 35, 52 40 L62 48 C71 48, 72 54, 64 58 C52 64, 26 70, 16 88 Z"
                fill="#1D4ED8"
              />
            </svg>
            <div className="w-[1.5px] h-12 bg-gradient-to-b from-transparent via-blue-500/60 to-transparent" />
            <span className="text-5xl font-extrabold tracking-tight text-white">Selgo</span>
          </div>
          <div className="mt-2.5 text-xs sm:text-sm font-medium tracking-[0.22em] uppercase text-blue-400">
            AI Agents <span className="mx-1.5 text-blue-500">•</span> Automated for You
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl max-w-md w-full p-7 shadow-2xl">
          {authMode !== "forgot" ? (
            <>
              <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl mb-6 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className={`py-2.5 rounded-lg font-semibold transition ${
                    authMode === "login" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className={`py-2.5 rounded-lg font-semibold transition ${
                    authMode === "signup" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === "signup" && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">Full Name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., Imran Mohamedbeyan"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">Password</label>
                    <button
                      type="button"
                      onClick={() => setAuthMode("forgot")}
                      className="text-[11px] text-blue-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  {authMode === "signup" && (
                    <div className="mt-2 space-y-1">
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            pwScore === 3 ? "bg-emerald-400 w-full" : pwScore >= 1 ? "bg-amber-400 w-2/3" : "bg-slate-800 w-1/4"
                          }`}
                        />
                      </div>
                      <div className={`text-[11px] ${pwScore === 3 ? "text-emerald-400" : "text-slate-500"}`}>
                        {pwScore === 3 ? "Strong password ready" : "Use 8+ characters with letters & numbers"}
                      </div>
                    </div>
                  )}
                </div>

                {authError && (
                  <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] hover:from-blue-600 hover:to-blue-700 text-white font-semibold text-xs py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition"
                >
                  {authMode === "signup" ? "Create My Selgo Account" : "Log In to Selgo"}
                </button>

                <div className="text-center text-[11px] text-slate-500 pt-1">
                  Stays signed in on this device for 30 days automatically.
                </div>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">Account Recovery</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Recover Your Password</h3>
                <p className="text-xs text-slate-400 mt-1">Enter your email to receive a 6-digit recovery code.</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSendRecoveryCode}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl"
                >
                  Send Code
                </button>
              </div>

              {recoverStep2 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <input
                    value={recoverCode}
                    onChange={(e) => setRecoverCode(e.target.value)}
                    placeholder="6-Digit Recovery Code"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-blue-400"
                  />
                  <input
                    type="password"
                    value={recoverNewPassword}
                    onChange={(e) => setRecoverNewPassword(e.target.value)}
                    placeholder="New Strong Password (8+ chars)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmPasswordReset}
                    className="w-full bg-blue-600 text-white font-semibold text-xs py-3 rounded-xl"
                  >
                    Verify Code & Update Password
                  </button>
                </div>
              )}

              {recoverStatus && <div className="text-xs text-blue-300">{recoverStatus}</div>}

              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
              >
                Back to Log In
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MAIN LOGGED-IN REACT APPLICATION
  // ===========================================================================
  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      {/* EMAIL RECEIPT & NOTIFICATION TOAST */}
      {emailToast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-2xl">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{emailToast.delivery}</div>
              <div className="text-xs font-bold text-white">{emailToast.subject}</div>
            </div>
            <button type="button" onClick={() => setEmailToast(null)} className="text-xs text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-300 mt-2.5 whitespace-pre-line bg-slate-950 border border-slate-800 rounded-xl p-3">
            {emailToast.body}
          </p>
        </div>
      )}

      {/* GEMINI-STYLE LIVE VOICE CALL OVERLAY */}
      {liveVoiceOpen && (
        <div className="fixed inset-0 bg-[#050811]/98 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-8">
          <div className="w-full max-w-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <div>
                <div className="text-sm font-semibold text-white">
                  {liveVoiceTarget === "agent" && activeSub ? `Live Call with ${activeSub.agent_name}` : "Selgo Live Voice"}
                </div>
                <div className="text-xs text-slate-400">Hands-free real-time voice conversation</div>
              </div>
            </div>
            <button
              type="button"
              onClick={stopLiveVoice}
              className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center my-auto">
            <div
              onClick={() => beginListeningTurn(liveVoiceTarget)}
              className={`w-40 h-40 rounded-full bg-gradient-to-tr from-blue-600 via-blue-400 to-indigo-600 flex items-center justify-center cursor-pointer transition-all ${
                liveVoiceStatus === "speaking" ? "scale-110 shadow-[0_0_95px_rgba(0,102,255,0.9)]" : "animate-pulse shadow-[0_0_55px_rgba(0,82,255,0.5)]"
              }`}
            >
              <div className="w-32 h-32 rounded-full bg-[#050811] flex items-center justify-center">
                <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none">
                  <path
                    d="M84 12 C52 22, 16 28, 16 48 C16 60, 34 65, 48 60 L38 52 C29 52, 28 46, 36 42 C48 36, 74 30, 84 12 Z"
                    fill="#0066FF"
                  />
                  <path
                    d="M16 88 C48 78, 84 72, 84 52 C84 40, 66 35, 52 40 L62 48 C71 48, 72 54, 64 58 C52 64, 26 70, 16 88 Z"
                    fill="#3B82F6"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-8 text-xs uppercase tracking-widest text-blue-400 font-semibold">
              {liveVoiceStatus === "listening"
                ? "Listening to you..."
                : liveVoiceStatus === "thinking"
                ? "Thinking..."
                : "Speaking to you..."}
            </div>
            <p className="mt-4 text-center text-base sm:text-lg text-slate-200 max-w-xl leading-relaxed min-h-[3.5rem]">
              {liveVoiceTranscript}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => beginListeningTurn(liveVoiceTarget)}
              className="h-11 px-5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Tap to Interrupt</span>
            </button>
            <button
              type="button"
              onClick={stopLiveVoice}
              className="h-11 px-6 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <nav className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 bg-[#050811]/95 backdrop-blur-md z-40">
        <div className="flex items-center gap-7">
          <button type="button" onClick={() => setActiveView("mentor")} className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none">
              <path d="M84 12 C52 22, 16 28, 16 48 C16 60, 34 65, 48 60 L38 52 C29 52, 28 46, 36 42 C48 36, 74 30, 84 12 Z" fill="#0066FF" />
              <path d="M16 88 C48 78, 84 72, 84 52 C84 40, 66 35, 52 40 L62 48 C71 48, 72 54, 64 58 C52 64, 26 70, 16 88 Z" fill="#1D4ED8" />
            </svg>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div className="text-left">
              <div className="font-extrabold tracking-tight text-lg text-white leading-none">Selgo</div>
              <div className="text-[9px] tracking-[0.14em] uppercase text-blue-400 font-medium mt-0.5">AI Agents • Automated</div>
            </div>
          </button>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setActiveView("mentor")}
              className={`px-4 py-1.5 rounded-full font-semibold transition ${
                activeView === "mentor" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              AI Business Mentor
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveView("marketplace");
                loadMarketplace();
              }}
              className={`px-4 py-1.5 rounded-full font-semibold transition ${
                activeView === "marketplace" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Agent Marketplace
            </button>
            {subscriptions.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveView("workspace")}
                className={`px-4 py-1.5 rounded-full font-semibold transition ${
                  activeView === "workspace" ? "bg-blue-600 text-white" : "text-blue-400"
                }`}
              >
                My Business Agents ({subscriptions.length})
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView("developer")}
            className="text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-1.5 rounded-full flex items-center gap-2 transition"
          >
            <img src={devProfile?.avatar_url || avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
            <span>{devProfile ? `@${devProfile.username}` : "My Creator Profile"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("selgo_auth_token");
              setToken(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* =================================================================== */}
      {/* VIEW 1: AI BUSINESS MENTOR                                          */}
      {/* =================================================================== */}
      {activeView === "mentor" && (
        <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-6 pt-10 pb-40">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold mb-1">Diagnostic Intelligence</div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Selgo AI Business Mentor</h1>
              <p className="text-sm text-slate-400 mt-1">
                Type or speak in any language. Selgo understands and responds automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startLiveVoice("mentor")}
              className="shrink-0 h-10 px-4 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 text-slate-100 font-medium text-xs flex items-center gap-2.5 transition"
            >
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="10" x2="4" y2="14" />
                <line x1="8" y1="6" x2="8" y2="18" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="16" y1="6" x2="16" y2="18" />
                <line x1="20" y1="10" x2="20" y2="14" />
              </svg>
              <span>Live</span>
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
                S
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-200 leading-relaxed max-w-xl">
                Welcome to <strong>Selgo — AI Agents, Automated for You</strong>.<br />
                <br />
                Tell me about your business, what sector you operate in, or what daily bottleneck you want to automate in any language.
              </div>
            </div>

            {mentorHistory.map((turn, idx) => (
              <div key={idx} className={`flex gap-4 items-start ${turn.role === "user" ? "justify-end" : ""}`}>
                {turn.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">
                    S
                  </div>
                )}
                <div
                  className={
                    turn.role === "user"
                      ? "bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white rounded-2xl px-5 py-3.5 text-sm font-medium max-w-lg"
                      : "bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-200 leading-relaxed max-w-xl whitespace-pre-line"
                  }
                >
                  <div>{turn.content}</div>
                  {turn.role === "assistant" && idx === mentorHistory.length - 1 && canShowMarketBtn && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-4">
                      <span className="text-xs text-slate-400">Ready when you are — or keep chatting below.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView("marketplace");
                          loadMarketplace();
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-full transition"
                      >
                        Explore Social Marketplace
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* GEMINI-STYLE PILL INPUT BAR */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#050811] via-[#050811]/95 to-transparent pt-6 pb-6 px-6">
            <div className="max-w-2xl mx-auto">
              <form
                onSubmit={handleMentorSend}
                className="relative bg-slate-900/95 border border-slate-800/90 focus-within:border-slate-700 rounded-[28px] shadow-2xl flex items-center pl-6 pr-2.5 py-2 transition"
              >
                <input
                  value={mentorInput}
                  onChange={(e) => setMentorInput(e.target.value)}
                  placeholder="Ask Selgo Mentor in any language..."
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 py-2.5 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => toggleVoiceDictation("mentor")}
                    title="Voice input"
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                      dictatingTarget === "mentor"
                        ? "bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/50 animate-pulse"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="11" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </button>

                  <button
                    type="submit"
                    title="Send message"
                    className="w-10 h-10 rounded-full bg-[#93C5FD] hover:bg-[#60A5FA] text-slate-950 flex items-center justify-center transition shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: FIRST-TIME BRANCHED ONBOARDING + SOCIAL MARKETPLACE FEED    */}
      {/* =================================================================== */}
      {activeView === "marketplace" && (
        <section className="max-w-4xl w-full mx-auto px-6 py-10">
          {!onboarding.completed ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 mb-10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {quizStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuizStep(quizStep - 1)}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                    </button>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">
                        Step {quizStep} of 3
                      </span>
                      {quizStep > 1 && onboarding.role_label && (
                        <span className="text-[11px] text-slate-400 font-mono">• {onboarding.role_label} Route</span>
                      )}
                    </div>
                    <div className="w-44 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(quizStep / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => finishOnboarding("Skipped")}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Skip to Feed
                </button>
              </div>

              {quizStep === 1 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    What is your job or primary field?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-6">
                    Asked once for first-time visitors. Your next questions will branch specifically for the role you choose.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROOT_ROLES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          setOnboarding({ ...onboarding, role_key: r.key, role_label: r.label });
                          setQuizStep(2);
                        }}
                        className="group text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">{r.label}</div>
                          <div className="text-xs text-slate-400 mt-1 leading-relaxed">{r.sub}</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-900 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 transition">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {quizStep === 2 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{currentBranch.q2_title}</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-6">{currentBranch.q2_sub}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentBranch.q2_options.map((opt: any) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setOnboarding({ ...onboarding, need_label: opt.label });
                          setQuizStep(3);
                        }}
                        className="group text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">{opt.label}</div>
                          <div className="text-xs text-slate-400 mt-1 leading-relaxed">{opt.sub}</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-900 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 transition">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {quizStep === 3 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{currentBranch.q3_title}</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-6">{currentBranch.q3_sub}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentBranch.q3_options.map((opt: any) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => finishOnboarding(opt.label)}
                        className="group text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">{opt.label}</div>
                          <div className="text-xs text-slate-400 mt-1 leading-relaxed">{opt.sub}</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-900 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 transition">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">
                      Selgo Social Marketplace
                    </span>
                    {(onboarding.role_label || onboarding.need_label) && (
                      <span className="text-[11px] bg-blue-600/20 border border-blue-500/40 text-blue-300 px-3 py-0.5 rounded-full">
                        {[onboarding.role_label, onboarding.need_label].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white mt-1">Matched AI Agents for You</h2>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizStep(1);
                      setOnboarding({ ...onboarding, completed: false });
                    }}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium px-3.5 py-2 rounded-full transition"
                  >
                    Update My Role Route
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("developer")}
                    className="bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs px-4 py-2 rounded-full"
                  >
                    + Post Agent
                  </button>
                </div>
              </div>

              <div className="mb-7 max-w-2xl mx-auto">
                <div className="relative bg-slate-900/90 border border-slate-800 focus-within:border-blue-500/60 rounded-full flex items-center px-4 py-2">
                  <svg className="w-4 h-4 text-slate-400 mr-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search agents by role, skill, developer, or workflow..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none py-1"
                  />
                </div>
              </div>

              {agents.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold text-white">No Developer Agents Published Yet</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                    Open your Creator Profile to upload your photo with the camera icon and publish the first AI Agent to the feed.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView("developer")}
                    className="mt-5 bg-blue-600 text-white font-semibold text-xs px-5 py-2.5 rounded-full"
                  >
                    Open My Creator Profile
                  </button>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {agents
                    .filter((ag) =>
                      !searchQuery
                        ? true
                        : `${ag.name} ${ag.industry} ${ag.tagline} ${ag.description} ${ag.developer.display_name}`
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                    )
                    .map((ag) => {
                      const matchScore = computeMatchScore(ag);
                      return (
                        <article
                          key={ag.agent_id}
                          className="bg-slate-900/75 border border-slate-800/90 hover:border-blue-500/40 rounded-3xl p-6 shadow-xl transition"
                        >
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <button
                              type="button"
                              onClick={() => openPublicCreator(ag.developer.username)}
                              className="flex items-center gap-3 text-left group"
                            >
                              <img
                                src={ag.developer.avatar_url}
                                alt={ag.developer.display_name}
                                className="w-11 h-11 rounded-full object-cover border border-slate-700 group-hover:border-blue-400 transition"
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-white group-hover:text-blue-400 transition">
                                    {ag.developer.display_name}
                                  </span>
                                  <span className="text-[11px] text-blue-400 font-mono">@{ag.developer.username}</span>
                                </div>
                                <div className="text-xs text-slate-400">{ag.developer.headline}</div>
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              {matchScore && (
                                <span className="text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full">
                                  {matchScore}% Match
                                </span>
                              )}
                              <span className="text-[11px] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full font-semibold">
                                {ag.industry}
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-950/75 border border-slate-800/80 rounded-2xl p-5 mb-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-bold text-white">{ag.name}</h3>
                                <p className="text-xs text-blue-300 font-medium mt-1">{ag.tagline}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xl font-extrabold text-white">${ag.monthly_price_usd}</span>
                                <span className="text-[11px] text-slate-500 block">/month</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 mt-3 leading-relaxed">{ag.description}</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2">
                              {/* TikTok Vector Heart */}
                              <button
                                type="button"
                                onClick={() => reactToAgent(ag.agent_id, "like")}
                                className={`border rounded-full px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                                  ag.user_liked
                                    ? "text-[#FE2C55] border-[#FE2C55]/40 bg-[#FE2C55]/10"
                                    : "text-slate-300 border-slate-800 bg-slate-950 hover:border-slate-700"
                                }`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill={ag.user_liked ? "#FE2C55" : "none"}
                                  stroke={ag.user_liked ? "#FE2C55" : "currentColor"}
                                  strokeWidth="2"
                                >
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                <span>{ag.likes_count || 0}</span>
                              </button>

                              {/* Vector Comment Button */}
                              <button
                                type="button"
                                onClick={() => openCommentsDrawer(ag)}
                                className="bg-slate-950 hover:border-blue-500/40 border border-slate-800 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>{ag.comments_count || 0}</span>
                              </button>

                              {/* Vector Save Button */}
                              <button
                                type="button"
                                onClick={() => reactToAgent(ag.agent_id, "fire")}
                                className="bg-slate-950 hover:border-amber-500/40 border border-slate-800 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                </svg>
                                <span>{ag.fire_count || 0}</span>
                              </button>

                              {/* Vector Boost Button */}
                              <button
                                type="button"
                                onClick={() => reactToAgent(ag.agent_id, "rocket")}
                                className="bg-slate-950 hover:border-blue-500/40 border border-slate-800 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                  <polyline points="16 6 12 2 8 6" />
                                  <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                <span>{ag.rocket_count || 0}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSandboxAgent(ag);
                                  setSandboxPrompt("");
                                  setSandboxResult(null);
                                }}
                                className="bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-full transition"
                              >
                                Preview Agent
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubModalAgent(ag);
                                  setSubBusinessName(`${user.full_name}'s Workspace`);
                                  setSubBusinessGoal(mentorMemory.pain_point || "");
                                }}
                                className="bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs px-5 py-2.5 rounded-full shadow-md shadow-blue-600/20 transition"
                              >
                                Subscribe & Talk
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* VIEW 3: PERSISTENT BUSINESS WORKSPACE + COMPANY KNOWLEDGE BASE      */}
      {/* =================================================================== */}
      {activeView === "workspace" && activeSub && (
        <section className="max-w-6xl w-full mx-auto px-6 py-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-slate-800">
            {subscriptions.map((s) => (
              <button
                key={s.subscription_id}
                type="button"
                onClick={() => {
                  setActiveSubId(s.subscription_id);
                  setWsKnowledge(s.knowledge_base_text || "");
                }}
                className={`text-xs font-semibold px-4 py-2 rounded-full shrink-0 transition ${
                  s.subscription_id === activeSub.subscription_id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {s.agent_name} ({s.business_name})
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 gap-4">
            <div className="flex items-center gap-4">
              <img
                src={activeSub.developer_avatar || avatarUrl}
                alt=""
                className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
              />
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] text-blue-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  DEPLOYED & ACTIVE ON SELGO CLOUD
                  {activeSub.invoice_code && <span className="text-slate-500 font-mono ml-1">• {activeSub.invoice_code}</span>}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">{activeSub.agent_name}</h2>
                <p className="text-xs text-slate-400">
                  Deployed for {activeSub.business_name} • Focus: {activeSub.business_goal} • Paid via {activeSub.payment_method || "Card"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startLiveVoice("agent")}
              className="h-10 px-4 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 text-slate-100 font-medium text-xs flex items-center gap-2.5 transition self-start md:self-auto"
            >
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="10" x2="4" y2="14" />
                <line x1="8" y1="6" x2="8" y2="18" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="16" y1="6" x2="16" y2="18" />
                <line x1="20" y1="10" x2="20" y2="14" />
              </svg>
              <span>Live Voice Call</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col h-[580px]">
              <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Direct Agent Conversation & Task Execution</span>
                <span className="text-[11px] text-slate-500 font-mono">{wsSpeedMs}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {(activeSub.chat_history || []).map((turn: any, idx: number) => (
                  <div key={idx} className={`flex gap-3 items-start ${turn.role === "user" ? "justify-end" : ""}`}>
                    {turn.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        AI
                      </div>
                    )}
                    <div
                      className={
                        turn.role === "user"
                          ? "bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white rounded-2xl px-4 py-3 text-sm font-medium max-w-md"
                          : "bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-200 leading-relaxed max-w-lg whitespace-pre-line"
                      }
                    >
                      {turn.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 rounded-b-2xl">
                <form
                  onSubmit={handleWorkspaceSend}
                  className="bg-slate-900 border border-slate-800 focus-within:border-slate-700 rounded-[28px] flex items-center pl-5 pr-2 py-1.5 transition"
                >
                  <input
                    value={wsInput}
                    onChange={(e) => setWsInput(e.target.value)}
                    placeholder="Talk to your deployed agent in any language..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 py-2 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("workspace")}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                        dictatingTarget === "workspace"
                          ? "bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/50 animate-pulse"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                      }`}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <rect x="9" y="2" width="6" height="11" rx="3" />
                        <path d="M5 10a7 7 0 0 0 14 0" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </button>

                    <button
                      type="submit"
                      className="w-10 h-10 rounded-full bg-[#93C5FD] hover:bg-[#60A5FA] text-slate-950 flex items-center justify-center transition shadow-sm"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-blue-400 font-semibold">Company Knowledge Base</h3>
                    <p className="text-[11px] text-slate-400">Upload a file or paste your pricing, inventory, or SOPs.</p>
                  </div>
                  <label className="text-[11px] bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1.5 transition shrink-0">
                    <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept=".txt,.csv,.json,.md"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setWsKnowledge((prev) => `${prev ? prev + "\n\n" : ""}--- FILE: ${f.name} ---\n${ev.target?.result}`);
                        reader.readAsText(f);
                      }}
                    />
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={wsKnowledge}
                  onChange={(e) => setWsKnowledge(e.target.value)}
                  placeholder="Paste your company prices, product catalog, schedules, or rules here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mt-1"
                />

                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[11px] text-emerald-400 font-semibold">{wsKnowledgeStatus}</span>
                  <button
                    type="button"
                    onClick={syncKnowledgeBase}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-1.5 rounded-full transition"
                  >
                    Sync to Agent Brain
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Live Business ROI Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Tasks Automated</div>
                    <div className="text-xl font-bold text-white mt-0.5 font-mono">{activeSub.tasks_completed}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Time Saved</div>
                    <div className="text-xl font-bold text-blue-400 mt-0.5 font-mono">{activeSub.minutes_saved}m</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Est. Value Created</div>
                    <div className="text-lg font-bold text-white mt-0.5 font-mono">${activeSub.value_created_usd}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Selgo Security</div>
                    <div className="text-xs font-semibold text-blue-400 mt-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> SHA-256 Verified
                    </div>
                  </div>
                </div>
              </div>

              {Object.keys(wsTelemetry).length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Latest Worker Telemetry</h3>
                  {Object.entries(wsTelemetry).map(([k, v]) => (
                    <div key={k} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">{k.replace(/_/g, " ")}</span>
                      <span className="text-xs font-semibold text-blue-400 font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* VIEW 4: SELGO CREATOR PROFILE + WALLET & PAYOUT WITHDRAWALS         */}
      {/* =================================================================== */}
      {activeView === "developer" && (
        <section className="max-w-4xl w-full mx-auto px-6 py-10">
          {!devProfile || editingProfile ? (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 max-w-xl mx-auto">
              <div className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-1">One-Time Creator Setup</div>
              <h2 className="text-2xl font-bold text-white">Set Up Your Selgo Creator Profile</h2>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                Set up your creator identity once. Every AI Agent you publish afterward automatically appears under your profile.
              </p>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex flex-col items-center justify-center py-2">
                  <label className="relative group cursor-pointer">
                    <img
                      src={avatarUrl}
                      alt="Creator Avatar"
                      className="w-24 h-24 rounded-full object-cover border-2 border-slate-700 group-hover:border-blue-500 bg-slate-950 transition shadow-xl"
                    />
                    <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-[#050811] flex items-center justify-center text-white shadow-lg">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                        <circle cx="12" cy="13" r="3" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setAvatarUrl(String(ev.target?.result));
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 mt-2">Tap the camera to upload your photo</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Display Name</label>
                    <input
                      required
                      value={devDisplayName}
                      onChange={(e) => setDevDisplayName(e.target.value)}
                      placeholder="e.g., Imran Mohamedbeyan"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Unique Handle (@username)</label>
                    <input
                      required
                      value={devUsername}
                      onChange={(e) => setDevUsername(e.target.value)}
                      placeholder="e.g., imran_ai"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Professional Headline</label>
                  <input
                    required
                    value={devHeadline}
                    onChange={(e) => setDevHeadline(e.target.value)}
                    placeholder="e.g., AI Systems Architect & Co-Founder"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Bio / About You</label>
                  <textarea
                    required
                    rows={3}
                    value={devBio}
                    onChange={(e) => setDevBio(e.target.value)}
                    placeholder="Tell businesses about your background and the AI systems you build..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Core Skills (Comma separated)</label>
                  <input
                    required
                    value={devSkills}
                    onChange={(e) => setDevSkills(e.target.value)}
                    placeholder="e.g., Python, Autonomous Agents, Real Estate AI, Voice Systems"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs py-3.5 rounded-full"
                >
                  Complete Profile Setup
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-blue-900/80 via-slate-900 to-slate-950 border-b border-slate-800/80" />
                <div className="px-7 pb-7">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-10 gap-4">
                    <div className="flex items-end gap-4">
                      <img
                        src={devProfile.avatar_url}
                        alt=""
                        className="w-20 h-20 rounded-full object-cover border-4 border-[#050811] bg-slate-900 shadow-xl"
                      />
                      <div className="pb-1">
                        <h2 className="text-xl font-bold text-white">{devProfile.display_name}</h2>
                        <p className="text-xs text-slate-300 mt-0.5">{devProfile.headline}</p>
                        <span className="text-[11px] text-blue-400 font-mono">@{devProfile.username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDevDisplayName(devProfile.display_name);
                          setDevUsername(devProfile.username);
                          setDevHeadline(devProfile.headline);
                          setDevBio(devProfile.bio);
                          setDevSkills((devProfile.skills || []).join(", "));
                          setAvatarUrl(devProfile.avatar_url);
                          setEditingProfile(true);
                        }}
                        className="text-xs text-slate-400 hover:text-white border border-slate-800 px-4 py-2 rounded-full transition"
                      >
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPostForm(!showPostForm)}
                        className="bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs px-5 py-2.5 rounded-full transition"
                      >
                        + Post New AI Agent
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-5 leading-relaxed max-w-2xl">{devProfile.bio}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {(devProfile.skills || []).map((s: string) => (
                      <span key={s} className="bg-slate-800 text-slate-200 px-2.5 py-1 rounded-full text-xs">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80">
                    <div>
                      <div className="text-[11px] text-slate-400">Published Agents</div>
                      <div className="text-lg font-bold text-white mt-0.5 font-mono">{(devProfile.agents || []).length}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Gross Volume</div>
                      <div className="text-lg font-bold text-slate-200 mt-0.5 font-mono">
                        ${Number(devProfile.gross_sales_usd || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Available Balance (75%)</div>
                      <div className="text-lg font-bold text-blue-400 mt-0.5 font-mono">
                        ${Number(devProfile.available_balance_usd || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Security Trust Score</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">{devProfile.trust_score}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {showPostForm && (
                <div className="bg-slate-900/80 border border-blue-500/40 rounded-2xl p-7">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
                    <div>
                      <h3 className="text-base font-semibold text-white">Post a New Conversational & Task AI Agent</h3>
                      <p className="text-xs text-slate-400">Appears in the Selgo Social Marketplace under your Creator Profile.</p>
                    </div>
                    <button type="button" onClick={() => setShowPostForm(false)} className="text-xs text-slate-400 hover:text-white">
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handlePublishAgent} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Agent Name</label>
                        <input
                          required
                          value={agName}
                          onChange={(e) => setAgName(e.target.value)}
                          placeholder="e.g., CloseFlow Sales & Lead Concierge"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Monthly Subscription (USD)</label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={agPrice}
                          onChange={(e) => setAgPrice(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Target Field / Sector</label>
                        <input
                          required
                          value={agIndustry}
                          onChange={(e) => setAgIndustry(e.target.value)}
                          placeholder="e.g., Software Engineering, Data Science, Sales, Real Estate"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Short Headline Tagline</label>
                        <input
                          required
                          value={agTagline}
                          onChange={(e) => setAgTagline(e.target.value)}
                          placeholder="e.g., Automates daily workflows and client responses 24/7."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Agent Persona & Expertise Instructions (System Prompt)</label>
                      <textarea
                        required
                        rows={2}
                        value={agSystemPrompt}
                        onChange={(e) => setAgSystemPrompt(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Full Capabilities Description</label>
                      <textarea
                        required
                        rows={2}
                        value={agDescription}
                        onChange={(e) => setAgDescription(e.target.value)}
                        placeholder="Describe everything this agent does for the subscriber..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                      />
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <label className="text-xs font-medium text-slate-300">Python `AgentWorker` Logic (or upload `.py`)</label>
                        <label className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-full cursor-pointer">
                          Upload .py File
                          <input
                            type="file"
                            accept=".py,.txt"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => setAgCode(String(ev.target?.result));
                              reader.readAsText(f);
                            }}
                          />
                        </label>
                      </div>
                      <textarea
                        required
                        rows={7}
                        value={agCode}
                        onChange={(e) => setAgCode(e.target.value)}
                        className="w-full bg-black border border-slate-800 rounded-lg p-3 text-xs font-mono text-blue-300 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs py-3 rounded-full"
                    >
                      Verify Security & Publish to Social Feed
                    </button>
                  </form>
                </div>
              )}

              {deployMessage && <div className="text-xs text-blue-400">{deployMessage}</div>}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">AI Agents Posted by You</h3>
                  {(devProfile.agents || []).length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                      Click &ldquo;+ Post New AI Agent&rdquo; above to publish your first agent under your profile.
                    </div>
                  ) : (
                    (devProfile.agents || []).map((a: any) => (
                      <div
                        key={a.agent_id}
                        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold">{a.industry}</span>
                          <h4 className="text-base font-semibold text-white mt-0.5">{a.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">{a.tagline}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          <div className="text-white font-bold text-sm">${a.monthly_price_usd}/mo</div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgent(a.agent_id)}
                            className="text-[11px] text-rose-400 hover:underline"
                          >
                            Remove Agent
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-1">Creator Payout Wallet</h3>
                    <p className="text-[11px] text-slate-400 mb-4">
                      Withdraw your 75% creator share directly to your bank or mobile wallet.
                    </p>

                    <form onSubmit={handleCreatorPayout} className="space-y-3">
                      <select
                        value={payoutMethod}
                        onChange={(e) => setPayoutMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="Telebirr Wallet">Telebirr Wallet</option>
                        <option value="Commercial Bank (CBE)">Commercial Bank (CBE)</option>
                        <option value="Chapa Direct Transfer">Chapa Direct Transfer</option>
                        <option value="International Wire / Wise">International Wire / Wise</option>
                      </select>
                      <input
                        required
                        value={payoutAccount}
                        onChange={(e) => setPayoutAccount(e.target.value)}
                        placeholder="Enter destination account or phone..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs py-2.5 rounded-full"
                      >
                        Withdraw Available Balance
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Business Subscribers (75% Share)</h3>
                    <div className="space-y-2.5 text-xs text-slate-400">
                      {(devProfile.recent_subscribers || []).length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 text-slate-500">
                          When businesses subscribe to your agents, your 75% revenue payouts appear here.
                        </div>
                      ) : (
                        (devProfile.recent_subscribers || []).map((s: any, idx: number) => (
                          <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">{s.business_name}</div>
                              <div className="text-[11px] text-slate-400">
                                {s.agent_name} • {s.payment_method || "Card"}
                              </div>
                            </div>
                            <span className="text-blue-400 font-bold font-mono">+${s.creator_earned_usd}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PUBLIC CREATOR MODAL */}
      {publicCreatorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="h-20 bg-gradient-to-r from-blue-900/80 via-slate-900 to-slate-950 flex items-start justify-end p-4">
              <button
                type="button"
                onClick={() => setPublicCreatorModal(null)}
                className="w-8 h-8 rounded-full bg-black/50 text-slate-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="px-7 pb-7">
              <div className="flex items-end gap-4 -mt-10">
                <img
                  src={publicCreatorModal.avatar_url}
                  alt=""
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-900 bg-slate-950"
                />
                <div className="pb-1">
                  <h3 className="text-xl font-bold text-white">{publicCreatorModal.display_name}</h3>
                  <p className="text-xs text-slate-300">{publicCreatorModal.headline}</p>
                  <span className="text-[11px] text-blue-400 font-mono">
                    @{publicCreatorModal.username} • {publicCreatorModal.trust_score}% Trust Score
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-4 leading-relaxed">{publicCreatorModal.bio}</p>
            </div>
          </div>
        </div>
      )}

      {/* SANDBOX PREVIEW MODAL */}
      {sandboxAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">Live Cloud Sandbox Preview</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{sandboxAgent.name}</h3>
              </div>
              <button type="button" onClick={() => setSandboxAgent(null)} className="text-xs text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleRunSandbox} className="flex gap-2">
              <input
                required
                value={sandboxPrompt}
                onChange={(e) => setSandboxPrompt(e.target.value)}
                placeholder="Ask a question or give a sample task..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <button type="submit" className="bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl">
                {sandboxLoading ? "Running..." : "Test Agent"}
              </button>
            </form>

            {sandboxResult && (
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-[11px] text-blue-400 font-semibold">
                  <span>LIVE AGENT RESPONSE</span>
                  <span className="font-mono text-slate-500">{sandboxResult.execution_speed_ms} ms</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{sandboxResult.agent_reply}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMMENTS MODAL */}
      {commentsAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">Community & Buyer Reviews</span>
                <h3 className="text-lg font-bold text-white mt-0.5">{commentsAgent.name}</h3>
              </div>
              <button type="button" onClick={() => setCommentsAgent(null)} className="text-xs text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {commentsList.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8">No reviews yet. Be the first to post feedback.</div>
              ) : (
                commentsList.map((c: any) => (
                  <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{c.author_name}</span>
                      {c.is_verified_subscriber && (
                        <span className="text-[10px] bg-blue-500/15 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                          Verified Subscriber
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2 pt-3 border-t border-slate-800">
              <input
                required
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write a comment or review..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-full px-4 py-2.5 text-xs text-white"
              />
              <button type="submit" className="bg-blue-600 text-white font-semibold text-xs px-5 py-2.5 rounded-full">
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBSCRIBE & MULTI-METHOD PAYMENT CHECKOUT MODAL */}
      {subModalAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-blue-400 font-semibold">Selgo Cloud Checkout</span>
                <h3 className="text-lg font-semibold text-white mt-0.5">{subModalAgent.name}</h3>
              </div>
              <button type="button" onClick={() => setSubModalAgent(null)} className="text-xs text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubscribeConfirm} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Your Organization / Workspace Name</label>
                <input
                  required
                  value={subBusinessName}
                  onChange={(e) => setSubBusinessName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Primary Goal for This Agent</label>
                <input
                  required
                  value={subBusinessGoal}
                  onChange={(e) => setSubBusinessGoal(e.target.value)}
                  placeholder="e.g., Automate daily operations and workflows"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Select Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Card", "Telebirr", "Chapa / Bank"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSubPaymentMethod(method)}
                      className={`rounded-xl py-2.5 px-2 text-xs font-semibold transition ${
                        subPaymentMethod === method
                          ? "border-2 border-blue-500 bg-blue-600/20 text-white"
                          : "border border-slate-800 bg-slate-950 text-slate-300"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Monthly Subscription</span>
                  <span className="text-white font-bold text-sm">${subModalAgent.monthly_price_usd}/month</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <span>75% Creator Escrow / 25% Selgo Cloud</span>
                  <span className="text-blue-400">Instant Activation</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#0052FF] to-[#1D4ED8] text-white font-semibold text-xs py-3.5 rounded-full transition"
              >
                Complete Payment & Deploy Agent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}