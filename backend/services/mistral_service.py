from typing import Optional
import os
from mistralai.client.sdk import Mistral


def _get_client() -> Mistral:
    """Return an authenticated Mistral client."""
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise ValueError("MISTRAL_API_KEY environment variable not set")
    # Increase the timeout to handle massive LLM outputs for large tables
    return Mistral(api_key=api_key, timeout_ms=300000)  # type: ignore


def generate_pandas_code(
    query: str,
    schema_summary: str,
    chat_history: str = "",
    previous_error: Optional[str] = None,
    previous_code: Optional[str] = None,
) -> str:
    """
    Ask Mistral to translate a natural-language query into executable Pandas code.
    Returns a clean Python code string (no markdown fences).
    """
    client = _get_client()

    prompt = f"""
You are a Python Pandas expert.
I have the following datasets loaded in a dictionary called `dfs`. The keys are dataset names, and the values are their corresponding Pandas DataFrames.

Here is the schema and sample data for the loaded datasets:
{schema_summary}

Recent Chat History for Context:
{chat_history}

The user asks: "{query}"

Respond ONLY with valid, executable Python code bridging the query with the data.
Strict Rules:
1. DO NOT include explanation, conversational text, or markdown code blocks like ```python. Just plain code.
2. The datasets are available in the dictionary `dfs`. Use them exactly like `dfs['dataset_name']`.
3. IMPORTANT: `dfs` contains the COMPLETE, FULL dataset — not just the sample rows shown above. Always operate on the entire DataFrame unless the user explicitly asks for a sample or top-N rows.
4. You MUST assign the final computed answer to a variable named `result`.
5. Do NOT attempt to import libraries like os, sys, etc. `pd` (Pandas) is already imported.
6. If joining or comparing datasets, reference both properly from `dfs`.
7. If the user asks to SAVE, EXPORT, or DOWNLOAD the data to a file (Excel, PDF, or Word), you MUST use the provided `export_dataframe` function.
    - Function signature: `export_dataframe(df: pd.DataFrame, file_format: str, base_filename: str) -> str`
    - `file_format` must be one of: 'xlsx', 'pdf', 'docx', 'csv'.
    - Assign the returned link to `result`. When exporting, pass the FULL dataframe (not head()).
    - Example: `result = export_dataframe(dfs['sales'], 'xlsx', 'sales_export')`
8. Be robust with messy string data. If calculating means/sums on columns that might contain text, symbols, or ranges like "6-9" or "6–9", sanitize them first (e.g., using `str.extract(r'(\\d+)').astype(float)` or `pd.to_numeric(..., errors='coerce')`).

Example Output:
result = dfs['sales_data'].groupby('Region')['Revenue'].sum().reset_index()
"""

    if previous_error and previous_code:
        prompt += (
            f"\n\nYOUR PREVIOUS CODE:\n{previous_code}"
            f"\n\nFAILED WITH ERROR:\n{previous_error}"
            "\n\nPlease fix the code and return ONLY the corrected Python code without any explanation."
        )

    response = client.chat.complete(
        model="mistral-large-latest",
        messages=[{"role": "user", "content": prompt}],
    )

    code = response.choices[0].message.content.strip()

    # Precautionary cleanup in case of markdown formatting
    if code.startswith("```python"):
        code = code[9:]
    if code.startswith("```"):
        code = code[3:]
    if code.endswith("```"):
        code = code[:-3]

    return code.strip()


def explain_result_with_mistral(query: str, raw_result: str, chat_history: str = "") -> str:
    """
    Ask Mistral to translate raw Pandas output into a professional, human-readable answer.
    The function name is intentionally kept the same to avoid changing call sites in main.py.
    """
    import re

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        return raw_result

    # --- Extract any download link BEFORE truncating or sending to the AI ---
    # This guarantees the link is never lost due to truncation or AI reformatting.
    download_link = None
    link_match = re.search(r'\[Download[^\]]*\]\([^)]+\)', raw_result)
    if link_match:
        download_link = link_match.group(0)

    client = _get_client()

    # Build the link instruction only when a download link is present
    link_instruction = ""
    if download_link:
        link_instruction = (
            f"\n\nIMPORTANT: The following download link MUST appear VERBATIM and UNCHANGED "
            f"at the very end of your response, on its own line:\n{download_link}"
        )

    prompt = f"""
Recent Chat History for Context:
{chat_history}

Given the latest question: "{query}"
The execution of the data pipeline generated this raw output:
{raw_result}

Translate this raw result into a concise, easy-to-read, and professional answer for the user.
If it contains tabular data, format it into a clean Markdown table. NEVER truncate the table; print EVERY SINGLE ROW provided in the raw output.
Do NOT invent, alter, or omit any URLs or file links present in the raw output.
Act naturally — do not mention the raw backend generation process.{link_instruction}
"""

    response = client.chat.complete(
        model="mistral-large-latest",
        messages=[{"role": "user", "content": prompt}],
    )

    answer = response.choices[0].message.content.strip()

    # --- Safety net: if the AI dropped or corrupted the link, append it ourselves ---
    if download_link and download_link not in answer:
        answer = answer.rstrip() + f"\n\n{download_link}"

    return answer
