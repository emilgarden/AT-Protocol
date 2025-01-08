// App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { BskyAgent } from '@atproto/api';
import Profile from './components/Profile';
import Feed from './components/Feed';

const App = () => {
  // State declarations
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [postContent, setPostContent] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [currentView, setCurrentView] = useState('feed');
  const [currentProfile, setCurrentProfile] = useState(null);
  
  // Agent reference
  const agentRef = useRef(null);

  // Initialize agent
  useEffect(() => {
    agentRef.current = new BskyAgent({ service: 'https://bsky.social' });
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await agentRef.current.login({ identifier: username, password });
      setIsLoggedIn(true);
      setCurrentProfile(username);
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

  // Profile navigation handler
  const handleProfileNavigation = (handle) => {
    setCurrentProfile(handle);
    setCurrentView('profile');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-blue-600">Bluesky PoC</h1>
            {isLoggedIn && (
              <div className="flex space-x-4">
                <button 
                  onClick={() => setCurrentView('feed')}
                  className={`px-4 py-2 rounded-md transition-colors ${
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
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentView === 'profile' 
                      ? 'bg-blue-500 text-white'
                      : 'text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  Min Profil
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-12 space-y-8">
        {!isLoggedIn ? (
          // Login Form
          <div className="max-w-md mx-auto bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Logg inn på Bluesky
            </h2>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Brukernavn
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Passord
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Logg inn
              </button>
            </form>
          </div>
        ) : (
          // Logged in view
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {currentView === 'feed' ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <form onSubmit={handlePost} className="space-y-4">
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Hva tenker du på?"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        rows="4"
                        required
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Publiser
                        </button>
                      </div>
                    </form>
                  </div>
                  <Feed 
                    agent={agentRef.current}
                    onProfileClick={handleProfileNavigation}
                  />
                </div>
              ) : (
                <Profile 
                  agent={agentRef.current} 
                  handle={currentProfile}
                  onProfileClick={handleProfileNavigation}
                />
              )}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status.message && (
          <div
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
              status.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {status.message}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;