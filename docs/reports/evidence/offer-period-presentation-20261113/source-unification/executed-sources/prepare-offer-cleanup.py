from pathlib import Path
import json,hashlib,shutil
r=Path(__file__).parent;e=r/'docs/reports/evidence/offer-period-presentation-20261113';u=e/'source-unification';dest=u/'executed-sources'
f=r/'prepare-offer-cleanup.py';shutil.copy2(f,dest/f.name)
files=[p for p in r.iterdir() if p.is_file() and p.name in {x.name for x in dest.iterdir()}|{'payload.tar.gz','offer-source-payload.tar.gz'}]
protected=[r/'frontend/src/components/ProductMarkerBadges.tsx',r/'frontend/src/components/PriceAdjustmentWorkspace.tsx',r/'backend/src/main/java/com/bobbuy/service/ProductSaleService.java',u/'acceptance.json',u/'artifact.json',u/'production/offers.json',u/'production/browser.json',u/'production/editor-1440.png',u/'production/editor-lines-320.png',u/'production/offer-1440.png',u/'production/offer-text-320.png']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=dict(Root=str(r),Files=[dict(Path=str(p),Bytes=p.stat().st_size,UtcTicks=str(p.stat().st_mtime_ns//100+621355968000000000),Sha256=sha(p),Owner='Created in this offer-period task; retained executed source or verified remote archive') for p in files],Protected=[dict(Path=str(p),Sha256=sha(p)) for p in protected],ProtectedRoots=[str(r/'frontend'),str(r/'backend'),str(r/'docs')],ReceiptPath=str(u/'cleanup-receipt.json'))
mp=u/'cleanup-manifest.json';mp.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');args=u/'cleanup-arguments.json';args.write_text(json.dumps(dict(ManifestPath=str(mp)))+'\n',encoding='utf-8')
print(json.dumps(dict(ScriptPath=str(e/'cleanup-owned.ps1'),ExpectedSha256=sha(e/'cleanup-owned.ps1'),ArgumentFile=str(args),ExpectedArgumentsSha256=sha(args),files=len(files),bytes=sum(p.stat().st_size for p in files))))
