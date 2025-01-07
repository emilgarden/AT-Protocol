// src/components/Profile.jsx
import React, { useState, useEffect } from 'react';
import Feed from './Feed';

const ProfileHeader = ({ profile, handleFollow, isFollowing }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600"></div>
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <img 
            src={profile.avatar} 
            alt={profile.displayName} 
            className="w-24 h-24 rounded-full border-4 border-white shadow-sm -mt-12"
          />
          <div className="flex-1 pt-2">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{profile.displayName}</h2>
                <p className="text-gray-600">@{profile.handle}</p>
              </div>
              {handleFollow && (
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-full transition-colors ${
                    isFollowing
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isFollowing ? 'Følger' : 'Følg'}
                </button>
              )}
            </div>
            {profile.description && (
              <p className="mt-4 text-gray-700">{profile.description}</p>
            )}
            <div className="mt-4 flex space-x-6 text-sm">
              <div>
                <span className="font-semibold text-gray-900">{profile.followersCount}</span>
                <span className="ml-1 text-gray-500">følgere</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{profile.followsCount}</span>
                <span className="ml-1 text-gray-500">følger</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{profile.postsCount}</span>
                <span className="ml-1 text-gray-500">innlegg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FollowList = ({ users, type, onUserClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          {type === 'followers' ? 'Følgere' : 'Følger'}
        </h3>
      </div>
      <div className="divide-y divide-gray-200">
        {users.map((user) => (
          <div 
            key={user.did} 
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onUserClick(user.handle)}
          >
            <div className="flex items-center space-x-3">
              <img 
                src={user.avatar} 
                alt={user.displayName} 
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="font-medium text-gray-900">{user.displayName}</div>
                <div className="text-sm text-gray-500">@{user.handle}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Profile = ({ agent, handle, onProfileClick }) => {
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profileResponse = await agent.getProfile({ actor: handle });
        setProfile(profileResponse.data);
        setIsFollowing(profileResponse.data.viewer?.following);

        const [followersRes, followingRes] = await Promise.all([
          agent.getFollowers({ actor: handle }),
          agent.getFollows({ actor: handle })
        ]);

        setFollowers(followersRes.data.followers);
        setFollowing(followingRes.data.follows);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Kunne ikke laste profilen');
        setLoading(false);
      }
    };

    if (agent && handle) {
      fetchProfile();
    }
  }, [agent, handle]);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await agent.deleteFollow(profile.viewer.following);
      } else {
        await agent.follow(profile.did);
      }
      setIsFollowing(!isFollowing);
      setProfile(prev => ({
        ...prev,
        followersCount: isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
      }));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Laster profil...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">Fant ikke profilen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileHeader 
        profile={profile} 
        handleFollow={handle !== profile.handle ? handleFollow : null}
        isFollowing={isFollowing}
      />
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'profile' 
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            Innlegg
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'followers' 
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('followers')}
          >
            Følgere
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'following' 
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('following')}
          >
            Følger
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'profile' && (
            <div className="-mt-4 -mx-4">
              <Feed 
                agent={agent}
                handle={handle}
                onProfileClick={onProfileClick}
              />
            </div>
          )}
          
          {activeTab === 'followers' && (
            <FollowList 
              users={followers}
              type="followers"
              onUserClick={onProfileClick}
            />
          )}
          
          {activeTab === 'following' && (
            <FollowList 
              users={following}
              type="following"
              onUserClick={onProfileClick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;