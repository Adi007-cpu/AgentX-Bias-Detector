import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function App() {
  const [file, setFile] = useState(null)
  const [auditData, setAuditData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  
  const [headers, setHeaders] = useState([])
  const [protectedClass, setProtectedClass] = useState('')
  const [protectedClass2, setProtectedClass2] = useState('none')
  const [decisionCol, setDecisionCol] = useState('')

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0]
    setFile(selectedFile)
    setAuditData(null)
    setErrorMsg(null)
    setHeaders([])
    setProtectedClass('')
    setProtectedClass2('none')
    setDecisionCol('')

    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result
        const firstLine = text.split('\n')[0]
        const cols = firstLine.split(',').map(col => col.trim().replace(/^"|"$/g, ''))
        setHeaders(cols)
      }
      reader.readAsText(selectedFile)
    }
  }

  const runAudit = async () => {
    if (!file) {
      setErrorMsg("Please select a CSV file first.")
      return
    }
    if (!protectedClass || !decisionCol) {
      setErrorMsg("Please select Primary Protected Class and Decision Column.")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("protected_class", protectedClass)
    formData.append("protected_class_2", protectedClass2)
    formData.append("decision_col", decisionCol)

    try {
      const response = await fetch('https://agentx-backend-1463.onrender.com/api/audit', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (data.error) {
        setErrorMsg(data.error)
      } else {
        setAuditData(data)
      }
    } catch (error) {
      console.error("Connection failed:", error)
      setErrorMsg("Failed to connect to AgentX server. Is FastAPI running?")
    }
    
    setLoading(false)
  }

  const downloadCSV = () => {
    if (!auditData || !auditData.reweighted_csv) return;
    const blob = new Blob([auditData.reweighted_csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AgentX_Fairness_Reweighted.csv';
    a.click();
  }

  // NEW: Decode and trigger the PDF download
  const downloadPDF = () => {
    if (!auditData || !auditData.pdf_report) return;
    const linkSource = `data:application/pdf;base64,${auditData.pdf_report}`;
    const downloadLink = document.createElement("a");
    const fileName = "AgentX_Compliance_Report.pdf";
    downloadLink.href = linkSource;
    downloadLink.download = fileName;
    downloadLink.click();
  }

  const chartData = auditData ? [
    {
      name: '1. Original',
      [auditData.group_a_name || 'Group A']: parseFloat(auditData.group_a_approval),
      [auditData.group_b_name || 'Group B']: parseFloat(auditData.group_b_approval),
    },
    {
      name: '2. Reweighted',
      [auditData.group_a_name || 'Group A']: parseFloat(auditData.group_a_approval_after),
      [auditData.group_b_name || 'Group B']: parseFloat(auditData.group_b_approval_after),
    }
  ] : []

  let spdAbs = "0.00";
  let spdGapText = "";
  if (auditData && auditData.metrics) {
    const spdFloat = parseFloat(auditData.metrics.statistical_parity);
    spdAbs = Math.abs(spdFloat).toFixed(2);
    
    if (spdAbs > 0) {
      spdGapText = `↓ ${(spdAbs * 100).toFixed(0)}% gap against ${auditData.group_b_name || 'Group B'}`;
    } else {
      spdGapText = `Perfect Parity`;
    }
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AgentX Bias Detector Core</h1>
      
      <div style={{ marginTop: '20px', padding: '20px', border: '2px dashed #475569', borderRadius: '8px', backgroundColor: '#1e293b' }}>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange} 
          style={{ marginBottom: '15px', color: 'white' }}
        />
        
        {headers.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '5px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8' }}>Map Dataset Columns</h4>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>1. Primary Class (e.g. Sex)</label>
                <select 
                  value={protectedClass} 
                  onChange={(e) => setProtectedClass(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569' }}
                >
                  <option value="">-- Select --</option>
                  {headers.map((col, idx) => <option key={idx} value={col}>{col}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>2. Secondary Class</label>
                <select 
                  value={protectedClass2} 
                  onChange={(e) => setProtectedClass2(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569' }}
                >
                  <option value="none">-- None (Single Class) --</option>
                  {headers.map((col, idx) => <option key={idx} value={col}>{col}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>3. Decision Column</label>
                <select 
                  value={decisionCol} 
                  onChange={(e) => setDecisionCol(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569' }}
                >
                  <option value="">-- Select --</option>
                  {headers.map((col, idx) => <option key={idx} value={col}>{col}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={runAudit} 
          disabled={loading}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', backgroundColor: loading ? '#64748b' : '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', width: '100%' }}>
          {loading ? 'Analyzing Neural Bias...' : 'Upload & Audit Dataset'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#7f1d1d', borderRadius: '5px', border: '1px solid #ef4444' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {auditData && (
        <div style={{ 
          marginTop: '30px', 
          padding: '25px', 
          backgroundColor: '#1e293b', 
          borderRadius: '8px', 
          borderLeft: auditData.overall_severity === 'Critical' ? '5px solid #ef4444' : auditData.overall_severity === 'Warning' ? '5px solid #eab308' : '5px solid #22c55e' 
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, marginRight: '15px' }}>Audit Results</h2>
            <span style={{ 
              padding: '5px 15px', 
              borderRadius: '20px', 
              fontWeight: 'bold', 
              backgroundColor: auditData.overall_severity === 'Critical' ? '#7f1d1d' : auditData.overall_severity === 'Warning' ? '#713f12' : '#14532d',
              color: auditData.overall_severity === 'Critical' ? '#fca5a5' : auditData.overall_severity === 'Warning' ? '#fde047' : '#86efac',
              border: `1px solid ${auditData.overall_severity === 'Critical' ? '#ef4444' : auditData.overall_severity === 'Warning' ? '#eab308' : '#22c55e'}`
            }}>
              {auditData.overall_severity === 'Critical' ? '🔴 CRITICAL BIAS' : auditData.overall_severity === 'Warning' ? '🟡 MODERATE BIAS' : '🟢 FAIRNESS VERIFIED'}
            </span>
          </div>
          
          <hr style={{ borderColor: '#334155', margin: '15px 0' }} />
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ flex: '1 1 300px' }}>
              <p><strong>Target Evaluated:</strong> {auditData.flagged_feature}</p>
              <p style={{ margin: '5px 0' }}><strong>Most Privileged:</strong> {auditData.group_a_name} ({auditData.group_a_approval}%)</p>
              <p style={{ margin: '5px 0' }}><strong>Most Disadvantaged:</strong> {auditData.group_b_name} ({auditData.group_b_approval}%)</p>
              
              {auditData.all_groups && auditData.all_groups.length > 0 && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '5px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Full Intersectional Ranking</p>
                  {auditData.all_groups.map((g, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '125px', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                      <div style={{ flex: 1, backgroundColor: '#334155', height: '8px', borderRadius: '4px', marginLeft: '10px', position: 'relative' }}>
                        <div style={{ 
                          position: 'absolute', top: 0, left: 0, height: '100%', 
                          width: `${g.rate * 100}%`, 
                          backgroundColor: idx === 0 ? '#3b82f6' : idx === auditData.all_groups.length - 1 ? '#ef4444' : '#64748b', 
                          borderRadius: '4px' 
                        }}></div>
                      </div>
                      <div style={{ width: '40px', textAlign: 'right', fontSize: '13px', marginLeft: '10px' }}>{(g.rate * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '5px', borderLeft: '3px solid #6366f1' }}>
                <p style={{ margin: '0 0 5px 0' }}><strong>Disparate Impact Ratio:</strong> {auditData.metrics.disparate_impact_ratio} <span style={{fontSize: '0.8em', color: '#94a3b8'}}>(Target: &gt; 0.80)</span></p>
                <p style={{ margin: 0 }}>
                  <strong>Statistical Parity:</strong> {spdAbs} <span style={{fontSize: '0.8em', color: '#f87171', fontWeight: 'bold', marginLeft: '5px'}}>({spdGapText})</span>
                </p>
              </div>

              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#450a0a', borderRadius: '5px', borderLeft: '3px solid #ef4444' }}>
                <p style={{ margin: 0, color: '#fca5a5' }}><strong>⚠️ Proxy Warnings:</strong> {auditData.proxy_warnings}</p>
              </div>
            </div>

            <div style={{ flex: '1 1 300px', height: '250px', backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" interval={0} tick={{ fontSize: 13, fontWeight: 'bold' }} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey={auditData.group_a_name || 'Group A'} fill="#3b82f6" radius={[4, 4, 0, 0]} minPointSize={5} />
                  <Bar dataKey={auditData.group_b_name || 'Group B'} fill="#ef4444" radius={[4, 4, 0, 0]} minPointSize={5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '5px' }}>
            <p style={{ margin: 0 }}><strong>Regulatory Analysis:</strong> {auditData.analysis_summary}</p>
          </div>

          {auditData.mitigation_plan && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#334155', borderRadius: '5px', borderLeft: '3px solid #3b82f6', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>Actionable Mitigation Plan</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', flex: 1 }}>
                {auditData.mitigation_plan.map((step, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>{step}</li>
                ))}
              </ul>
              
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={downloadCSV}
                  style={{ flex: 1, padding: '12px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  ⬇️ Download Reweighted CSV
                </button>
                {/* THE NEW PDF EXPORT BUTTON */}
                <button 
                  onClick={downloadPDF}
                  style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>
                  📄 Export PDF Compliance Report
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App