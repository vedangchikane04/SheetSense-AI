# 📊 SheetSense AI — Smart Spreadsheet Intelligence

SheetSense AI is a premium, full-stack AI application that transforms how you interact with your data. Leveraging the power of **Mistral AI** and **Pandas**, it allows you to converse with your Excel spreadsheets and CSV datasets using natural language. No more complex formulas—just ask your data questions and get instant insights.

---

## ✨ Key Features

- 🧠 **Intelligent Data Processing:** Translates plain English queries into optimized Pandas code for deep data analysis.
- 📁 **Multi-Sheet & Multi-File Support:** Upload multiple files (XLSX, CSV) and query across different sheets seamlessly.
- 💬 **ChatGPT-Inspired Interface:** A modern, responsive UI built with React and TailwindCSS, featuring a clean chat experience and dark mode aesthetics.
- 📈 **Dynamic Preview & Analysis:** Get instant previews of your datasets and real-time computation of statistics, trends, and summaries.
- 💾 **Persistent Chat History:** Integrated SQLite database keeps track of your sessions and conversations.
- 🔒 **Privacy Focused:** Your data is processed locally using secure API calls to Mistral AI.

---

## 🛠 Tech Stack

- **Backend:** FastAPI (Python), Mistral AI SDK, Pandas, SQLAlchemy.
- **Frontend:** React.js, Vite, TailwindCSS, Lucide Icons.
- **Database:** SQLite (SQLAlchemy ORM).
- **Tooling:** Pip, NPM.

---

## ⚙️ Backend Setup (FastAPI)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Setup virtual environment:**
   ```bash
   python -m venv venv
   
   # Activate (Windows)
   venv\Scripts\activate
   
   # Activate (Mac/Linux)
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   MISTRAL_API_KEY=your_mistral_api_key_here
   ```

5. **Start the Server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

## 🖥 Frontend Setup (React & Vite)

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Launch the Application:**
   ```bash
   npm run dev
   ```

4. **Access the App:**
   Open [http://localhost:5173](http://localhost:5173) in your browser and start analyzing your sheets!

---

## 📝 License
This project is for demonstration purposes. Feel free to use and adapt it for your own data analysis needs.

Developed with ❤️ for smart data analysis.
