"""Byte-equivalent legacy content fingerprint without a whole-table aggregate.

The SELECT must return one JSON-text column ordered exactly as the old aggregate.
JSON text escapes embedded ASCII newlines; psql adds one LF row delimiter. Hash
all delimiters except the final LF to reproduce string_agg(v, chr(10) order by v).
Only a bounded chunk and one trailing byte are retained by this process.
"""
import hashlib,subprocess

def scan(command,query):
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    process.stdin.write((query+';\n').encode('utf-8'));process.stdin.close()
    digest=hashlib.md5();rows=0;tail=b''
    while True:
        chunk=process.stdout.read(1024*1024)
        if not chunk:break
        rows+=chunk.count(b'\n');value=tail+chunk;digest.update(value[:-1]);tail=value[-1:]
    error=process.stderr.read();code=process.wait()
    if code:raise RuntimeError('Bounded PostgreSQL scan failed with exit '+str(code)+'; output suppressed')
    if tail and tail!=b'\n':raise RuntimeError('Unexpected PostgreSQL row framing')
    return str(rows)+':'+digest.hexdigest()
