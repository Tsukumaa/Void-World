"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useWorldRoom } from "@/hooks/useWorldRoom";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), { ssr: false });

export default function Home() {
  const [username, setUsername] = useState("");
  const [started, setStarted] = useState(false);
  const { room, connected } = useWorldRoom(started ? username : "");

  if (!started) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-4xl font-bold text-white">Void World</h1>
          <input
            className="px-4 py-2 rounded bg-gray-700 text-white outline-none"
            placeholder="Ton pseudo..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && username && setStarted(true)}
          />
          <button
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-semibold"
            onClick={() => username && setStarted(true)}
          >
            Rejoindre
          </button>
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

  return <GameCanvas room={room} username={username} />;
}
