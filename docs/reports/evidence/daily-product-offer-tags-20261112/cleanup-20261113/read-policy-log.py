"""Read only this chat's execution-policy diagnostics from existing local logs."""
import sqlite3,json
from pathlib import Path
thread='01a1cf14-a3b6-7071-a101-f5f28498198e';result=[]
for path in [Path('C:/Users/X02851/.codex/logs_2.sqlite'),Path('C:/Users/X02851/.codex/sqlite/logs_2.sqlite')]:
 c=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
 rows=c.execute("SELECT ts,target,feedback_log_body FROM logs WHERE thread_id=? AND (feedback_log_body LIKE '%blocked by policy%' OR target LIKE '%exec_policy%') ORDER BY id DESC LIMIT 12",(thread,)).fetchall()
 result.append({'database':str(path),'rows':[{'ts':t,'target':target,'body':body[:1800]} for t,target,body in rows]});c.close()
out=Path(__file__).with_name('execution-policy-log.json');out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
