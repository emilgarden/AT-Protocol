// src/components/Profile.jsx
// 1. React og biblioteksimporter
import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  memo,
  useMemo,
} from "react";
import PropTypes from "prop-types";

// 2. Egne komponenter
import Feed from "./Feed";
import ErrorBoundary from "./ui/ErrorBoundary";
import ErrorFallback from "./ui/ErrorFallback";
import SafeImage from "./ui/SafeImage";

// 3. Utils og hooks
import { useProfile } from "../hooks/useProfile";
import { debugLog, debugError, debugWarn } from "../utils/debug";

const ProfileSkeleton = memo(() => (
  <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4 mb-4 animate-pulse">
    <div className="relative">
      <div className="h-32 bg-gray-200 rounded-t-lg" />
      <div className="absolute -bottom-16 left-6">
        <div className="w-32 h-32 bg-gray-300 rounded-full" />
      </div>
    </div>
    <div className="h-20"></div>
    <div className="flex flex-col mt-4 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
));

/**
 * Komponent som viser en liste av brukere med avatar og info
 *
 * @param {Object} props - Komponent-props
 * @param {Array} props.users - Array av bruker-objekter
 * @param {Function} props.onUserClick - Callback når en bruker klikkes på
 * @param {boolean} props.isLoading - Om listen lastes inn
 * @param {Error} props.error - Eventuell feil ved lasting
 */
const UserList = memo(
  ({
    users = [],
    isLoading = false,
    title = "Brukere",
    onUserClick = null,
    onFollowToggle = null,
    checkIsFollowed = () => false,
  }) => {
    // Memoized callback for user click
    const handleUserClick = useCallback(
      (e, handle) => {
        e.preventDefault();
        if (onUserClick) {
          onUserClick(handle);
        }
      },
      [onUserClick],
    );

    // Memoized callback for follow toggle
    const handleFollowToggle = useCallback(
      (e, user) => {
        e.preventDefault();
        e.stopPropagation();

        if (onFollowToggle) {
          onFollowToggle(user?.did, checkIsFollowed?.(user));
        }
      },
      [onFollowToggle, checkIsFollowed],
    );

    // Loading state
    if (isLoading) {
      return (
        <div className="p-4">
          <h3 className="text-lg font-medium mb-4">{title || "Brukere"}</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center p-2 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="ml-3 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Empty state
    if (!users || users.length === 0) {
      return (
        <div className="p-4">
          <h3 className="text-lg font-medium mb-4">{title || "Brukere"}</h3>
          <div className="text-center p-8 bg-gray-50 rounded-md text-gray-500">
            Ingen brukere å vise
          </div>
        </div>
      );
    }

    // List of users
    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-4">{title || "Brukere"}</h3>
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user?.did || Math.random().toString()}
              className="flex items-center p-3 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
              onClick={(e) => handleUserClick(e, user?.handle)}
            >
              <SafeImage
                src={user?.avatar || ""}
                alt={`Avatar for ${user?.displayName || user?.handle || "bruker"}`}
                className="w-10 h-10 rounded-full"
              />
              <div className="ml-3 flex-1 overflow-hidden">
                <div className="font-medium truncate">
                  {user?.displayName || user?.handle}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  @{user?.handle || ""}
                </div>
              </div>
              <button
                onClick={(e) => handleFollowToggle(e, user)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  checkIsFollowed?.(user)
                    ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                {checkIsFollowed?.(user) ? "Følger" : "Følg"}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

// Definerer PropTypes for UserList
UserList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      did: PropTypes.string,
      handle: PropTypes.string,
      displayName: PropTypes.string,
      avatar: PropTypes.string,
    }),
  ),
  isLoading: PropTypes.bool,
  title: PropTypes.string,
  onUserClick: PropTypes.func,
  onFollowToggle: PropTypes.func,
  checkIsFollowed: PropTypes.func,
};

/**
 * Viser profilheader med brukerbilde, navn, banner og følg-knapp
 *
 * @param {Object} props - Komponent-props
 * @param {Object} props.profile - Profilobjekt med brukerdata
 * @param {Function} props.handleFollow - Callback for følg-knappen
 * @param {boolean} props.isFollowing - Om brukeren følges
 * @param {Function} props.onRefresh - Callback for å oppdatere profilen
 */
const ProfileHeader = memo(
  ({
    profile = null,
    isFollowing = false,
    onFollowToggle = null,
    onRefresh = null,
  }) => {
    // Håndter klikk på følg-knappen
    const handleFollowClick = useCallback(
      (e) => {
        e.preventDefault();

        if (onFollowToggle) {
          onFollowToggle();
        }
      },
      [onFollowToggle],
    );

    // Håndter klikk på oppdater-knappen
    const handleRefreshClick = useCallback(
      (e) => {
        e.preventDefault();

        if (onRefresh) {
          onRefresh();
        }
      },
      [onRefresh],
    );

    // Vis ingenting hvis profildata mangler
    if (!profile) return null;

    // Hent ut data om profilen
    const {
      displayName,
      handle,
      description,
      avatar,
      banner,
      followersCount,
      followsCount,
    } = profile;

    return (
      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4 mb-4">
        {/* Banner og profilbilde */}
        <div className="relative">
          <div className="h-32 bg-gray-200 rounded-t-lg overflow-hidden">
            {banner && (
              <SafeImage
                src={banner}
                alt={`Banner for ${displayName || handle}`}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="absolute -bottom-16 left-6">
            <div className="w-32 h-32 bg-gray-300 rounded-full overflow-hidden border-4 border-white">
              <SafeImage
                src={avatar}
                alt={`Avatar for ${displayName || handle}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Profil-informasjon */}
        <div className="mt-20 flex justify-between">
          <div>
            <h1 className="text-xl font-bold">{displayName || `@${handle}`}</h1>
            {displayName && <p className="text-gray-500">@{handle}</p>}
            {description && <p className="mt-2 text-gray-700">{description}</p>}

            <div className="flex mt-3 space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{followsCount || 0}</span>{" "}
                følger
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{followersCount || 0}</span>{" "}
                følgere
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <button
              onClick={handleFollowClick}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                isFollowing
                  ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isFollowing ? "Følger" : "Følg"}
            </button>

            <button
              onClick={handleRefreshClick}
              className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              title="Oppdater profil"
            >
              <span className="sr-only">Oppdater</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// PropTypes for ProfileHeader
ProfileHeader.propTypes = {
  profile: PropTypes.shape({
    did: PropTypes.string,
    handle: PropTypes.string,
    displayName: PropTypes.string,
    description: PropTypes.string,
    avatar: PropTypes.string,
    banner: PropTypes.string,
    followersCount: PropTypes.number,
    followsCount: PropTypes.number,
    viewer: PropTypes.shape({
      following: PropTypes.bool,
      followedBy: PropTypes.bool,
    }),
  }),
  isFollowing: PropTypes.bool,
  onFollowToggle: PropTypes.func,
  onRefresh: PropTypes.func,
};

/**
 * Profile-komponent for visning av brukers profil på Bluesky
 *
 * @component
 * @param {Object} props - Komponent props
 * @param {Object} props.agent - ATP Agent-instans
 * @param {string} props.handle - Brukerhåndtak for profilen som skal vises
 * @param {Function} props.onProfileClick - Callback som kalles når en bruker klikkes
 * @param {boolean} props.autoload - Om innholdet skal lastes automatisk
 */
const Profile = memo(({ agent, handle, onProfileClick = null, autoload = true }) => {
  // State for aktiv fane (posts, followers, following)
  const [activeTab, setActiveTab] = useState("posts");

  // Bruk profile hook for å hente profildata
  const {
    profile,
    loading,
    error,
    follows,
    followers,
    followsLoading,
    followersLoading,
    followCount,
    retrying,
    fetchFollows,
    toggleFollow,
    refreshProfile,
  } = useProfile(agent, handle, {
    maxRetries: 3,
    cacheTime: 15 * 60 * 1000, // 15 minutter cache-tid
  });

  const handleFollow = useCallback(async () => {
    if (!profile) return;

    const isFollowing = profile?.viewer?.following;
    const result = await toggleFollow(profile.did, isFollowing);

    if (!result.success) {
      debugError("Følgefeil:", result.error);
      // Vis feilmelding til bruker
      alert(result.error);
    }
  }, [profile, toggleFollow]);

  const handleFollowersClick = useCallback(() => {
    setActiveTab("followers");
    fetchFollows("followers");
  }, [fetchFollows]);

  const handleFollowingClick = useCallback(() => {
    setActiveTab("following");
    fetchFollows("follows");
  }, [fetchFollows]);

  const handleUserClick = useCallback(
    (userHandle) => {
      if (onProfileClick) {
        onProfileClick(userHandle);
      }
    },
    [onProfileClick],
  );

  const handleRetry = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  const checkIsFollowed = useCallback(
    (user) => {
      if (!user || !profile) return false;

      // Bruker følger meg
      if (user.did === profile.did) return null; // Kan ikke følge seg selv

      // Sjekk om bruker er fulgt i lokal liste
      if (follows && follows.length > 0) {
        return follows.some((f) => f.did === user.did);
      }

      return false;
    },
    [profile, follows],
  );

  const toggleUserFollow = useCallback(
    async (did, isFollowing) => {
      if (!did) return;

      try {
        const result = await toggleFollow(did, isFollowing);
        if (!result.success) {
          debugError("Følgefeil:", result.error);
          alert(
            `Kunne ikke ${isFollowing ? "avfølge" : "følge"} brukeren. Prøv igjen senere.`,
          );
        }
      } catch (err) {
        debugError("Følgefeil:", err);
        alert("En ukjent feil oppstod. Prøv igjen senere.");
      }
    },
    [toggleFollow],
  );

  // Last inn profildata
  useEffect(() => {
    // Reset active tab
    setActiveTab("posts");

    if (autoload) {
      refreshProfile();
    }
  }, [handle, autoload, refreshProfile]);

  // Memoized tabs element for better performance
  const tabsElement = useMemo(() => {
    return (
      <div className="profile-tabs border-b mb-4">
        <div className="flex">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "posts"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-600 hover:text-blue-500"
            }`}
            onClick={() => setActiveTab("posts")}
          >
            Innlegg
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "followers"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-600 hover:text-blue-500"
            }`}
            onClick={handleFollowersClick}
          >
            Følgere {followCount?.followers ? `(${followCount.followers})` : ""}
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "following"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-600 hover:text-blue-500"
            }`}
            onClick={handleFollowingClick}
          >
            Følger {followCount?.follows ? `(${followCount.follows})` : ""}
          </button>
        </div>
      </div>
    );
  }, [activeTab, followCount, handleFollowersClick, handleFollowingClick]);

  // Memoized retry overlay
  const retryOverlay = useMemo(() => {
    if (!retrying) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md text-center">
          <div className="text-3xl mb-4 animate-spin">⟳</div>
          <h3 className="text-xl font-bold mb-2">Prøver på nytt...</h3>
          <p className="text-gray-600 mb-4">
            Det oppstod en feil. Vi prøver å laste inn dataene igjen.
          </p>
        </div>
      </div>
    );
  }, [retrying]);

  // Hvis profilen ikke er funnet
  if (error && !loading && !retrying) {
    return (
      <div className="profile-not-found bg-white rounded-md shadow-sm p-8 text-center">
        <div className="text-3xl mb-4 text-amber-500">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Profil ikke funnet</h1>
        <p className="text-gray-600 mb-6">
          Vi kunne ikke finne profilen @{handle}. Profilen kan være slettet
          eller utilgjengelig.
        </p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={handleRetry}
        >
          Prøv igjen
        </button>
      </div>
    );
  }

  // Vis skjelett-laster hvis data lastes
  if (loading && !profile) {
    return <ProfileSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div className="profile-container relative">
        {retryOverlay}

        <ProfileHeader
          profile={profile}
          isFollowing={profile?.viewer?.following}
          onFollowToggle={handleFollow}
          onRefresh={refreshProfile}
        />

        {tabsElement}

        <div className="profile-content">
          {activeTab === "posts" && (
            <Suspense
              fallback={
                <div className="loading-spinner">Laster innlegg...</div>
              }
            >
              <Feed
                agent={agent}
                handle={handle}
                feedType="author"
                onProfileClick={onProfileClick}
              />
            </Suspense>
          )}

          {activeTab === "followers" && (
            <UserList
              title="Følgere"
              users={followers}
              isLoading={followersLoading}
              onUserClick={handleUserClick}
              onFollowToggle={toggleUserFollow}
              checkIsFollowed={checkIsFollowed}
            />
          )}

          {activeTab === "following" && (
            <UserList
              title="Følger"
              users={follows}
              isLoading={followsLoading}
              onUserClick={handleUserClick}
              onFollowToggle={toggleUserFollow}
              checkIsFollowed={checkIsFollowed}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

// Profile PropTypes
Profile.propTypes = {
  agent: PropTypes.object.isRequired,
  handle: PropTypes.string.isRequired,
  onProfileClick: PropTypes.func,
  autoload: PropTypes.bool,
};

export default Profile;
