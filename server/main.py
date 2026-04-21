import os
import json
import io
import base64
from datetime import datetime
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

load_dotenv()
app = FastAPI()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def bin_if_continuous(df, col_name):
    if pd.api.types.is_numeric_dtype(df[col_name]) and df[col_name].nunique() > 5:
        median_val = df[col_name].median()
        return df[col_name].apply(lambda x: f"High {col_name}" if x >= median_val else f"Low {col_name}")
    return df[col_name].astype(str)

@app.post("/api/audit")
async def run_audit(
    file: UploadFile = File(...),
    protected_class: str = Form(...),
    protected_class_2: str = Form(""),
    decision_col: str = Form(...)
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # 1. PRIVACY SHIELD
        pii_keywords = ['id', 'name', 'email', 'phone', 'ssn', 'applicant_id']
        cols_to_drop = [col for col in df.columns if col.lower() in pii_keywords]
        df_clean = df.drop(columns=cols_to_drop)

        total_records = len(df_clean)
        
        # 2. INTERSECTIONAL GROUP DISCOVERY
        target_col = protected_class
        target_display_name = protected_class
        
        if protected_class_2 and protected_class_2 != "none":
            col1_binned = bin_if_continuous(df_clean, protected_class)
            col2_binned = bin_if_continuous(df_clean, protected_class_2)
            df_clean['Intersectional_Class'] = col1_binned + " & " + col2_binned
            target_col = 'Intersectional_Class'
            target_display_name = f"{protected_class} × {protected_class_2}"

        decisions = df_clean[decision_col].dropna().unique()
        positive_outcome = decisions[0] 
        pos_keywords = ['yes', '1', '1.0', 'true', 'approved', 'good', 'granted', 'y', 'accepted', 'hired']
        for d in decisions:
            if str(d).lower() in pos_keywords:
                positive_outcome = d
                break

        groups = df_clean[target_col].dropna().unique()
        if len(groups) < 2:
            return {"error": f"The column '{target_col}' needs at least 2 distinct groups to compare."}

        group_stats = []
        for g in groups:
            g_total = len(df_clean[df_clean[target_col] == g])
            g_approved = len(df_clean[(df_clean[target_col] == g) & (df_clean[decision_col] == positive_outcome)])
            g_rate = (g_approved / g_total) if g_total > 0 else 0
            group_stats.append({"name": g, "rate": g_rate, "total": g_total})

        # 3. BEST VS WORST ENGINE
        group_stats.sort(key=lambda x: x["rate"], reverse=True)
        group_a = group_stats[0]  
        group_b = group_stats[-1] 

        group_a_name, group_a_rate, group_a_total = group_a["name"], group_a["rate"], group_a["total"]
        group_b_name, group_b_rate, group_b_total = group_b["name"], group_b["rate"], group_b["total"]

        dir_ratio = (group_b_rate / group_a_rate) if group_a_rate > 0 else 0
        spd_value = group_b_rate - group_a_rate
        
        # Calculate strict deterministic mitigation target to stop LLM hallucinations
        target_midpoint = ((group_a_rate + group_b_rate) / 2) * 100

        # 4. PROXY DISCRIMINATION RADAR
        df_numeric = df_clean.copy()
        for col in df_numeric.columns:
            if not pd.api.types.is_numeric_dtype(df_numeric[col]):
                df_numeric[col] = pd.factorize(df_numeric[col])[0]
        
        corr_matrix = df_numeric.corr()
        proxies_detected = []
        
        if protected_class in corr_matrix.columns:
            correlations = corr_matrix[protected_class].drop(labels=[protected_class, decision_col], errors='ignore')
            for col, corr_val in correlations.items():
                if abs(corr_val) > 0.5:
                    proxies_detected.append(f"{col} (Correlation: {corr_val:.2f})")

        proxy_string = ", ".join(proxies_detected) if proxies_detected else "None detected."

        if dir_ratio < 0.80:
            calculated_severity = "Critical"
        elif abs(spd_value) > 0.10 or proxies_detected:
            calculated_severity = "Warning"
        else:
            calculated_severity = "Pass"

        # 5. THE REWEIGHTING ENGINE
        weights = []
        for index, row in df_clean.iterrows():
            g = row[target_col]
            o = row[decision_col]
            
            count_g = len(df_clean[df_clean[target_col] == g])
            count_o = len(df_clean[df_clean[decision_col] == o])
            count_g_o = len(df_clean[(df_clean[target_col] == g) & (df_clean[decision_col] == o)])
            
            if count_g_o == 0:
                weight = 1.0 
            else:
                expected = (count_g * count_o) / total_records
                weight = expected / count_g_o
                
            weights.append(round(weight, 4))
            
        df_clean['Fairness_Weight'] = weights
        reweighted_csv_string = df_clean.to_csv(index=False)

        weight_a_total = df_clean[df_clean[target_col] == group_a_name]['Fairness_Weight'].sum()
        weight_a_approved = df_clean[(df_clean[target_col] == group_a_name) & (df_clean[decision_col] == positive_outcome)]['Fairness_Weight'].sum()
        group_a_rate_after = (weight_a_approved / weight_a_total) if weight_a_total > 0 else 0

        weight_b_total = df_clean[df_clean[target_col] == group_b_name]['Fairness_Weight'].sum()
        weight_b_approved = df_clean[(df_clean[target_col] == group_b_name) & (df_clean[decision_col] == positive_outcome)]['Fairness_Weight'].sum()
        group_b_rate_after = (weight_b_approved / weight_b_total) if weight_b_total > 0 else 0

        # 6. REGULATORY AI PROMPT
        prompt = f"""
        You are a FinTech compliance officer. 
        Protected Class Evaluated: {target_display_name}
        Most Privileged ({group_a_name}): {group_a_rate * 100:.2f}%
        Most Disadvantaged ({group_b_name}): {group_b_rate * 100:.2f}%
        DIR: {dir_ratio:.2f}
        SPD: {abs(spd_value):.2f}
        Proxies: {proxy_string}
        
        SYSTEM DIRECTIVES: 
        1. The severity level is "{calculated_severity}". You MUST use exactly this string for 'overall_severity'.
        2. If you mention a target parity rate in your mitigation steps, you MUST use the exact deterministic value of {target_midpoint:.2f}%. Do not invent other numbers.
        
        Write a Regulatory Analysis summarizing the metrics (mentioning ECOA/GDPR if relevant), and provide a 2-step actionable Mitigation Plan.
        CRITICAL: The analysis summary MUST be a maximum of 3 crisp sentences. Do not use negative numbers for SPD.

        Return EXACTLY this JSON structure:
        {{
          "overall_severity": "{calculated_severity}",
          "flagged_feature": "{target_display_name}",
          "all_groups": {json.dumps([{"name": g["name"], "rate": g["rate"]} for g in group_stats])},
          "group_a_approval": "{group_a_rate * 100:.2f}",
          "group_b_approval": "{group_b_rate * 100:.2f}",
          "group_a_name": "{group_a_name}",
          "group_b_name": "{group_b_name}",
          "group_a_approval_after": "{group_a_rate_after * 100:.2f}",
          "group_b_approval_after": "{group_b_rate_after * 100:.2f}",
          "metrics": {{
            "disparate_impact_ratio": "{dir_ratio:.2f}",
            "statistical_parity": "{abs(spd_value):.2f}"
          }},
          "proxy_warnings": "{proxy_string}",
          "analysis_summary": "[Insert your concise analysis here]",
          "mitigation_plan": ["[Insert step 1 here]", "[Insert step 2 here]"]
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        final_payload = json.loads(response.text)
        final_payload["reweighted_csv"] = reweighted_csv_string

        # 7. THE PDF COMPLIANCE GENERATOR
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        Story = []

        Story.append(Paragraph(f"AgentX Automated Fairness Audit", styles['Title']))
        Story.append(Spacer(1, 12))
        Story.append(Paragraph(f"<b>Audit Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        Story.append(Paragraph(f"<b>Dataset Analyzed:</b> {file.filename}", styles['Normal']))
        Story.append(Spacer(1, 12))
        
        Story.append(Paragraph("1. Audit Summary", styles['Heading2']))
        Story.append(Paragraph(f"<b>Severity Level:</b> {final_payload['overall_severity']}", styles['Normal']))
        Story.append(Paragraph(f"<b>Evaluated Target:</b> {final_payload['flagged_feature']}", styles['Normal']))
        Story.append(Paragraph(f"<b>Disparate Impact Ratio (DIR):</b> {final_payload['metrics']['disparate_impact_ratio']} (Target: > 0.80)", styles['Normal']))
        Story.append(Paragraph(f"<b>Statistical Parity Gap:</b> {final_payload['metrics']['statistical_parity']}", styles['Normal']))
        if proxies_detected:
            Story.append(Paragraph(f"<b>⚠️ Proxy Warnings:</b> {proxy_string}", styles['Normal']))
        Story.append(Spacer(1, 12))

        # NEW: Full Intersectional Ranking Table for PDF
        Story.append(Paragraph("Full Intersectional Ranking", styles['Heading3']))
        
        table_data = [["Group", "Approval Rate", "Status"]]
        for idx, g in enumerate(group_stats):
            rate_pct = g["rate"]
            rate_str = f"{rate_pct * 100:.2f}%"
            
            # Determine Status string
            if idx == 0:
                status = "Privileged"
            elif idx == len(group_stats) - 1:
                status = "Most Disadvantaged" # Removed the ✗
            elif rate_pct < (group_stats[0]["rate"] * 0.8): 
                status = "Warning" # Removed the ⚠
            else:
                status = "-"
                
            table_data.append([g["name"], rate_str, status])

        # Style the Table
        t = Table(table_data, colWidths=[200, 100, 150])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey)
        ]))
        Story.append(t)
        Story.append(Spacer(1, 15))

        Story.append(Paragraph("2. Regulatory Analysis", styles['Heading2']))
        Story.append(Paragraph(final_payload['analysis_summary'], styles['Normal']))
        Story.append(Spacer(1, 12))

        Story.append(Paragraph("3. Recommended Mitigation Plan", styles['Heading2']))
        for idx, step in enumerate(final_payload['mitigation_plan']):
            Story.append(Paragraph(f"Step {idx + 1}: {step}", styles['Normal']))
            Story.append(Spacer(1, 6))

        doc.build(Story)
        
        pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode('utf-8')
        final_payload["pdf_report"] = pdf_base64
        
        return final_payload
        
    except Exception as e:
        return {"error": str(e)}