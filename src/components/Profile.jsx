// src/components/Profile.jsx
import React, { useState, useEffect } from 'react';

const ProfileHeader = ({ profile, handleFollow, isFollowing }) => {
  return (
    <div className="border rounded-lg p-6 mb-4">
      <div className="flex items-start space-x-4">
        <img 
          src={profile.avatar} 
          alt={profile.displayName} 
          className="w-20 h-20 rounded-full"
        />
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              <p className="text-gray-600">@{profile.handle}</p>
            </div>
            {handleFollow && (
              <button
                onClick={handleFollow}
                className={`px-4 py-2 rounded-full ${
                  isFollowing
                    ? 'bg-gray-200 hover:bg-gray-300'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isFollowing ? 'Følger' : 'Følg'}
              </button>
            )}
          </div>
          <p className="mt-2">{profile.description}</p>
          <div className="mt-4 flex space-x-4 text-sm text-gray-600">
            <span>{profile.followersCount} følgere</span>
            <span>{profile.followsCount} følger</span>
            <span>{profile.postsCount} innlegg</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const FollowList = ({ users, type, onUserClick }) => {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">
        {type === 'followers' ? 'Følgere' : 'Følger'}
      </h3>
      <div className="space-y-4">
        {users.map((user) => (
          <div 
            key={user.did} 
            className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
            onClick={() => onUserClick(user.handle)}
          >
            <img 
              src={user.avatar} 
              alt={user.displayName} 
              className="w-10 h-10 rounded-full"
            />
            <div>
              <div className="font-medium">{user.displayName}</div>
              <div className="text-sm text-gray-600">@{user.handle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Profile = ({ agent, handle }) => {
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

        // Hent følgere og følger samtidig
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

    fetchProfile();
  }, [agent, handle]);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await agent.deleteFollow(profile.viewer.following);
      } else {
        await agent.follow(profile.did);
      }
      setIsFollowing(!isFollowing);
      // Oppdater følgertall
      setProfile(prev => ({
        ...prev,
        followersCount: isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
      }));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleUserClick = (userHandle) => {
    // Her kan du implementere navigasjon til brukerens profil
    console.log(`Navigate to ${userHandle}'s profile`);
  };

  if (loading) {
    return <div className="text-center p-4">Laster profil...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

  if (!profile) {
    return <div className="text-center p-4">Fant ikke profilen</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProfileHeader 
        profile={profile} 
        handleFollow={handle !== profile.handle ? handleFollow : null}
        isFollowing={isFollowing}
      />
      
      <div className="mb-4">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 ${
              activeTab === 'profile' ? 'border-b-2 border-blue-500' : ''
            }`}
            onClick={() => setActiveTab('profile')}
          >
            Profil
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === 'followers' ? 'border-b-2 border-blue-500' : ''
            }`}
            onClick={() => setActiveTab('followers')}
          >
            Følgere
          </button>
          <button
            className={`px-4 py-2 ${
              activeTab === 'following' ? 'border-b-2 border-blue-500' : ''
            }`}
            onClick={() => setActiveTab('following')}
          >
            Følger
          </button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-4">
          {/* Her kan du legge til brukerens innlegg */}
          <p className="text-center text-gray-600">Brukerens innlegg kommer her</p>
        </div>
      )}
      
      {activeTab === 'followers' && (
        <FollowList 
          users={followers} 
          type="followers"
          onUserClick={handleUserClick}
        />
      )}
      
      {activeTab === 'following' && (
        <FollowList 
          users={following} 
          type="following"
          onUserClick={handleUserClick}
        />
      )}
    </div>
  );
};

export default Profile;