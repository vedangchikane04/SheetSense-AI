# SheetSense AI

A complete full-stack AI application allowing you to converse with your Excel spreadsheets and CSV datasets using natural language. Driven by the Google Gemini AI and Pandas, it executes data processing dynamically and safely to provide you with insights, analytics, schema summaries, and actionable tabular text responses.

## 🚀 Key Features
- **Intelligent Processing:** Translates plain English into robust Pandas code.
- **Support for Multi-Sheet & Multi-File:** Load multiple datasets and query across them instantly.
- **ChatGPT-Style UI:** Designed completely in React and TailwindCSS for a seamless, modern, intuitive experience.
- **Memory Optimal:** Code queries the data efficiently to run safely without running out of context limits or overwhelming the local resources.
- **Chat History:** Complete persistent query-by-query history tracking.

---

## 🛠 Prerequisites
- **Python 3.9+**
- **Node.js 16+**
- Google Gemini API Key

---

## ⚙️ Backend Setup (FastAPI)

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd "d:/PROJECTS/Excel Chat Analyzer/backend"
   ```

2. Setup virtual environment:
   ```bash
   python -m venv venv
   
   # Activate (Windows)
   venv\Scripts\activate
   
   # Activate (Mac/Linux)
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create `.env` file with your **Gemini API Key**:
   Create a `.env` in the `backend/` directory from `.env.example`:
   ```env
   GEMINI_API_KEY=AI_xxxxxx_YOUR_KEY_HERE
   ```

5. Run the FastAPI Server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

## 🖥 Frontend Setup (React & Vite)

1. Open a **new** terminal tab and navigate to the frontend directory:
   ```bash
   cd "d:/PROJECTS/Excel Chat Analyzer/frontend"
   ```

2. Install NPM dependencies:
   ```bash
   npm install
   ```

3. Start Vite dev server:
   ```bash
   npm run dev
   ```

4. Go to the port printed on your terminal (typically `http://localhost:5173`) and start analyzing!
