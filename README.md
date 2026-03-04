# 🍎 FreshCheck AI — Computer Vision Quality Control for Grocery Delivery

> **An AI-powered produce inspection system for dark stores and last-mile delivery centers — built to reduce refunds, improve quality control, and rebuild customer trust in grocery SKUs.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge)](https://lovable.dev/projects/933ff6fe-02c4-4d50-9a0d-cd32f7b866f1)
![TypeScript](https://img.shields.io/badge/TypeScript-86.9%25-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production_Ready-green?style=flat-square)

---

## 📌 Problem Statement

Quick-commerce platforms like Zepto, Blinkit, and Swiggy Instamart lose **₹200–350 Cr annually** in produce-related refunds. The root cause: manual quality checks at dark stores are subjective, inconsistent, and unscalable. A packer checking 300+ orders/day cannot reliably assess freshness across dozens of SKU categories — leading to spoiled items reaching customers and eroding brand trust.

## 💡 Solution — What I Built

FreshCheck AI replaces subjective human judgment with a **GPT-4o Vision-powered inspection system** that scores every produce item at the packing station in real-time. Packers simply photograph each item; the AI returns freshness and quality scores with an explanation — creating an auditable, scalable quality gate.

### Key Capabilities

| Capability | Description |
|---|---|
| 🤖 **AI Freshness Scoring** | GPT-4o Vision analyzes produce photos and returns freshness (1–10) and quality (1–10) scores with detailed descriptions |
| 📷 **Mobile-First Photo Workflow** | Camera capture + file upload with image validation (format, size), base64 conversion, and Supabase storage integration |
| 🔐 **Role-Based Access Control** | Secure auth with admin/packer/user roles — packers see only their orders, admins see everything |
| 📦 **Order Management Dashboard** | Create orders, track packing status (pending → packed), and view quality metrics per order |
| ✅ **Quality Assurance Gate** | Configurable quality thresholds — items below threshold get flagged; orders can't be finalized until reviewed |
| 🔄 **Retry & Error Recovery** | Automatic status cleanup for stuck analyses; retry logic for failed AI calls with proper UX feedback |
| 📱 **Responsive Design** | Fully responsive across mobile, tablet, and desktop — optimized for handheld use in warehouse environments |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/TypeScript)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Auth + RBAC  │  │   Packer     │  │    Packing Station        │ │
│  │ (Supabase    │  │  Dashboard   │  │  Photo Capture → Upload   │ │
│  │   Auth)      │  │  Order Cards │  │  → AI Analysis → QA Gate  │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / Supabase Client SDK
┌───────────────────────────▼─────────────────────────────────────────┐
│                       SUPABASE BACKEND                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │  Edge Function  │  │   PostgreSQL     │  │  Object Storage     │ │
│  │  analyze-image  │  │   (RLS-secured)  │  │  packing-photos     │ │
│  │  ↕ OpenAI API   │  │   orders, users, │  │  bucket with        │ │
│  │  GPT-4o Vision  │  │   photos, roles  │  │  access policies    │ │
│  └────────────────┘  └──────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Deep Dive: AI Analysis Pipeline

The core quality inspection flow is a **serverless Supabase Edge Function** that:

1. **Authenticates** the requesting user and validates RBAC permissions (packer ownership or admin)
2. **Retrieves** the image from Supabase Storage with format/size validation (JPEG, PNG, WebP; ≤15 MB)
3. **Converts** the image to base64 using Deno's memory-safe encoding (handles large warehouse images)
4. **Sends** to OpenAI GPT-4o with a structured prompt optimized for produce quality assessment
5. **Validates** the AI response with smart JSON extraction (handles markdown-wrapped responses, direct JSON, and embedded JSON)
6. **Scores** the item: freshness (1–10), quality (1–10), item name, and description — with special handling for non-produce items (returns 0 scores)
7. **Persists** results to the database and updates the UI in real-time

**Production hardening:**
- 45-second timeout with AbortController
- Comprehensive error taxonomy: auth failures, storage errors, AI errors, validation failures
- Status state machine (`pending → processing → completed/failed`) with atomic updates
- Memory-efficient base64 conversion for large images

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query |
| **Backend** | Supabase (Edge Functions, PostgreSQL, Auth, Storage) |
| **AI/ML** | OpenAI GPT-4o Vision API |
| **State Management** | TanStack React Query with optimistic updates and cache invalidation |
| **Auth** | Supabase Auth with custom RBAC via `user_roles` table |
| **Database** | PostgreSQL with 33 migrations, Row-Level Security (RLS) policies |
| **Validation** | Zod schemas, React Hook Form |

---

## 📊 Product Impact (Projected)

| Metric | Before (Manual QC) | After (FreshCheck AI) |
|---|---|---|
| **Inspection time per item** | 15–30 seconds | 3–5 seconds |
| **Consistency** | Varies by packer | 100% standardized |
| **Audit trail** | None | Full photo + score log |
| **Customer refund rate** | 8–12% on produce | Target: <3% |
| **Scalability** | Linear (more packers) | Near-zero marginal cost |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/prihu/fresh-produce-focus.git
cd fresh-produce-focus

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Add your SUPABASE_URL, SUPABASE_ANON_KEY, and OPENAI_API_KEY

# Start development server
npm run dev
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── packer/                 # Core packing workflow
│   │   ├── PackerDashboard     # Order list + creation
│   │   ├── PackingWorkflow     # Step-by-step packing flow
│   │   ├── PhotoCapture        # Camera integration
│   │   ├── PhotoUpload         # File upload to Supabase Storage
│   │   └── packing/
│   │       ├── PhotoAnalysis   # AI analysis display + retry
│   │       ├── QualityAssurance # Quality gate logic
│   │       └── FinalizePacking # Order completion flow
│   ├── layout/                 # Auth layout, navigation
│   └── ui/                     # shadcn/ui components + design tokens
├── contexts/
│   └── SecureAuthContext       # RBAC-enabled auth provider
├── hooks/                      # Camera, photo upload, analysis cleanup
├── pages/                      # Auth, Packer, PackingStation, HealthCheck
└── utils/                      # Input sanitization, security helpers

supabase/
├── functions/
│   ├── analyze-image/          # GPT-4o Vision analysis (560 LOC)
│   ├── openai-health-check/    # API connectivity monitoring
│   └── test-openai-connectivity/
└── migrations/                 # 33 SQL migrations (schema evolution)
```

---

## 🧠 Product Thinking Behind the Design

1. **Why photo-based, not barcode?** — Barcodes tell you what a product *is*, not what condition it's *in*. FreshCheck AI assesses visible quality (bruising, discoloration, wilting) that barcode systems miss entirely.

2. **Why GPT-4o and not a custom CV model?** — Speed to market. A fine-tuned ResNet/YOLO model would require 10K+ labeled images and weeks of training. GPT-4o Vision provides production-quality results immediately, with the option to distill into a smaller model as data accumulates.

3. **Why packer-centric UX?** — Dark store packers are the last quality gate before delivery. The system is designed for their workflow: fast photo capture → instant score → clear pass/fail → move to next item. No training required.

4. **Why serverless edge functions?** — Supabase Edge Functions provide sub-100ms cold starts, auto-scaling during peak hours (10 AM–2 PM), and zero infrastructure management — critical for a system that must handle 1000s of concurrent inspections.

---

## 📄 License

MIT

---

*Built by [Priyank](https://github.com/prihu) — exploring how AI can solve real-world operational problems in India's quick-commerce ecosystem.*
