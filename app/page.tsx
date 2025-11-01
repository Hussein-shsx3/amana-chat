"use client";

import { useState, useEffect, useRef } from "react";
import Ably from "ably";
import type { RealtimeChannel } from "ably";

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.presence.leave();
      }
      if (ablyRef.current) {
        ablyRef.current.close();
      }
    };
  }, []);

  const initializeAbly = async (name: string) => {
    try {
      setIsConnecting(true);

      // Pass the username as clientId to the API route
      const response = await fetch(
        `/api/ably-token?clientId=${encodeURIComponent(name)}`
      );
      const tokenRequest = await response.json();

      if (tokenRequest.error) {
        throw new Error(tokenRequest.error);
      }

      const ably = new Ably.Realtime({
        authCallback: (data, callback) => {
          callback(null, tokenRequest);
        },
        clientId: name,
      });

      ablyRef.current = ably;

      ably.connection.on("connected", () => {
        console.log("Connected to Ably");
      });

      const channel = ably.channels.get("chat-room");
      channelRef.current = channel;

      // Subscribe to messages
      channel.subscribe("chat-message", (message) => {
        const data = message.data as Message;
        setMessages((prev) => [...prev, data]);
      });

      // Handle presence - enter
      await channel.presence.enter({ username: name });

      channel.presence.subscribe("enter", (member) => {
        const memberName = member.clientId || "Anonymous";
        setOnlineUsers((prev) => [...new Set([...prev, memberName])]);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            username: "System",
            text: `${memberName} joined the chat`,
            timestamp: new Date().toISOString(),
            isSystem: true,
          },
        ]);
      });

      channel.presence.subscribe("leave", (member) => {
        const memberName = member.clientId || "Anonymous";
        setOnlineUsers((prev) => prev.filter((u) => u !== memberName));
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            username: "System",
            text: `${memberName} left the chat`,
            timestamp: new Date().toISOString(),
            isSystem: true,
          },
        ]);
      });

      // Get current presence
      const presenceSet = await channel.presence.get();
      const currentUsers = presenceSet.map((m) => m.clientId || "Anonymous");
      setOnlineUsers(currentUsers);

      setIsConnecting(false);
      setIsJoined(true);
    } catch (error) {
      console.error("Error initializing Ably:", error);
      setIsConnecting(false);
      alert(
        "Failed to connect to chat. Please check your API key and try again."
      );
    }
  };

  const handleJoin = () => {
    if (username.trim()) {
      initializeAbly(username.trim());
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim() && channelRef.current) {
      const message: Message = {
        id: `${Date.now()}-${Math.random()}`,
        username: username,
        text: inputMessage.trim(),
        timestamp: new Date().toISOString(),
      };

      channelRef.current.publish("chat-message", message);
      setInputMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isJoined) {
        handleJoin();
      } else {
        handleSendMessage();
      }
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Ably Chat</h1>
            <p className="text-gray-600">Join the real-time conversation</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                disabled={isConnecting}
                autoFocus
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!username.trim() || isConnecting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? "Connecting..." : "Join Chat"}
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600 text-center">
              <strong>Note:</strong> This chat uses Ably for real-time
              messaging. Multiple users can join and chat simultaneously.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto h-[calc(100vh-2rem)] flex gap-4">
        {/* Main Chat Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-lg">Chat Room</h2>
                <p className="text-sm text-indigo-200">
                  {onlineUsers.length}{" "}
                  {onlineUsers.length === 1 ? "user" : "users"} online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Connected</span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-lg">No messages yet</p>
                <p className="text-sm">Be the first to send a message!</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.username === username
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {message.isSystem ? (
                  <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-full text-sm max-w-md text-center mx-auto">
                    {message.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-md ${
                      message.username === username
                        ? "items-end"
                        : "items-start"
                    } flex flex-col`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-gray-600">
                        {message.username}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm ${
                        message.username === username
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : "bg-white text-gray-800 rounded-tl-sm border border-gray-200"
                      }`}
                    >
                      <p className="break-words whitespace-pre-wrap">
                        {message.text}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                autoFocus
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="bg-indigo-600 text-white px-6 py-3 rounded-full hover:bg-indigo-700 transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="hidden sm:inline">Send</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Online Users */}
        <div className="w-64 bg-white rounded-2xl shadow-2xl p-4 hidden md:flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Online Users ({onlineUsers.length})
          </h3>
          <div className="space-y-2 flex-1 overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-4">
                No users online
              </p>
            ) : (
              onlineUsers.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span
                    className={`text-gray-700 ${
                      user === username ? "font-semibold" : ""
                    }`}
                  >
                    {user} {user === username && "(You)"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
