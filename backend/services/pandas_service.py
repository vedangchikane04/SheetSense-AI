import os
import io
import uuid
import pandas as pd

# Global dictionary to store dataframes safely in memory
# Structure: { "session_id": { "file_name_sheet_name": df } }
DATASETS = {}

def export_dataframe(df: pd.DataFrame, file_format: str, base_filename: str):
    os.makedirs("exports", exist_ok=True)
    file_id = str(uuid.uuid4())[:8]
    filepath = f"exports/{base_filename}_{file_id}.{file_format}"
    
    if file_format == "xlsx":
        df.to_excel(filepath, index=False)
    elif file_format == "csv":
        df.to_csv(filepath, index=False)
    elif file_format == "pdf":
        try:
            from fpdf import FPDF
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Arial", size=10)
            
            # Simple table
            col_width = pdf.w / (len(df.columns) + 1)
            row_height = pdf.font_size * 1.5
            
            # Header
            for col in df.columns:
                pdf.cell(col_width, row_height, txt=str(col), border=1)
            pdf.ln(row_height)
            
            # Data
            for _, row in df.head(100).iterrows(): # Limit for PDF
                for val in row:
                    pdf.cell(col_width, row_height, txt=str(val)[:20], border=1)
                pdf.ln(row_height)
                
            pdf.output(filepath)
        except Exception as e:
            return f"Error creating PDF: {str(e)}"
    elif file_format == "docx":
        try:
            from docx import Document
            doc = Document()
            doc.add_heading(f"{base_filename} Data Export", 0)
            
            # Sub-sample if too large for docx table
            export_df = df.head(100)
            t = doc.add_table(export_df.shape[0]+1, export_df.shape[1])
            
            # Header
            for j in range(export_df.shape[-1]):
                t.cell(0,j).text = str(export_df.columns[j])

            # Data
            for i in range(export_df.shape[0]):
                for j in range(export_df.shape[-1]):
                    t.cell(i+1,j).text = str(export_df.values[i,j])
            
            doc.save(filepath)
        except Exception as e:
            return f"Error creating Word doc: {str(e)}"
    else:
        return f"Error: Unsupported format {file_format}"
        
    # Return a markdown link to download the file
    return f"[Download {file_format.upper()} File](/{filepath})"

def process_upload(file_contents: bytes, filename: str, session_id: str):
    if session_id not in DATASETS:
        DATASETS[session_id] = {}
        
    session_datasets = DATASETS[session_id]
    
    # Save file to disk persistently
    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", filename)
    with open(file_path, "wb") as f:
        f.write(file_contents)
    
    filename_lower = filename.lower()
    if filename_lower.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(file_contents), encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_contents), encoding='cp1252')
            
        dataset_name = filename.rsplit(".", 1)[0]
        session_datasets[dataset_name] = df
        return [dataset_name]
        
    elif filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
        xls = pd.read_excel(io.BytesIO(file_contents), sheet_name=None)
        dataset_names = []
        for sheet_name, df in xls.items():
            dataset_name = f"{filename.rsplit('.', 1)[0]}_{sheet_name}"
            session_datasets[dataset_name] = df
            dataset_names.append(dataset_name)
        return dataset_names
    else:
        raise ValueError("Unsupported file format. Only CSV and Excel files are allowed.")

def get_global_files():
    os.makedirs("uploads", exist_ok=True)
    files = os.listdir("uploads")
    # Return valid only
    return [f for f in files if f.endswith(".csv") or f.endswith(".xlsx") or f.endswith(".xls")]

def use_global_file(filename: str, session_id: str):
    file_path = os.path.join("uploads", filename)
    if not os.path.exists(file_path):
        raise ValueError("File not found")
    
    with open(file_path, "rb") as f:
        contents = f.read()
        
    return process_upload(contents, filename, session_id)

def get_schema_summary(session_id: str):
    if session_id not in DATASETS or not DATASETS[session_id]:
        return "No datasets available."
        
    summary = []
    for name, df in DATASETS[session_id].items():
        columns = df.dtypes.to_dict()
        col_str = ", ".join([f"'{col}': {dtype}" for col, dtype in columns.items()])
        sample = df.head(5).to_dict(orient="records")
        summary.append(f"Dataset Name: `{name}`\nColumns: {col_str}\nSample Data: {sample}\n")
        
    return "\n".join(summary)

def execute_pandas_code(code: str, session_id: str):
    # Security: Stop execution of arbitrary unsafe commands
    disallowed = ["import os", "import sys", "subprocess", "eval(", "open("]
    if any(kw in code for kw in disallowed):
        return "Error: Unsafe code detected. Execution blocked."
        
    if session_id not in DATASETS:
        return "Error: No data available for this session."
        
    local_env = {
        "pd": pd,
        "dfs": DATASETS[session_id], # dict of dataframes
        "export_dataframe": export_dataframe
    }
    
    try:
        # We enforce code to provide 'result'
        exec(code, {"__builtins__": {}}, local_env)
        if 'result' in local_env:
            res = local_env['result']
            if isinstance(res, pd.DataFrame):
                # Restrict returned rows to prevent memory overload in response
                return res.head(100).to_json(orient="records")
            elif isinstance(res, pd.Series):
                return res.head(100).to_json()
            else:
                return str(res)
        else:
            return "Error: The AI code did not define a 'result' variable."
    except Exception as e:
        return f"Execution Error: {str(e)}"
