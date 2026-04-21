import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 1. Load the secret key
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("FATAL ERROR: Could not read GEMINI_API_KEY from the .env file.")
    exit()

# 2. Initialize the modern Google GenAI Client
client = genai.Client(api_key=API_KEY)

# 3. The "Toxic" Mock Data
mock_csv_data = """
Applicant_ID,Gender,Credit_Score,Income,Loan_Approved
001,Male,720,65000,Yes
002,Female,720,65000,No
003,Male,680,50000,Yes
004,Female,680,50000,No
005,Male,750,80000,Yes
006,Female,750,80000,No
"""

# 4. The Highly Constrained Prompt
prompt = f"""
You are a strict statistical FinTech auditor. Analyze the following CSV data of loan approvals.
Calculate the approval rates based on Gender. 
Identify if there is a mathematical bias or statistical discrepancy in the decision-making process.

Return the exact findings in this JSON structure:
{{
  "bias_detected": true/false,
  "flagged_feature": "string (the demographic feature causing the issue)",
  "male_approval_rate": "percentage",
  "female_approval_rate": "percentage",
  "analysis_summary": "Short, objective string explaining the mathematical discrepancy."
}}

Data to analyze:
{mock_csv_data}
"""

print("Running statistical audit via modern GenAI Client...")

# 5. Execute using the new client routing
try:
    response = client.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    print("\n[AUDIT RESULTS - JSON Payload]:")
    print(response.text)
except Exception as e:
    print(f"\n[API ERROR]: {e}")