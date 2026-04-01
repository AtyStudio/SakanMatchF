import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation, useRoute } from "wouter";
import { api, type ChatRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageSquare, ArrowLeft, User, Check, X, Clock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface Conversation {
  otherId: number;
  otherEmail: string | null;
  otherName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  listingId: number | null;
  body: string;
  read: boolean;
  createdAt: string;
}

const THREAD_POLL_INTERVAL = 4000;
const CONVS_POLL_INTERVAL = 8000;
const REQUESTS_POLL_INTERVAL = 10000;

type LeftPanelTab = "conversations" | "requests";
type RequestSubTab = "incoming" | "outgoing";

export default function Messages() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [matchThread, threadParams] = useRoute<{ userId: string }>("/messages/:userId");
  const { toast } = useToast();
  const { t } = useTranslation();

  const [leftTab, setLeftTab] = useState<LeftPanelTab>("conversations");
  const [requestSubTab, setRequestSubTab] = useState<RequestSubTab>("incoming");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<ChatRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ChatRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestActionId, setRequestActionId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  const threadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const routeUserId = matchThread && threadParams ? parseInt(threadParams.userId) : null;

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  const isAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const pollThread = useCallback(async () => {
    const conv = activeConvRef.current;
    if (!conv) return;
    try {
      const raw = await api.getThread(conv.otherId);
      const msgs = Array.isArray(raw) ? raw : [];
      setThread(prev => {
        if (prev.length === msgs.length && prev.every((m, i) => m.id === msgs[i].id)) {
          return prev;
        }
        const hadNewMessages = msgs.length > prev.length;
        if (hadNewMessages) {
          const atBottom = isAtBottom();
          setTimeout(() => {
            if (atBottom) scrollToBottom("smooth");
          }, 50);
        }
        return msgs;
      });
    } catch {
    }
  }, []);

  const pollConversations = useCallback(async () => {
    try {
      const raw = await api.getConversations();
      const data = Array.isArray(raw) ? raw : [];
      setConversations(data);
      const current = activeConvRef.current;
      if (current) {
        const updated = data.find(c => c.otherId === current.otherId);
        if (updated) setActiveConv(updated);
      }
    } catch {
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const [incoming, outgoing] = await Promise.all([
        api.getIncomingChatRequests(),
        api.getOutgoingChatRequests(),
      ]);
      setIncomingRequests(Array.isArray(incoming) ? incoming.filter(r => r.status === "pending") : []);
      setOutgoingRequests(Array.isArray(outgoing) ? outgoing.filter(r => r.status === "pending") : []);
    } catch {
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadRequests();

    convsIntervalRef.current = setInterval(pollConversations, CONVS_POLL_INTERVAL);
    requestsIntervalRef.current = setInterval(loadRequests, REQUESTS_POLL_INTERVAL);

    return () => {
      if (convsIntervalRef.current) { clearInterval(convsIntervalRef.current); convsIntervalRef.current = null; }
      if (threadIntervalRef.current) { clearInterval(threadIntervalRef.current); threadIntervalRef.current = null; }
      if (requestsIntervalRef.current) { clearInterval(requestsIntervalRef.current); requestsIntervalRef.current = null; }
    };
  }, [user]);

  useEffect(() => {
    if (activeConv) {
      if (threadIntervalRef.current) clearInterval(threadIntervalRef.current);
      threadIntervalRef.current = setInterval(pollThread, THREAD_POLL_INTERVAL);
    } else {
      if (threadIntervalRef.current) {
        clearInterval(threadIntervalRef.current);
        threadIntervalRef.current = null;
      }
    }
    return () => {
      if (threadIntervalRef.current) { clearInterval(threadIntervalRef.current); threadIntervalRef.current = null; }
    };
  }, [activeConv?.otherId]);

  const loadConversations = async () => {
    try {
      const raw = await api.getConversations();
      const data = Array.isArray(raw) ? raw : [];
      setConversations(data);
      if (data.length > 0) {
        const targetId = routeUserId;
        const target = targetId ? data.find(c => c.otherId === targetId) : null;
        if (target) {
          selectConversation(target);
        } else if (!activeConv) {
          if (routeUserId && !target) {
            const syntheticConv: Conversation = {
              otherId: routeUserId,
              otherEmail: null,
              otherName: null,
              lastMessage: "",
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            };
            selectConversation(syntheticConv);
          } else {
            selectConversation(data[0]);
          }
        }
      } else if (routeUserId) {
        const syntheticConv: Conversation = {
          otherId: routeUserId,
          otherEmail: null,
          otherName: null,
          lastMessage: "",
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
        };
        setActiveConv(syntheticConv);
        const rawMsgs = await api.getThread(routeUserId);
        setThread(Array.isArray(rawMsgs) ? rawMsgs : []);
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("messages.error") });
    } finally {
      setIsLoadingConvs(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setLeftTab("conversations");
    setIsLoadingThread(true);
    try {
      const raw = await api.getThread(conv.otherId);
      setThread(Array.isArray(raw) ? raw : []);
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("messages.threadError") });
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv) return;
    setIsSending(true);
    try {
      const msg = await api.sendMessage({ receiverId: activeConv.otherId, body: newMessage.trim() });
      setThread(prev => [...prev, msg]);
      setNewMessage("");
      setConversations(prev => prev.map(c =>
        c.otherId === activeConv.otherId
          ? { ...c, lastMessage: msg.body, lastMessageAt: msg.createdAt }
          : c
      ));
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("messages.sendError");
      toast({ variant: "destructive", title: t("common.error"), description: message });
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptRequest = async (req: ChatRequest) => {
    setRequestActionId(req.id);
    try {
      await api.acceptChatRequest(req.id);
      setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
      toast({ title: t("chatRequests.accepted"), description: t("chatRequests.acceptedDesc") });
      const otherName = req.senderName || req.senderEmail?.split("@")[0] || "User";
      const syntheticConv: Conversation = {
        otherId: req.senderId,
        otherEmail: req.senderEmail,
        otherName: req.senderName,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };
      setConversations(prev => {
        const exists = prev.find(c => c.otherId === req.senderId);
        if (exists) return prev;
        return [syntheticConv, ...prev];
      });
      selectConversation({ ...syntheticConv, otherName });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("chatRequests.acceptError") });
    } finally {
      setRequestActionId(null);
    }
  };

  const handleDeclineRequest = async (req: ChatRequest) => {
    setRequestActionId(req.id);
    try {
      await api.declineChatRequest(req.id);
      setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("chatRequests.declineError") });
    } finally {
      setRequestActionId(null);
    }
  };

  const handleCancelRequest = async (req: ChatRequest) => {
    setRequestActionId(req.id);
    try {
      await api.cancelChatRequest(req.id);
      setOutgoingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("chatRequests.cancelError") });
    } finally {
      setRequestActionId(null);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  const displayName = (conv: Conversation) => conv.otherName || conv.otherEmail?.split("@")[0] || "User";
  const pendingIncomingCount = incomingRequests.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary" /> {t("messages.title")}
        </h1>

        <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm" style={{ height: "calc(100vh - 240px)", minHeight: "500px" }}>
          <div className="flex h-full">
            {/* Left Panel */}
            <div className={cn(
              "w-full md:w-80 border-r border-border flex flex-col",
              activeConv ? "hidden md:flex" : "flex"
            )}>
              {/* Left Panel Tabs */}
              <div className="border-b border-border">
                <div className="flex">
                  <button
                    onClick={() => setLeftTab("conversations")}
                    className={cn(
                      "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative",
                      leftTab === "conversations"
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t("chatRequests.conversations")}
                    {leftTab === "conversations" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => setLeftTab("requests")}
                    className={cn(
                      "flex-1 py-3 px-4 text-sm font-semibold transition-colors relative flex items-center justify-center gap-1.5",
                      leftTab === "requests"
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t("chatRequests.requests")}
                    {pendingIncomingCount > 0 && (
                      <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">
                        {pendingIncomingCount}
                      </span>
                    )}
                    {leftTab === "requests" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                </div>
              </div>

              {/* Left Panel Content */}
              <div className="flex-1 overflow-y-auto">
                {leftTab === "conversations" ? (
                  <>
                    {isLoadingConvs ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    ) : conversations.length > 0 ? (
                      conversations.map(conv => (
                        <button
                          key={conv.otherId}
                          onClick={() => selectConversation(conv)}
                          className={cn(
                            "w-full text-left p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors",
                            activeConv?.otherId === conv.otherId ? "bg-primary/5 border-l-2 border-l-primary" : ""
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-sm text-foreground truncate">{displayName(conv)}</span>
                                {conv.unreadCount > 0 && (
                                  <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">{conv.unreadCount}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-10 px-4">
                        <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{t("messages.noConversations")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("messages.noConversationsSub")}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Sub-tabs: Incoming / Outgoing */}
                    <div className="flex border-b border-border/50 bg-secondary/20">
                      <button
                        onClick={() => setRequestSubTab("incoming")}
                        className={cn(
                          "flex-1 py-2 text-xs font-semibold transition-colors",
                          requestSubTab === "incoming"
                            ? "text-primary bg-background"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t("chatRequests.incoming")}
                        {incomingRequests.length > 0 && (
                          <span className="ml-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                            {incomingRequests.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setRequestSubTab("outgoing")}
                        className={cn(
                          "flex-1 py-2 text-xs font-semibold transition-colors",
                          requestSubTab === "outgoing"
                            ? "text-primary bg-background"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t("chatRequests.outgoing")}
                        {outgoingRequests.length > 0 && (
                          <span className="ml-1 text-xs bg-yellow-500/80 text-white px-1.5 py-0.5 rounded-full">
                            {outgoingRequests.length}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {isLoadingRequests ? (
                        <div className="flex justify-center py-10">
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        </div>
                      ) : requestSubTab === "incoming" ? (
                        incomingRequests.length > 0 ? (
                          incomingRequests.map(req => {
                            const name = req.senderName || req.senderEmail?.split("@")[0] || "User";
                            const isActing = requestActionId === req.id;
                            return (
                              <div key={req.id} className="p-4 border-b border-border/50">
                                <div className="flex items-center gap-2.5 mb-3">
                                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                    {req.senderAvatar ? (
                                      <img src={req.senderAvatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
                                    ) : (
                                      <User className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      {t("chatRequests.pending")}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAcceptRequest(req)}
                                    disabled={isActing}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    {t("chatRequests.accept")}
                                  </button>
                                  <button
                                    onClick={() => handleDeclineRequest(req)}
                                    disabled={isActing}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary text-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    {t("chatRequests.decline")}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-10 px-4">
                            <UserPlus className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">{t("chatRequests.noIncoming")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("chatRequests.noIncomingSub")}</p>
                          </div>
                        )
                      ) : (
                        outgoingRequests.length > 0 ? (
                          outgoingRequests.map(req => {
                            const name = req.receiverName || req.receiverEmail?.split("@")[0] || "User";
                            const isActing = requestActionId === req.id;
                            return (
                              <div key={req.id} className="p-4 border-b border-border/50">
                                <div className="flex items-center gap-2.5 mb-3">
                                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                    {req.receiverAvatar ? (
                                      <img src={req.receiverAvatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
                                    ) : (
                                      <User className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                                      <Clock className="w-3 h-3" />
                                      {t("chatRequests.requestSent")}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleCancelRequest(req)}
                                  disabled={isActing}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                  {t("chatRequests.cancel")}
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-10 px-4">
                            <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">{t("chatRequests.noOutgoing")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("chatRequests.noOutgoingSub")}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thread */}
            <div className={cn("flex-1 flex flex-col", activeConv ? "flex" : "hidden md:flex")}>
              {activeConv ? (
                <>
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <button
                      onClick={() => setActiveConv(null)}
                      className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{displayName(activeConv)}</p>
                      <p className="text-xs text-muted-foreground">{activeConv.otherEmail}</p>
                    </div>
                  </div>

                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoadingThread ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    ) : thread.length > 0 ? (
                      thread.map(msg => {
                        const isMe = msg.senderId === user.id;
                        return (
                          <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-foreground rounded-bl-sm"
                            )}>
                              <p className="leading-relaxed">{msg.body}</p>
                              <p className={cn("text-xs mt-1", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                {format(new Date(msg.createdAt), "h:mm a")}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-muted-foreground text-sm">{t("messages.noMessages")}</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSend} className="p-4 border-t border-border flex items-center gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={t("messages.typePlaceholder")}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !newMessage.trim()}
                      className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">{t("messages.selectConversation")}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("messages.selectConversationSub")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
