const mongoose = require('mongoose');
const { generateEmbedding } = require('./services/embeddingService');
const Resource = require('./models/Resource');

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/semanticsearch').then(async () => {
  console.log('Connected to MongoDB');

  const resources = await Resource.find({ embedding: { $exists: true, $ne: [] } });
  console.log('Total resources with embeddings:', resources.length);

  if (resources.length === 0) {
    console.log('NO RESOURCES FOUND! The PDF may not have been uploaded correctly.');
    process.exit(0);
  }

  for (const r of resources) {
    const embLen = r.embedding ? r.embedding.length : 0;
    const contentLen = r.content ? r.content.length : 0;
    const sum = r.embedding ? r.embedding.reduce((a, b) => a + Math.abs(b), 0) : 0;
    console.log(`Resource: '${r.title.slice(0, 60)}' | type=${r.type} | emb_dim=${embLen} | content_len=${contentLen} | emb_sum=${sum.toFixed(4)}`);
    // Show first 100 chars of content
    console.log(`  Content preview: "${(r.content || '').slice(0, 120).replace(/\n/g, ' ')}"`);
  }

  const queries = ['mark in java', 'mark in python', 'java', 'python', 'mark'];
  for (const q of queries) {
    const qEmb = await generateEmbedding(q);
    console.log('\n--- Query: "' + q + '" ---');
    const scores = resources.map(r => ({
      title: r.title.slice(0, 50),
      sim: cosineSimilarity(qEmb, r.embedding)
    })).sort((a, b) => b.sim - a.sim);
    for (const s of scores.slice(0, 5)) {
      console.log('  ' + s.title + ': ' + (s.sim * 100).toFixed(2) + '%');
    }
  }

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
