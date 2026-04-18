import os
import google.generativeai as genai

def generate_pandas_code(query: str, schema_summary: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
You are a Python Pandas expert.
I have the following datasets loaded in a dictionary called `dfs`. The keys are dataset names, and the values are their corresponding Pandas DataFrames.

Here is the schema and sample data for the loaded datasets:
{schema_summary}

The user asks: "{query}"

Respond ONLY with valid, executable Python code bridging the query with the data. 
Strict Rules:
1. DO NOT include explanation, conversational text, or markdown code blocks like ```python. Just plain code.
2. The datasets are available in the dictionary `dfs`. Use them exactly like `dfs['dataset_name']`.
3. You MUST assign the final computed answer to a variable named `result`.
4. Do NOT attempt to import libraries like os, sys, etc. `pd` (Pandas) is already imported.
5. If joining or comparing datasets, reference both properly from `dfs`.
6. If the user asks to SAVE, EXPORT, or DOWNLOAD the data to a file (Excel, PDF, or Word), you MUST use the provided `export_dataframe` function.
    - Function signature: `export_dataframe(df: pd.DataFrame, file_format: str, base_filename: str) -> str`
    - `file_format` must be one of: 'xlsx', 'pdf', 'docx', 'csv'.
    - Assign the returned link to `result`. 
    - Example: `result = export_dataframe(dfs['sales'].head(100), 'xlsx', 'sales_export')`

Example Output:
result = dfs['sales_data'].groupby('Region')['Revenue'].sum().reset_index()
"""
    
    response = model.generate_content(prompt)
    code = response.text.strip()
    
    # Precautionary cleanup in case of markdown formatting
    if code.startswith("```python"):
        code = code[9:]
    if code.startswith("```"):
        code = code[3:]
    if code.endswith("```"):
        code = code[:-3]
        
    return code.strip()

def explain_result_with_gemini(query: str, raw_result: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return raw_result
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
Given the question: "{query}"
The execution of the data pipeline generated this raw output: {raw_result[:2500]} 

Translate this raw result into a concise, easy-to-read, and professional answer for the user.
If it is a list of data, present it nicely (e.g., bulleted list or markdown table if small enough).
Act naturally — do not mention the raw backend generation process.
"""
    response = model.generate_content(prompt)
    return response.text.strip()
