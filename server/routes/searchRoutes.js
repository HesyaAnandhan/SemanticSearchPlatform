const express = require("express");
const Resource = require("../models/Resource");
const Domain = require("../models/Domain");
const SearchLog = require("../models/SearchLog");
const authMiddleware = require("../middleware/authMiddleware");
const { generateEmbedding } = require("../services/embeddingService");

const router = express.Router();
console.log("🔥 NEW SEARCH ROUTE ACTIVE - 60/30/10");

// ====================================
// Cosine Similarity
// ====================================

function cosineSimilarity(vectorA, vectorB) {
  if (
    !vectorA ||
    !vectorB ||
    vectorA.length === 0 ||
    vectorB.length === 0
  ) {
    return 0;
  }

  if (vectorA.length !== vectorB.length) {
    console.warn(
      `Cosine similarity dimension mismatch: ${vectorA.length} vs ${vectorB.length}`
    );
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}

// ====================================
// Stop Words
// ====================================

const STOP_WORDS = new Set([
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "are",
  "is",
  "was",
  "were",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "does",
  "do",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "about",
  "tell",
  "me",
  "please",
  "give",
  "explain",
  "there",
  "their",
  "this",
  "that",
  "these",
  "those"
]);

// ====================================
// Extract Important Query Words
// ====================================

function extractQueryWords(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => {
      return (
        word.length > 2 &&
        !STOP_WORDS.has(word)
      );
    });
}

// ====================================
// Normalize Text
// ====================================

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ====================================
// Keyword Coverage
// ====================================

function calculateKeywordCoverage(
  keywords,
  title,
  content
) {
  if (keywords.length === 0) {
    return 0;
  }

  const lowerTitle = normalizeText(title);
  const lowerContent = normalizeText(content);

  let matched = 0;

  for (const keyword of keywords) {
    if (
      lowerTitle.includes(keyword) ||
      lowerContent.includes(keyword)
    ) {
      matched++;
    }
  }

  return matched / keywords.length;
}

// ====================================
// Exact Phrase Match
// ====================================

function calculatePhraseMatch(
  query,
  title,
  content
) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const normalizedTitle = normalizeText(title);
  const normalizedContent = normalizeText(content);

  if (normalizedTitle.includes(normalizedQuery)) {
    return 1;
  }

  if (normalizedContent.includes(normalizedQuery)) {
    return 1;
  }

  return 0;
}

// ====================================
// Important Keyword Match
// ====================================

function calculateKeywordScore(
  keywords,
  title,
  content
) {
  if (keywords.length === 0) {
    return 0;
  }

  const lowerTitle = normalizeText(title);
  const lowerContent = normalizeText(content);

  let score = 0;

  for (const keyword of keywords) {
    if (lowerTitle.includes(keyword)) {
      score += 1;
    } else if (lowerContent.includes(keyword)) {
      score += 0.5;
    }
  }

  return Math.min(
    score / keywords.length,
    1
  );
}

// ====================================
// Match Explanation
// ====================================

function getMatchReason(
  semanticScore,
  keywordCoverage,
  keywordScore,
  phraseMatch
) {
  if (phraseMatch === 1) {
    return "Exact phrase found in the resource";
  }

  if (
    keywordCoverage >= 0.75 &&
    semanticScore >= 0.50
  ) {
    return "Strong keyword coverage + semantic similarity";
  }

  if (
    keywordCoverage >= 0.50 &&
    semanticScore >= 0.50
  ) {
    return "Good keyword coverage + semantic similarity";
  }

  if (keywordScore >= 0.50) {
    return "Relevant keyword match";
  }

  if (semanticScore >= 0.60) {
    return "Semantic similarity based on meaning";
  }

  if (semanticScore >= 0.40) {
    return "Moderate semantic similarity";
  }

  return "Low similarity";
}

// ====================================
// Confidence Level
// ====================================

function getConfidenceLevel(score) {
  if (score >= 0.75) {
    return "High";
  }

  if (score >= 0.50) {
    return "Medium";
  }

  return "Low";
}

// ====================================
// POST /api/search
// ====================================

router.post(
  "/",
  authMiddleware,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const {
        query,
        domainId,
        minSimilarity = 0
      } = req.body;

      // ------------------------------------
      // Validate Query
      // ------------------------------------

      if (!query || !query.trim()) {
        return res.status(400).json({
          message: "Search query is required"
        });
      }

      const cleanQuery = query.trim();

      // ------------------------------------
      // Get User Domains
      // ------------------------------------

      const domainQuery = {
        createdBy: req.user.userId
      };

      if (domainId) {
        domainQuery._id = domainId;
      }

      const userDomains =
        await Domain.find(domainQuery)
          .select("_id name");

      if (userDomains.length === 0) {
        return res.json({
          query: cleanQuery,
          results: [],
          stats: {
            totalCount: 0,
            timeMs: Date.now() - startTime
          }
        });
      }

      // ------------------------------------
      // Domain Map
      // ------------------------------------

      const domainMap = {};

      const domainIds =
        userDomains.map((domain) => {
          domainMap[
            domain._id.toString()
          ] = domain.name;

          return domain._id;
        });

      // ------------------------------------
      // Get Resources
      // ------------------------------------

      const resources =
        await Resource.find({
          domainId: {
            $in: domainIds
          },
          embedding: {
            $exists: true,
            $ne: []
          }
        });

      if (resources.length === 0) {
        return res.json({
          query: cleanQuery,
          results: [],
          stats: {
            totalCount: 0,
            timeMs: Date.now() - startTime
          }
        });
      }

      // ------------------------------------
      // Generate Query Embedding
      // ------------------------------------

      const queryEmbedding =
        await generateEmbedding(cleanQuery);

      // ------------------------------------
      // Threshold
      // ------------------------------------

      const userThreshold =
        parseFloat(minSimilarity) || 0;

      const finalThreshold =
        Math.max(
          userThreshold,
          0.35
        );

      // ------------------------------------
      // Query Keywords
      // ------------------------------------

      const queryWords =
        extractQueryWords(cleanQuery);

      // ====================================
      // Calculate Results
      // ====================================

      const calculatedResults =
        resources.map((resource) => {

          // --------------------------------
          // Semantic Similarity
          // --------------------------------

          const rawSimilarity =
            cosineSimilarity(
              queryEmbedding,
              resource.embedding
            );

          const semanticScore =
            Math.max(
              0,
              Math.min(
                1,
                rawSimilarity
              )
            );

          // --------------------------------
          // Keyword Coverage
          // --------------------------------

          const keywordCoverage =
            calculateKeywordCoverage(
              queryWords,
              resource.title,
              resource.content
            );

          // --------------------------------
          // Keyword Score
          // --------------------------------

          const keywordScore =
            calculateKeywordScore(
              queryWords,
              resource.title,
              resource.content
            );

          // --------------------------------
          // Exact Phrase
          // --------------------------------

          const phraseMatch =
            calculatePhraseMatch(
              cleanQuery,
              resource.title,
              resource.content
            );

          // =================================
          // Relevance Score
          // =================================

          /*
           * Semantic similarity is useful for
           * understanding meaning, but it should
           * not overpower actual topical evidence.
           *
           * 60% semantic
           * 30% keyword relevance
           * 10% exact phrase
           */

          let hybridScore =
            (
              semanticScore * 0.60
            ) +
            (
              keywordScore * 0.30
            ) +
            (
              phraseMatch * 0.10
            );

          // --------------------------------
          // Strong Keyword Boost
          // --------------------------------

          /*
           * If several important query words
           * actually occur in the resource,
           * give the resource a small relevance
           * boost.
           */

          if (
            keywordCoverage >= 0.75
          ) {
            hybridScore += 0.08;
          } else if (
            keywordCoverage >= 0.50
          ) {
            hybridScore += 0.04;
          }

          // --------------------------------
          // Cap Score
          // --------------------------------

          hybridScore =
            Math.max(
              0,
              Math.min(
                1,
                hybridScore
              )
            );

          // --------------------------------
          // Match Explanation
          // --------------------------------

          const matchReason =
            getMatchReason(
              semanticScore,
              keywordCoverage,
              keywordScore,
              phraseMatch
            );

          // --------------------------------
          // Confidence
          // --------------------------------

          const confidenceLevel =
            getConfidenceLevel(
              hybridScore
            );

          // --------------------------------
          // Return Result
          // --------------------------------

          return {
            _id: resource._id,

            domainId:
              resource.domainId,

            domainName:
              domainMap[
                resource.domainId.toString()
              ] || "Unknown Domain",

            type:
              resource.type,

            title:
              resource.title,

            content:
              resource.content,

            fileName:
              resource.fileName,

            fileUrl:
              resource.fileUrl,

            // Main relevance score
            similarity:
              hybridScore,

            // Actual cosine similarity
            semanticScore:
              semanticScore,

            // Keyword relevance
            keywordScore:
              keywordScore,

            // Percentage of important
            // query words found
            keywordCoverage:
              keywordCoverage,

            // Exact phrase
            phraseMatch:
              phraseMatch,

            // Final hybrid score
            hybridScore:
              hybridScore,

            confidenceLevel:
              confidenceLevel,

            matchReason:
              matchReason
          };
        });

      // ====================================
      // Relevance Filtering
      // ====================================

      const results =
        calculatedResults.filter(
          (item) => {

            // --------------------------------
            // Basic threshold
            // --------------------------------

            if (
              item.hybridScore <
              finalThreshold
            ) {
              return false;
            }

            // --------------------------------
            // Multi-word query protection
            // --------------------------------

            if (
              queryWords.length >= 2
            ) {

              /*
               * A result with weak keyword
               * evidence should not be accepted
               * purely because its embedding score
               * is high.
               */

              if (
                item.keywordCoverage < 0.25 &&
                item.semanticScore < 0.55
              ) {
                return false;
              }

              /*
               * If semantic similarity is only
               * moderate, require at least some
               * actual keyword evidence.
               */

              if (
                item.semanticScore < 0.50 &&
                item.keywordCoverage === 0
              ) {
                return false;
              }
            }

            return true;
          }
        );

      // ====================================
      // Sort Results
      // ====================================

      results.sort(
        (a, b) => {

          // First compare final relevance
          if (
            b.hybridScore !==
            a.hybridScore
          ) {
            return (
              b.hybridScore -
              a.hybridScore
            );
          }

          // Then keyword coverage
          return (
            b.keywordCoverage -
            a.keywordCoverage
          );
        }
      );

      // ====================================
      // Response
      // ====================================

      res.json({
        query: cleanQuery,

        results,

        stats: {
          totalCount:
            results.length,

          maxSimilarity:
            results.length > 0
              ? (
                  results[0].hybridScore *
                  100
                ).toFixed(1)
              : 0,

          timeMs:
            Date.now() -
            startTime
        }
      });

      // ====================================
      // Search Log
      // ====================================

      try {
        await SearchLog.create({
          query:
            cleanQuery,

          userId:
            req.user.userId,

          domainId:
            domainId || null,

          highestSimilarity:
            results.length > 0
              ? results[0].hybridScore
              : 0,

          resultsCount:
            results.length
        });
      } catch (logErr) {
        console.error(
          "Failed to log search:",
          logErr
        );
      }

    } catch (error) {

      console.error(
        "Semantic search error:",
        error
      );

      res.status(500).json({
        message:
          "Semantic search failed",

        error:
          error.message
      });
    }
  }
);

// ====================================
// POST /api/search/feedback
// ====================================

router.post(
  "/feedback",
  authMiddleware,
  async (req, res) => {

    try {

      const {
        query,
        feedback
      } = req.body;

      const log =
        await SearchLog.findOneAndUpdate(
          {
            query,

            userId:
              req.user.userId
          },
          {
            $set: {
              feedback
            }
          },
          {
            sort: {
              createdAt: -1
            },

            new: true
          }
        );

      res.json({
        message:
          "Feedback saved",

        log
      });

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ====================================
// GET /api/search/knowledge-gaps
// ====================================

router.get(
  "/knowledge-gaps",
  authMiddleware,
  async (req, res) => {

    try {

      const gaps =
        await SearchLog.aggregate([
          {
            $match: {
              userId:
                req.user.userId,

              $or: [
                {
                  highestSimilarity: {
                    $lt: 0.4
                  }
                },

                {
                  resultsCount: 0
                },

                {
                  feedback: -1
                }
              ]
            }
          },

          {
            $group: {
              _id:
                "$query",

              count: {
                $sum: 1
              },

              avgSimilarity: {
                $avg:
                  "$highestSimilarity"
              },

              thumbsDownCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$feedback",
                        -1
                      ]
                    },

                    1,

                    0
                  ]
                }
              }
            }
          },

          {
            $sort: {
              count: -1
            }
          },

          {
            $limit: 20
          }
        ]);

      res.json(gaps);

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ====================================
// Export Router
// ====================================

module.exports = router;