import React, { useState } from "react";
import normalizer from "../utils/blueskyNormalizer";
import { BskyAgent } from "@atproto/api";

/**
 * Demo-komponent som viser hvordan man kan bruke blueskyNormalizer-modulen
 * for å behandle og visualisere data fra Bluesky API.
 */
const PostNormalizerDemo = () => {
  const [rawData, setRawData] = useState(null);
  const [normalizedData, setNormalizedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [renderMode, setRenderMode] = useState("compare"); // 'compare', 'raw', 'normalized'

  // Opprett en instans av BskyAgent
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });

  /**
   * Henter en post og viser både rå og normalisert data
   */
  const fetchAndNormalizePost = async (postUri) => {
    if (!postUri) {
      setError("Vennligst oppgi en post-URI");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Split URI for å hente repositori og rID
      const parts = postUri.split("/");
      if (parts.length < 2) {
        throw new Error("Ugyldig post-URI format");
      }

      // Koble til som gjest hvis ikke allerede logget inn
      const isLoggedIn = agent.session !== undefined;
      if (!isLoggedIn) {
        await agent
          .login({
            identifier: "demo-user.bsky.social", // Erstatt med gyldig test-konto eller bruk createSession for gjestebruker
            password: "********", // Faktisk passord vil ikke være hardkodet i produksjon!
          })
          .catch(() => {
            // Logg inn som gjest hvis brukerlogin feiler
            return agent.createSession({
              service: "https://bsky.social",
            });
          });
      }

      // Hent post basert på URI
      const repo = parts[parts.length - 2];
      const rkey = parts[parts.length - 1];

      // Simulert API-kall (i produksjon ville dette bruke agent.getPost)
      // For demo-formål viser vi hvordan vi ville kalle API:
      const response = {
        uri: postUri,
        cid: "example-cid",
        author: {
          did: "did:plc:example",
          handle: "demo.bsky.social",
          displayName: "Demo Bruker",
          avatar: "https://placekitten.com/200/200",
          description: "Dette er en demo-bruker",
          followersCount: 120,
          followsCount: 85,
        },
        record: {
          text: "Dette er et eksempel på en Bluesky-post med en #hashtag og en @mention og en lenke https://example.com",
          createdAt: new Date().toISOString(),
          facets: [
            {
              index: { byteStart: 52, byteEnd: 60 },
              features: [
                { $type: "app.bsky.richtext.facet#tag", tag: "hashtag" },
              ],
            },
            {
              index: { byteStart: 65, byteEnd: 73 },
              features: [
                {
                  $type: "app.bsky.richtext.facet#mention",
                  did: "did:plc:example2",
                },
              ],
            },
            {
              index: { byteStart: 87, byteEnd: 106 },
              features: [
                {
                  $type: "app.bsky.richtext.facet#link",
                  uri: "https://example.com",
                },
              ],
            },
          ],
        },
        embed: {
          $type: "app.bsky.embed.external",
          external: {
            uri: "https://example.com",
            title: "Eksempel Nettside",
            description:
              "Dette er en eksempel-beskrivelse for en ekstern lenke",
            thumb: "https://placekitten.com/300/200",
          },
        },
        likeCount: 42,
        repostCount: 12,
        replyCount: 7,
        indexedAt: new Date().toISOString(),
      };

      // For å demonstrere YouTube-ID-ekstrahering
      const youtubeResponse = {
        ...response,
        embed: {
          $type: "app.bsky.embed.external",
          external: {
            uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            title: "YouTube Video Eksempel",
            description: "Dette er en beskrivelse av en YouTube-video",
            thumb: "https://placekitten.com/300/200",
          },
        },
      };

      // Bruk normalizer for å behandle dataene
      const normalizedPost = normalizer.normalizePost(youtubeResponse);

      // Oppdater tilstanden
      setRawData(youtubeResponse);
      setNormalizedData(normalizedPost);
    } catch (err) {
      setError(`Feil ved henting eller normalisering av post: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Hjelpefunksjon for å vise JSON-data pent formatert
   */
  const renderJson = (data) => {
    if (!data) return null;
    return (
      <pre
        style={{
          backgroundColor: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
          maxHeight: "400px",
          fontSize: "0.85rem",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  /**
   * Komponent for å vise en normalisert post med formatering
   */
  const NormalizedPostView = ({ post }) => {
    if (!post) return null;

    return (
      <div
        className="normalized-post"
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "16px",
        }}
      >
        <div
          className="post-header"
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          {post.author.avatar && (
            <img
              src={post.author.avatar}
              alt={post.author.displayName}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                marginRight: "12px",
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: "bold" }}>{post.author.displayName}</div>
            <div style={{ color: "#657786" }}>@{post.author.handle}</div>
          </div>
        </div>

        <div className="post-content" style={{ marginBottom: "12px" }}>
          {post.text}
        </div>

        {post.images.length > 0 && (
          <div
            className="post-images"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            {post.images.map((image, index) => (
              <img
                key={index}
                src={image.thumb}
                alt={image.alt}
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  borderRadius: "4px",
                }}
              />
            ))}
          </div>
        )}

        {post.externalLink && (
          <div
            className="external-link"
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            {post.externalLink.thumb && (
              <img
                src={post.externalLink.thumb}
                alt={post.externalLink.title}
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "cover",
                }}
              />
            )}
            <div style={{ padding: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                {post.externalLink.title}
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "#657786",
                  marginBottom: "4px",
                }}
              >
                {post.externalLink.description}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#8899a6" }}>
                {post.externalLink.domain}
              </div>
            </div>
          </div>
        )}

        {post.youtubeId && (
          <div className="youtube-embed" style={{ marginBottom: "12px" }}>
            <div
              style={{
                padding: "8px",
                backgroundColor: "#f8f8f8",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            >
              <strong>YouTube ID ekstrahert:</strong> {post.youtubeId}
            </div>
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                overflow: "hidden",
                borderRadius: "8px",
              }}
            >
              <iframe
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                src={`https://www.youtube.com/embed/${post.youtubeId}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}

        <div
          className="post-stats"
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "0.9rem",
            color: "#657786",
          }}
        >
          <div>❤️ {post.likeCount}</div>
          <div>🔄 {post.repostCount}</div>
          <div>💬 {post.replyCount}</div>
        </div>
      </div>
    );
  };

  /**
   * Render demo-komponenten
   */
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>Bluesky API Normalizer Demo</h1>
      <p>
        Denne demonstrasjonen viser hvordan <code>blueskyNormalizer.js</code>{" "}
        kan brukes for å håndtere API-data fra Bluesky på en konsistent måte.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() =>
            fetchAndNormalizePost(
              "at://did:plc:example/app.bsky.feed.post/examplepost",
            )
          }
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            marginRight: "10px",
          }}
        >
          {loading ? "Laster..." : "Last demo-post"}
        </button>

        <div style={{ marginTop: "10px" }}>
          <label style={{ marginRight: "10px" }}>
            <input
              type="radio"
              name="viewMode"
              checked={renderMode === "compare"}
              onChange={() => setRenderMode("compare")}
            />{" "}
            Sammenlign
          </label>
          <label style={{ marginRight: "10px" }}>
            <input
              type="radio"
              name="viewMode"
              checked={renderMode === "raw"}
              onChange={() => setRenderMode("raw")}
            />{" "}
            Rå data
          </label>
          <label>
            <input
              type="radio"
              name="viewMode"
              checked={renderMode === "normalized"}
              onChange={() => setRenderMode("normalized")}
            />{" "}
            Normalisert
          </label>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {renderMode === "compare" && (
        <>
          {(rawData || normalizedData) && (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "300px" }}>
                <h2>Rå API-data</h2>
                {renderJson(rawData)}
              </div>
              <div style={{ flex: 1, minWidth: "300px" }}>
                <h2>Normalisert data</h2>
                {renderJson(normalizedData)}
              </div>
            </div>
          )}
        </>
      )}

      {renderMode === "raw" && (
        <>
          <h2>Rå API-data</h2>
          {renderJson(rawData)}
        </>
      )}

      {renderMode === "normalized" && (
        <>
          <h2>Normalisert data</h2>
          <NormalizedPostView post={normalizedData} />
          <h3>Rå normalisert JSON</h3>
          {renderJson(normalizedData)}
        </>
      )}

      <div style={{ marginTop: "40px" }}>
        <h2>Nøkkelfunksjoner i blueskyNormalizer</h2>
        <ul style={{ lineHeight: "1.6" }}>
          <li>
            <strong>normalizePost(postInput)</strong> - Normaliserer et helt
            post-objekt
          </li>
          <li>
            <strong>normalizePosts(posts)</strong> - Normaliserer en samling med
            poster
          </li>
          <li>
            <strong>normalizeAuthor(input)</strong> - Normaliserer forfatterdata
          </li>
          <li>
            <strong>normalizeImages(embed)</strong> - Ekstraherer bilder fra et
            embed-objekt
          </li>
          <li>
            <strong>normalizeExternalLink(embed)</strong> - Ekstraherer og
            normaliserer eksterne lenker
          </li>
          <li>
            <strong>extractYoutubeId(url)</strong> - Trekker ut YouTube-ID fra
            en URL
          </li>
          <li>
            <strong>isRepost(post)</strong> - Sjekker om et innlegg er en repost
          </li>
          <li>
            <strong>isQuote(post)</strong> - Sjekker om et innlegg er et sitat
          </li>
        </ul>

        <h3>Eksempelbruk:</h3>
        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          {`import normalizer from '../utils/blueskyNormalizer';

// Normaliser et post-objekt fra API
const normalizedPost = normalizer.normalizePost(rawPostFromApi);

// Sjekk om en post er en repost
if (normalizer.isRepost(post)) {
  const originalPost = normalizer.getOriginalPost(post);
  const repostedBy = post.repostedBy; // Normalisert forfatter
}

// Vis YouTube-innhold hvis tilgjengelig
if (normalizedPost.youtubeId) {
  return <YouTubePlayer id={normalizedPost.youtubeId} />;
}

// Håndter bilder sikkert
const safeImages = normalizedPost.images || [];
`}
        </pre>
      </div>
    </div>
  );
};

export default PostNormalizerDemo;
