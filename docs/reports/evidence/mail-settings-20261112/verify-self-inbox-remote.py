"""Verify only the authorized self-test message; never print or persist credentials."""
import subprocess,json,base64,ssl,imaplib,email
from email import policy
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
sql="SELECT row_to_json(s) FROM (SELECT host,port,tls_mode,username,from_address,reply_to,encrypted_password,key_id FROM bb_mail_settings WHERE id=1) s;"
p=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
assert p.returncode==0
s=json.loads(p.stdout);assert s['username']==s['from_address']==s['reply_to']=='postmaster@bobuy.cc' and s['host']=='mail.briconbric.com'
keys=dict(line.split('=',1) for line in Path('/etc/bobuy-secrets/mail-keyring.properties').read_text().splitlines() if '=' in line)
nonce,data=s['encrypted_password'].split(':')
context='bobuy-mail:v1:1:'+s['host']+':'+str(s['port'])+':'+s['tls_mode']+':'+s['username']+':'+s['from_address']+':'+s['reply_to']
secret=AESGCM(base64.b64decode(keys[s['key_id']])).decrypt(base64.b64decode(nonce),base64.b64decode(data),context.encode()).decode()
conn=imaplib.IMAP4_SSL(s['host'],993,ssl_context=ssl.create_default_context(),timeout=20)
try:
 assert conn.login(s['username'],secret)[0]=='OK';secret=None
 assert conn.select('INBOX',readonly=True)[0]=='OK'
 typ,ids=conn.search(None,'SUBJECT','"Bobuy SMTP test"');assert typ=='OK' and ids[0].split()
 ident=ids[0].split()[-1];typ,parts=conn.fetch(ident,'(BODY.PEEK[])');assert typ=='OK'
 raw=next(part[1] for part in parts if isinstance(part,tuple));msg=email.message_from_bytes(raw,policy=policy.default)
 assert str(msg['Subject'])=='Bobuy SMTP test'
 assert email.utils.parseaddr(str(msg['To']))[1]=='postmaster@bobuy.cc' and email.utils.parseaddr(str(msg['From']))[1]=='postmaster@bobuy.cc'
 body=msg.get_body(preferencelist=('plain',)).get_content() if msg.is_multipart() else msg.get_content()
 assert 'Bobuy mail settings test. No account or verification token is included.' in body
 print(json.dumps({'result':'PASS','inbox':'INBOX','subject':'Bobuy SMTP test','selfToSelf':True,'fixedTokenFreeBody':True,'messagesMatchingSubject':len(ids[0].split()),'readOnly':True,'imapCertificateVerified':True}))
finally:
 try:conn.logout()
 except Exception:pass
