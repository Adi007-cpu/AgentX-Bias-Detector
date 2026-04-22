# AgentX: Automated Fairness & Bias Audit Engine ⚖️

🚀 **[View Live Demo](https://agent-x-bias-detector.vercel.app/)**

## Overview
AgentX is a full-stack compliance and fairness auditing tool designed to detect bias in tabular datasets (such as loan approvals or hiring decisions). 

Rather than relying purely on LLM interpretation, AgentX employs a strict, deterministic statistical approach. It calculates real-world metrics—like Disparate Impact Ratio (DIR), Statistical Parity Gap (SPD), and Pearson correlation matrices—*before* securely feeding those grounded facts into Google's Gemini model. This ensures the generated regulatory reports and mitigation plans are rooted in mathematical reality, preventing AI hallucinations.

## Key Features
* **Privacy Shield:** Automatically detects and drops PII (Personally Identifiable Information) before analysis.
* **Intersectional Group Discovery:** Combines continuous and categorical protected classes to find hidden biases.
* **Proxy Discrimination Radar:** Scans the entire dataset for seemingly neutral variables that heavily correlate with protected classes.
* **The Reweighting Engine:** Calculates fairness weights to mathematically balance the dataset, offering a downloadable, mitigated CSV.
* **Regulatory AI Compliance:** Uses Gemini 2.5 Flash Lite to generate a maximum 3-sentence executive summary and an actionable 2-step mitigation plan.
* **Automated PDF Generation:** Compiles the statistical findings and LLM analysis into a clean, downloadable ReportLab PDF.

## Tech Stack
**Frontend:**
* React (Vite)
* Tailwind CSS
* Hosted on **Vercel**

**Backend:**
* Python (FastAPI)
* Pandas & NumPy (Data Processing & Statistics)
* ReportLab (PDF Generation)
* Hosted on **Render**

**AI Engine:**
* Google GenAI SDK (Gemini 2.5 Flash Lite)

## Local Installation & Setup

1. **Clone the repository:**
    git clone https://github.com/Adi007-cpu/AgentX-Bias-Detector.git
    cd AgentX-Bias-Detector

2. **Start the FastAPI Backend:**
    cd server
    python3 -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    pip install -r requirements.txt

    *Create a .env file in the server directory and add your Google GenAI key:*
    GEMINI_API_KEY=your_api_key_here

    uvicorn main:app --reload

3. **Start the React Frontend:**
    *Open a new terminal window.*
    cd client
    npm install
    npm run dev
