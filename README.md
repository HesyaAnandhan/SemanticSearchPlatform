# Semantic Search Platform ✦

An enterprise-grade, neural semantic search platform that understands meaning, context, and intent rather than relying solely on exact keyword matches. Powered by Hugging Face Transformer embeddings (`Xenova/all-MiniLM-L6-v2`), Node.js, Express, MongoDB, and React with Vite.

---

## ✨ Features

- **🧠 Neural Semantic Understanding**: Converts text and document queries into 384-dimensional dense vectors and ranks results using cosine similarity.
- **◈ Knowledge Domains**: Organize disparate documentation, FAQs, and files into discrete, manageable domains (e.g. Engineering, HR, Legal, Customer Support).
- **📄 Multi-Format Resource Ingestion**:
  - **FAQs**: Question & Answer pairs.
  - **Text / Notes**: Articles, guidelines, and manuals.
  - **PDF Documents**: Automatic server-side text extraction using `pdf-parse`, chunking, vector embedding generation, and static file download access.
- **⌕ Dual Search Modes**:
  - **Global Semantic Discovery**: Search across all knowledge domains simultaneously, with similarity threshold controls and suggestion prompts.
  - **Scoped Domain Search**: Search specifically within a chosen knowledge domain.
- **▤ Master Resource Catalog**: Central table to view, filter by type (FAQ, Text, PDF), filter by domain, search, and manage all indexed knowledge.
- **✏ Full CRUD Capabilities**:
  - Create, edit, and delete Knowledge Domains (with cascading cleanup of resources and files).
  - Create, view/expand, edit, and delete Knowledge Resources (with real-time embedding recalculation).
- **⚙ System Diagnostics & Maintenance**:
  - Inspect model dimensions and vector metric.
  - Check database status.
  - One-click **Regenerate All Embeddings** to recompute dense vectors for existing resources.
  - Manage user profile and password credentials.
- **🔔 Real-Time Feedback**: Interactive toasts, live activity logging in `localStorage`, and responsive layout for mobile and desktop screens.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 8, Vanilla CSS (Glassmorphism & Micro-animations)
- **Backend**: Node.js, Express 5, Mongoose 9, Multer
- **AI & NLP**: `@xenova/transformers` (`all-MiniLM-L6-v2` ONNX pipeline)
- **Document Processing**: `pdf-parse`
- **Security**: JWT Authentication, bcryptjs password hashing

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** (running locally on `mongodb://127.0.0.1:27017` or via MongoDB Atlas)

### 2. Environment Variables
Create or verify `server/.env`:
```env
MONGO_URI=mongodb://127.0.0.1:27017/semanticsearch
PORT=5000
JWT_SECRET=semantic_search_platform_secret_2026
```

### 3. Installation
Install all dependencies for root, server, and client:
```bash
npm run install:all
```
Or individually:
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### 4. Running Locally
Run the server and client in separate terminals:

**Terminal 1 (Backend):**
```bash
cd server
npm start
# or npm run dev for hot-reload
```
Backend runs at `http://localhost:5000`.

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```
Client runs at `http://localhost:5173`.

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new account
- `POST /api/auth/login` - Authenticate user & retrieve JWT
- `GET /api/auth/me` - Retrieve authenticated user profile
- `PUT /api/auth/profile` - Update profile name and change password

### Knowledge Domains
- `GET /api/domains` - List user domains with resource counts
- `GET /api/domains/:id` - Get domain details
- `POST /api/domains` - Create a new domain
- `PUT /api/domains/:id` - Update domain name & description
- `DELETE /api/domains/:id` - Delete domain & cascade delete its resources and files

### Resources
- `GET /api/resources/user/all` - List all resources across all user domains
- `GET /api/resources/:domainId` - List resources within a domain
- `POST /api/resources/:domainId` - Add an FAQ or text resource
- `POST /api/resources/upload-pdf` - Upload and parse PDF document
- `PUT /api/resources/:domainId/:resourceId` - Update resource & recalculate embedding
- `DELETE /api/resources/:domainId/:resourceId` - Delete resource & associated file
- `POST /api/resources/generate-embeddings` - Recompute embeddings for all resources

### Semantic Search
- `POST /api/search` - Search by meaning with optional `domainId` filter and `minSimilarity` threshold
