import os
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
from dotenv import load_dotenv

from database import get_db, ChatMessage
from services.pandas_service import process_upload, get_schema_summary, execute_pandas_code, DATASETS, get_global_files, use_global_file
from services.mistral_service import generate_pandas_code, explain_result_with_mistral

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
    file_names = []
    try:
        for file in files:
            contents = await file.read()
            names = process_upload(contents, file.filename, session_id)
            parsed_datasets.extend(names)
            file_names.append(file.filename)
        return {"message": "Files uploaded successfully", "datasets": file_names, "parsed_sheets": parsed_datasets}
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
        # Fetch recent history for context
        history_records = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp).all()
        recent_history = []
        # exclude the last message which is the current user query we just added
        for msg in history_records[-7:-1]: 
            role_label = "User" if msg.role == "user" else "Assistant"
            recent_history.append(f"{role_label}: {msg.content}")
        history_text = "\n".join(recent_history)
        if not history_text:
            history_text = "No previous context."

        # Step 1: LLM translates query to Pandas code
        code = generate_pandas_code(query, schema, history_text)
        
        # Step 2: Safely execute code
        raw_result = execute_pandas_code(code, session_id)
        
        # Auto-Correction: If the AI generated code throws a Pandas exception, feed the error back and retry once
        if str(raw_result).startswith("Error:") or str(raw_result).startswith("Execution Error:"):
            code = generate_pandas_code(query, schema, history_text, previous_error=str(raw_result), previous_code=code)
            raw_result = execute_pandas_code(code, session_id)
        
        # Step 3: Check execution errors or proceed to natural language formulation
        if str(raw_result).startswith("Error:") or str(raw_result).startswith("Execution Error:"):
            final_response = f"I encountered an error executing exactly what was needed:\n\n`{raw_result}`"
        else:
            final_response = explain_result_with_mistral(query, raw_result, history_text)
            
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
    from services.pandas_service import SESSION_FILES
    if session_id in SESSION_FILES:
        return {"datasets": list(SESSION_FILES[session_id])}
    return {"datasets": []}

@app.get("/dataset-preview")
def dataset_preview(session_id: str, dataset_name: str, sheet_name: str = None):
    if session_id in DATASETS:
        # dataset_name is the actual filename (e.g. sales.xlsx)
        base_name = dataset_name.rsplit(".", 1)[0]
        
        # Find all dataframes that belong to this file
        sheets = []
        for key in DATASETS[session_id].keys():
            if key == base_name or key.startswith(f"{base_name}_"):
                sheets.append(key)
                
        if not sheets:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        current_sheet = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
        df = DATASETS[session_id][current_sheet]
        
        return {
            "sheets": sheets,
            "current_sheet": current_sheet,
            "columns": list(df.columns),
            "data": df.fillna("").to_dict(orient="records")
        }
    raise HTTPException(status_code=404, detail="Dataset not found")

@app.get("/global-file-preview")
def global_file_preview(filename: str, sheet_name: str = None):
    file_path = os.path.join("uploads", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        import pandas as pd
        if filename.lower().endswith(".csv"):
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='cp1252')
            sheets = [filename]
            current_sheet = filename
        else:
            xl = pd.ExcelFile(file_path)
            sheets = xl.sheet_names
            if sheet_name and sheet_name in sheets:
                current_sheet = sheet_name
            else:
                current_sheet = sheets[0]
            df = xl.parse(current_sheet)
            xl.close()
            
        return {
            "sheets": sheets,
            "current_sheet": current_sheet,
            "columns": list(df.columns),
            "data": df.fillna("").to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

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
        use_global_file(filename, session_id)
        return {"message": "Global file loaded successfully", "datasets": [filename]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/global-file/{filename}")
def delete_global_file(filename: str):
    import os
    file_path = os.path.join("uploads", filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "File deleted successfully"}
    raise HTTPException(status_code=404, detail="File not found")

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SaveDatasetRequest(BaseModel):
    session_id: Optional[str] = None
    dataset_name: Optional[str] = None
    filename: Optional[str] = None
    sheet_name: Optional[str] = None
    data: List[Dict[str, Any]]

@app.post("/save-dataset")
def save_dataset(req: SaveDatasetRequest):
    import pandas as pd
    df = pd.DataFrame(req.data)
    
    if req.session_id and req.dataset_name:
        if req.session_id in DATASETS and req.dataset_name in DATASETS[req.session_id]:
            DATASETS[req.session_id][req.dataset_name] = df
            return {"message": "Active dataset updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Active dataset not found")
            
    elif req.filename:
        file_path = os.path.join("uploads", req.filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Global file not found")
            
        if req.filename.lower().endswith(".csv"):
            df.to_csv(file_path, index=False)
        else:
            try:
                with pd.ExcelWriter(file_path, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                    df.to_excel(writer, sheet_name=req.sheet_name or "Sheet1", index=False)
            except Exception:
                df.to_excel(file_path, sheet_name=req.sheet_name or "Sheet1", index=False)
            
        return {"message": "File updated successfully"}
        
    raise HTTPException(status_code=400, detail="Must provide session/dataset or filename")

