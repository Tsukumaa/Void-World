"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useWorldRoom } from "@/hooks/useWorldRoom";
import SocialPanel from "@/components/SocialPanel";
import CharacterPicker from "@/components/CharacterPicker";
import { loadCharConfig, saveCharConfig, type CharConfig } from "@/lib/charConfig";

const GameCanvas  = dynamic(() => import("@/components/GameCanvas"),  { ssr: false });
const HouseCanvas = dynamic(() => import("@/components/HouseCanvas"), { ssr: false });
const BiomeCanvas = dynamic(() => import("@/components/BiomeCanvas"), { ssr: false });

export default function Home() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [started, setStarted] = useState(false);
  // "main" = monde, "house:<pseudo>" = maison instanciée
  const [activeRoom, setActiveRoom] = useState("main");
  const [charCfg, setCharCfg] = useState<CharConfig | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const { room, connected, onlinePlayers } = useWorldRoom(started ? username : "", activeRoom, charCfg ?? undefined);

  useEffect(() => {
    if (session) {
      const saved = localStorage.getItem("void_username");
      if (saved) setUsername(saved);
      setCharCfg(loadCharConfig());
    }
  }, [session]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Chargement...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col gap-6 items-center">
          <h1 className="text-4xl font-bold text-white">Void World</h1>
          <p className="text-gray-400">Connecte-toi pour jouer</p>
          <button
            className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 rounded-lg font-semibold flex items-center gap-2 border border-gray-300 w-64 justify-center"
            onClick={() => signIn("google")}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connexion avec Google
          </button>
          <button
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold flex items-center gap-2 border border-gray-600 w-64 justify-center"
            onClick={() => signIn("github")}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Connexion avec GitHub
          </button>
        </div>
      </main>
    );
  }

  // Choix du pseudo
  if (!username) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        {showPicker && charCfg && (
          <CharacterPicker
            initial={charCfg}
            onSave={(c) => { setCharCfg(c); setShowPicker(false); }}
            onCancel={() => setShowPicker(false)}
            title="Personnalise ton personnage"
          />
        )}
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-4xl font-bold text-white">Void World</h1>
          <p className="text-gray-400">Choisis ton pseudo</p>
          <input
            className="px-4 py-2 rounded bg-gray-700 text-white outline-none w-64"
            placeholder="Pseudo..."
            maxLength={20}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && usernameInput.length >= 3) {
                localStorage.setItem("void_username", usernameInput);
                setUsername(usernameInput);
              }
            }}
          />
          <button
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold"
            onClick={() => setShowPicker(true)}
          >
            🎨 Personnaliser le perso
          </button>
          <button
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-semibold disabled:opacity-40"
            disabled={usernameInput.length < 3}
            onClick={() => {
              localStorage.setItem("void_username", usernameInput);
              setUsername(usernameInput);
            }}
          >
            Jouer
          </button>
          <button className="text-gray-500 hover:text-gray-300 text-sm" onClick={() => signOut()}>
            Se déconnecter
          </button>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-4xl font-bold text-white">Void World</h1>
          <p className="text-gray-400">Connecté en tant que <span className="text-white font-semibold">{username}</span></p>
          <button
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-semibold"
            onClick={() => setStarted(true)}
          >
            Jouer
          </button>
          <div className="flex gap-4 text-sm">
            <button className="text-gray-500 hover:text-gray-300" onClick={() => {
              localStorage.removeItem("void_username");
              setUsername("");
            }}>
              Changer de pseudo
            </button>
            <button className="text-gray-500 hover:text-gray-300" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!connected || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Connexion au serveur...</p>
      </main>
    );
  }

  const isHouse = activeRoom.startsWith("house:");
  const isBiome = activeRoom.startsWith("biome:");
  const ownerName = isHouse ? activeRoom.slice("house:".length) : username;
  const biomeName = isBiome ? activeRoom.slice("biome:".length) : "";

  if (isHouse) {
    return (
      <>
        {showPicker && charCfg && (
          <CharacterPicker
            initial={charCfg}
            onSave={(c) => { setCharCfg(c); setShowPicker(false); setActiveRoom("main"); setTimeout(() => setActiveRoom(`house:${username}`), 50); }}
            onCancel={() => setShowPicker(false)}
            title="Changer de personnage"
          />
        )}
        <HouseCanvas
          key={activeRoom}
          room={room}
          username={username}
          ownerName={ownerName}
          charCfg={charCfg ?? undefined}
          onExit={() => setActiveRoom("main")}
          onChangeChar={() => setShowPicker(true)}
        />
      </>
    );
  }

  if (isBiome) {
    return (
      <BiomeCanvas
        key={activeRoom}
        room={room}
        username={username}
        biome={biomeName as any}
        charCfg={charCfg ?? undefined}
        onExit={() => setActiveRoom("main")}
      />
    );
  }

  return (
    <>
      <GameCanvas
        key={activeRoom}
        room={room}
        username={username}
        charCfg={charCfg ?? loadCharConfig()}
        onEnterBiome={(b) => setActiveRoom(`biome:${b}`)}
      />
      <SocialPanel room={room} username={username} onlinePlayers={onlinePlayers} />
      <button
        onClick={() => setActiveRoom(`house:${username}`)}
        style={{
          position: "fixed", bottom: 204, right: 14, zIndex: 100,
          background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10, color: "#fff", padding: "10px 16px", cursor: "pointer",
          fontSize: 14, fontFamily: "monospace", backdropFilter: "blur(4px)",
        }}
      >
        🏠 Ma maison
      </button>
    </>
  );
}
