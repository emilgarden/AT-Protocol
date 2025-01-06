import React, { useState, useRef, useEffect } from 'react';
import { BskyAgent } from '@atproto/api';
import Profile from './components/Profile';

const App = () => {
  // Eksisterende state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [postContent, setPostContent] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  
  // Ny state for navigasjon
  const [currentView, setCurrentView] = useState('feed');
  const [currentProfile, setCurrentProfile] = useState(null);
  
  // Agent referanse
  const agentRef = useRef(null);

  // Initialiser agent
  useEffect(() => {
    agentRef.current = new BskyAgent({ service: 'https://bsky.social' });
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await agentRef.current.login({ identifier: username, password });
      setIsLoggedIn(true);
      setCurrentProfile(username); // Sett nåværende profil til innlogget bruker
      setStatus({
        type: 'success',
        message: `Logget inn som ${username}`
      });
    } catch (error) {
      console.error('Login error:', error);
      setStatus({
        type: 'error',
        message: `Feil ved innlogging: ${error.message}`
      });
    }
  };

  // Post handler
  const handlePost = async (e) => {
    e.preventDefault();
    try {
      if (!agentRef.current.session) {
        throw new Error('Ikke logget inn. Prøv å logge inn på nytt.');
      }

      await agentRef.current.post({
        text: postContent,
        createdAt: new Date().toISOString(),
      });
      setStatus({
        type: 'success',
        message: 'Innlegg publisert!'
      });
      setPostContent('');
    } catch (error) {
      console.error('Posting error:', error);
      setStatus({
        type: 'error',
        message: `Feil ved publisering: ${error.message}`
      });
    }
  };

  // Håndter navigasjon til andre profiler
  const handleProfileNavigation = (handle) => {
    setCurrentProfile(handle);
    setCurrentView('profile');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Bluesky PoC</h1>
      
      {!isLoggedIn ? (
        // Login form
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Bluesky brukernavn"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passord"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition-colors"
          >
            Logg inn
          </button>
        </form>
      ) : (
        // Innlogget visning
        <div>
          {/* Navigasjonsheader */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <button 
              onClick={() => setCurrentView('feed')}
              className={`px-4 py-2 rounded ${
                currentView === 'feed' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-blue-500 hover:bg-blue-50'
              }`}
            >
              Feed
            </button>
            <button 
              onClick={() => {
                setCurrentProfile(username);
                setCurrentView('profile');
              }}
              className={`px-4 py-2 rounded ${
                currentView === 'profile' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-blue-500 hover:bg-blue-50'
              }`}
            >
              Min Profil
            </button>
          </div>

          {/* Hovedinnhold */}
          <div className="mt-4">
            {currentView === 'feed' ? (
              // Feed visning med post form
              <div className="space-y-6">
                <form onSubmit={handlePost} className="space-y-4">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Skriv noe..."
                    className="w-full p-2 border rounded h-24 resize-none"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded transition-colors"
                  >
                    Publiser
                  </button>
                </form>
                {/* Her kan du senere legge til Feed-komponenten */}
              </div>
            ) : (
              // Profil visning
              <Profile 
                agent={agentRef.current} 
                handle={currentProfile}
                onUserClick={handleProfileNavigation}
              />
            )}
          </div>

          {/* Status meldinger */}
          {status.message && (
            <div
              className={`mt-4 p-2 rounded ${
                status.type === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {status.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;