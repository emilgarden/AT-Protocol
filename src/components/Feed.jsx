// src/components/Feed.jsx
import React, { useState, useEffect } from 'react';

const PostCard = ({ post, onProfileClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LENGTH = 250;

  const handleProfileClick = (e) => {
    e.stopPropagation();
    onProfileClick(post.author.handle);
  };

  const formattedDate = new Date(post.indexedAt).toLocaleString('no-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  const text = post.record.text;
  const isLongText = text.length > MAX_LENGTH;
  const displayText = isExpanded ? text : text.slice(0, MAX_LENGTH);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 hover:shadow-lg transition-shadow p-4">
      <div className="p-4">
        <div className="flex items-start space-x-4">
          <img
            src={post.author.avatar}
            alt={post.author.handle}
            className="w-12 h-12 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleProfileClick}
          />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <div 
                className="cursor-pointer group"
                onClick={handleProfileClick}
              >
                <span className="font-semibold text-gray-900 group-hover:underline">
                  {post.author.displayName}
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  @{post.author.handle}
                </span>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {formattedDate}
              </span>
            </div>
            
            <div className="mt-2">
              <p className="text-gray-900 whitespace-pre-wrap">
                {displayText}
                {isLongText && !isExpanded && '...'}
              </p>
              {isLongText && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-500 text-sm mt-1 hover:text-blue-600 focus:outline-none focus:text-blue-700"
                >
                  {isExpanded ? 'Vis mindre' : 'Vis mer'}
                </button>
              )}
            </div>

            {post.embed?.images?.length > 0 && (
              <div className="mt-3 rounded-lg overflow-hidden">
                <img
                    src={post.embed?.images[0]?.fullsize}
                    alt="Post image"
                    className="w-64 h-64 rounded-lg object-cover"
                />

              </div>
            )}

            <div className="flex items-center space-x-6 mt-4 pt-2 border-t border-gray-100">
              <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
                <span className="text-sm font-medium">
                  {post.likeCount || 0} likes
                </span>
              </button>
              <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors">
                <span className="text-sm font-medium">
                  {post.repostCount || 0} reposts
                </span>
              </button>
              <button className="flex items-center space-x-2 text-gray-500 hover:text-purple-500 transition-colors">
                <span className="text-sm font-medium">
                  {post.replyCount || 0} svar
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Feed = ({ agent, handle, onProfileClick }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        let response;
        
        if (handle) {
          response = await agent.getAuthorFeed({ actor: handle });
        } else {
          response = await agent.getTimeline();
        }
        
        setPosts(response.data.feed);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Kunne ikke laste innlegg');
        setLoading(false);
      }
    };

    if (agent) {
      fetchPosts();
    }
  }, [agent, handle]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Laster innlegg...</div>
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

  if (!posts.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">Ingen innlegg å vise</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {posts.map((item) => (
      <PostCard
        key={item.post.uri}
        post={item.post}
        onProfileClick={onProfileClick}
      />
    ))}
  </div>
  );
};

export default Feed;