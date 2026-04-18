import os
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
from dotenv import load_dotenv

from database import get_db, ChatMessage
from services.pandas_service import process_upload, get_schema_summary, execute_pandas_code, DATASETS, get_global_files, use_global_file
from services.gemini_service import generate_pandas_code, explain_result_with_gemini

load_dotenv()

# Ensure exports directory exists
os.makedirs("exports", exist_ok=True)

app = FastAPI(title="SheetSense AI")

app.mount("/exports", StaticFiles(directory="exports"), name="exports")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_file(files: List[UploadFile] = File(...), session_id: str = Form(...)):
    parsed_datasets = []
    try:
        for file in files:
            contents = await file.read()
            names = process_upload(contents, file.filename, session_id)
            parsed_datasets.extend(names)
        return {"message": "Files uploaded successfully", "datasets": parsed_datasets}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/query")
async def process_query(session_id: str = Form(...), query: str = Form(...), db: Session = Depends(get_db)):
    # Persist the user's inquiry
    user_msg = ChatMessage(session_id=session_id, role="user", content=query)
    db.add(user_msg)
    db.commit()
    
    schema = get_schema_summary(session_id)
    if not schema or schema == "No datasets available.":
        error_msg = "Please upload an Excel or CSV file first."
        ai_msg = ChatMessage(session_id=session_id, role="assistant", content=error_msg)
        db.add(ai_msg)
        db.commit()
        return {"response": error_msg}
        
    try:
        # Step 1: LLM translates query to Pandas code
        code = generate_pandas_code(query, schema)
        
        # Step 2: Safely execute code
        raw_result = execute_pandas_code(code, session_id)
        
        # Step 3: Check execution errors or proceed to natural language formulation
        if str(raw_result).startswith("Error:") or str(raw_result).startswith("Execution Error:"):
            final_response = f"I encountered an error executing exactly what was needed:\n\n`{raw_result}`"
        else:
            final_response = explain_result_with_gemini(query, raw_result)
            
        ai_msg = ChatMessage(session_id=session_id, role="assistant", content=final_response)
        db.add(ai_msg)
        db.commit()
        
        return {"response": final_response}
        
    except Exception as e:
        error_msg = f"An unexpected error occurred: {str(e)}"
        ai_msg = ChatMessage(session_id=session_id, role="assistant", content=error_msg)
        db.add(ai_msg)
        db.commit()
        return {"response": error_msg}

@app.get("/history")
def get_history(session_id: str, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp).all()
    return [{"role": msg.role, "content": msg.content, "timestamp": msg.timestamp} for msg in messages]

@app.get("/sessions")
def get_previous_sessions(db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).order_by(ChatMessage.timestamp).all()
    sessions_dict = {}
    for msg in messages:
        if msg.session_id not in sessions_dict:
            title = msg.content if msg.role == 'user' else "New Session"
            if len(title) > 40:
                title = title[:40] + "..."
            sessions_dict[msg.session_id] = {
                "session_id": msg.session_id,
                "title": title,
                "timestamp": msg.timestamp
            }
        else:
            sessions_dict[msg.session_id]["timestamp"] = msg.timestamp
            
    sorted_sessions = sorted(sessions_dict.values(), key=lambda x: x["timestamp"], reverse=True)
    return sorted_sessions

@app.delete("/session/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.commit()
    # Note: we might also remove datasets from memory, but it's optional.
    if session_id in DATASETS:
        del DATASETS[session_id]
    return {"message": "Session deleted"}

@app.get("/files")
def get_files(session_id: str):
    if session_id in DATASETS:
        return {"datasets": list(DATASETS[session_id].keys())}
    return {"datasets": []}

@app.get("/global-files")
def api_get_global_files():
    try:
        files = get_global_files()
        return {"files": files}
    except Exception as e:
        return {"files": []}

@app.post("/use-global-file")
def api_use_global_file(filename: str = Form(...), session_id: str = Form(...)):
    try:
        names = use_global_file(filename, session_id)
        return {"message": "Global file loaded successfully", "datasets": names}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
