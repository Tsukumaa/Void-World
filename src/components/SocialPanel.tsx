"use client";

import { useState, useEffect, useRef } from "react";
import { WorldRoom, PlayerState } from "@/hooks/useWorldRoom";

interface DM {
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
  self: boolean;
}

interface Props {
  room: WorldRoom;
  username: string;
  onlinePlayers: Map<string, PlayerState>;
}

export default function SocialPanel({ room, username, onlinePlayers }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"players" | "friends" | "dms">("players");
  const [friends, setFriends] = useState<string[]>([]);
  const [dmTarget, setDmTarget] = useState<{ id: string; name: string } | null>(null);
  const [conversations, setConversations] = useState<Record<string, DM[]>>({});
  const [dmInput, setDmInput] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const msgsEndRef = useRef<HTMLDivElement>(null);

  // Charger amis depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("void_friends");
    if (saved) setFriends(JSON.parse(saved));
  }, []);

  // Écouter les DMs entrants
  useEffect(() => {
    room.onMessage((msg) => {
      if (msg.type === "dm") {
        const conv: DM = { fromId: msg.fromId, fromName: msg.fromName, text: msg.text, ts: Date.now(), self: false };
        setConversations(prev => ({
          ...prev,
          [msg.fromId]: [...(prev[msg.fromId] ?? []), conv],
        }));
        setUnread(prev => ({ ...prev, [msg.fromId]: (prev[msg.fromId] ?? 0) + 1 }));
      }
    });
  }, [room]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, dmTarget]);

  function addFriend(name: string) {
    if (friends.includes(name)) return;
    const next = [...friends, name];
    setFriends(next);
    localStorage.setItem("void_friends", JSON.stringify(next));
  }

  function removeFriend(name: string) {
    const next = friends.filter(f => f !== name);
    setFriends(next);
    localStorage.setItem("void_friends", JSON.stringify(next));
  }

  function sendDm() {
    if (!dmTarget || !dmInput.trim()) return;
    const text = dmInput.trim();
    room.send("dm", { toId: dmTarget.id, text });
    const conv: DM = { fromId: room.id, fromName: username, text, ts: Date.now(), self: true };
    setConversations(prev => ({
      ...prev,
      [dmTarget.id]: [...(prev[dmTarget.id] ?? []), conv],
    }));
    setDmInput("");
  }

  function openDm(id: string, name: string) {
    setDmTarget({ id, name });
    setUnread(prev => ({ ...prev, [id]: 0 }));
    setTab("dms");
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const players = Array.from(onlinePlayers.values()).filter(p => p.id !== room.id);
  const friendPlayers = players.filter(p => friends.includes(p.username));

  return (
    <>
      {/* Bouton toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 100,
          background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10, color: "#fff", padding: "8px 14px", cursor: "pointer",
          fontSize: 13, fontFamily: "monospace", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        👥 Social
        {totalUnread > 0 && (
          <span style={{ background: "#e63946", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", top: 52, right: 16, zIndex: 99, width: 280,
          background: "rgba(15,20,15,0.92)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12, color: "#fff", fontFamily: "monospace", fontSize: 12,
          backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", maxHeight: "70vh",
        }}>
          {/* Onglets */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {(["players", "friends", "dms"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "10px 0", background: "none", border: "none",
                color: tab === t ? "#6c63ff" : "#aaa", cursor: "pointer",
                borderBottom: tab === t ? "2px solid #6c63ff" : "2px solid transparent",
                fontSize: 11, fontFamily: "monospace",
              }}>
                {t === "players" ? `👤 Joueurs (${players.length})` : t === "friends" ? `⭐ Amis (${friendPlayers.length})` : `💬 Messages${totalUnread > 0 ? ` (${totalUnread})` : ""}`}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div style={{ overflowY: "auto", flex: 1 }}>

            {/* Onglet joueurs en ligne */}
            {tab === "players" && (
              <div>
                {players.length === 0 && <p style={{ color: "#666", padding: "12px 16px" }}>Aucun autre joueur en ligne</p>}
                {players.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "#43aa8b" }}>● {p.username}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openDm(p.id, p.username)} style={btnStyle("#1a3a4a", "#4fc3f7")}>💬</button>
                      {friends.includes(p.username)
                        ? <button onClick={() => removeFriend(p.username)} style={btnStyle("#3a1a1a", "#e57373")}>★</button>
                        : <button onClick={() => addFriend(p.username)} style={btnStyle("#1a2a1a", "#81c784")}>☆</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Onglet amis */}
            {tab === "friends" && (
              <div>
                {friends.length === 0 && <p style={{ color: "#666", padding: "12px 16px" }}>Aucun ami ajouté</p>}
                {friends.map(name => {
                  const online = players.find(p => p.username === name);
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ color: online ? "#43aa8b" : "#666" }}>{online ? "●" : "○"} {name}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {online && <button onClick={() => openDm(online.id, name)} style={btnStyle("#1a3a4a", "#4fc3f7")}>💬</button>}
                        <button onClick={() => removeFriend(name)} style={btnStyle("#3a1a1a", "#e57373")}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Onglet DMs */}
            {tab === "dms" && !dmTarget && (
              <div>
                {Object.keys(conversations).length === 0 && <p style={{ color: "#666", padding: "12px 16px" }}>Aucune conversation</p>}
                {Object.entries(conversations).map(([id, msgs]) => {
                  const last = msgs[msgs.length - 1];
                  const name = last.self ? last.fromName : last.fromName;
                  const playerName = players.find(p => p.id === id)?.username ?? last.fromName;
                  return (
                    <div key={id} onClick={() => openDm(id, playerName)} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", background: unread[id] ? "rgba(108,99,255,0.1)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#ccc" }}>{playerName}</span>
                        {unread[id] > 0 && <span style={{ background: "#e63946", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread[id]}</span>}
                      </div>
                      <div style={{ color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.self ? "Toi: " : ""}{last.text}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Conversation DM ouverte */}
            {tab === "dms" && dmTarget && (
              <div style={{ display: "flex", flexDirection: "column", height: 300 }}>
                <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setDmTarget(null)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14 }}>←</button>
                  <span style={{ color: "#43aa8b" }}>{dmTarget.name}</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {(conversations[dmTarget.id] ?? []).map((m, i) => (
                    <div key={i} style={{ alignSelf: m.self ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                      <div style={{ background: m.self ? "rgba(108,99,255,0.4)" : "rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 9px", color: "#fff" }}>{m.text}</div>
                    </div>
                  ))}
                  <div ref={msgsEndRef} />
                </div>
                <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: 6 }}>
                  <input
                    value={dmInput}
                    onChange={e => setDmInput(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") sendDm(); }}
                    placeholder="Message..."
                    style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "6px 10px", color: "#fff", fontFamily: "monospace", fontSize: 12, outline: "none" }}
                  />
                  <button onClick={sendDm} style={btnStyle("#1a1a3a", "#6c63ff")}>↑</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function btnStyle(bg: string, color: string) {
  return {
    background: bg, border: `1px solid ${color}40`, borderRadius: 6,
    color, cursor: "pointer", padding: "4px 8px", fontSize: 12, fontFamily: "monospace",
  } as React.CSSProperties;
}
