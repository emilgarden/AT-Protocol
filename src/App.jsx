import React, { useState } from "react";
import { BskyAgent } from "@atproto/api";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [postContent, setPostContent] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  const agent = new BskyAgent({ service: "https://bsky.social" });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await agent.login({ identifier: username, password });
      setIsLoggedIn(true);
      setStatus({ type: "success", message: `Logget inn som ${username}` });
    } catch (error) {
      setStatus({ type: "error", message: `Feil ved innlogging: ${error.message}` });
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    try {
      await agent.post({
        text: postContent,
        createdAt: new Date().toISOString(),
      });
      setStatus({ type: "success", message: "Innlegg publisert!" });
      setPostContent("");
    } catch (error) {
      setStatus({ type: "error", message: `Feil ved publisering: ${error.message}` });
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Bluesky PoC</h1>
      {!isLoggedIn ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Bluesky brukernavn"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passord"
            className="w-full p-2 border rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded"
          >
            Logg inn
          </button>
        </form>
      ) : (
        <form onSubmit={handlePost} className="space-y-4">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="Skriv noe..."
            className="w-full p-2 border rounded h-24"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded"
          >
            Publiser
          </button>
        </form>
      )}
      {status.message && (
        <div
          className={`mt-4 p-2 rounded ${
            status.type === "success" ? "bg-green-100" : "bg-red-100"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
};

export default App;
