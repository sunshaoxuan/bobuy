from pathlib import Path
r=Path(__file__).parent
p=r/'release-offer-source.py';s=p.read_text(encoding='utf-8').replace("if action=='stage':","if action in ('stage','resume-stage'):")
s=s.replace("  remote(\"from pathlib import Path\\np=Path(\"+repr(REMOTE)+\");assert not p.exists();p.mkdir(mode=0o700)\")\n  upload(payload)","  if action=='stage':\n   remote(\"from pathlib import Path\\np=Path(\"+repr(REMOTE)+\");assert not p.exists();p.mkdir(mode=0o700)\")\n   upload(payload)")
s=s.replace("hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if 'db/migration/'", "hashlib.sha256(z.read(n).replace(b'\\\\r\\\\n',b'\\\\n')).hexdigest() for n in z.namelist() if 'db/migration/'")
s=s.replace("binding=dict(result='IDENTICAL',files=new,baselineCoreImage", "binding=dict(result='IDENTICAL',comparison='Exact SQL bytes after CRLF-to-LF normalization; no other normalization',files=new,baselineCoreImage")
p.write_text(s,encoding='utf-8')
p=r/'docs/plans/OFFER-PERIOD-PRESENTATION-20261113.md';s=p.read_text(encoding='utf-8');s+='\n发布暂存第一次在迁移字节保护处停止，未构建镜像或替换服务。定向诊断确认36份迁移文件集合相同，仅V35从9726变9839字节，CRLF转LF后逐字节相同，逐行diff为空。Windows签出换行导致113个CR差异，SQL没有变化。将绑定限定为仅CRLF到LF规范化后的逐文件SHA256，保留诊断；重新执行已上传包的暂存，代码/JAR/UI证据继续有效，不重跑产品检查。\n同环境精确网络诊断仅加载原列表和详情，console与requestfailed均为空；原失败保留，线上仍需实际网络验收。\n';p.write_text(s,encoding='utf-8')
