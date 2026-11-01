"""Render two low-detail pose guides, not finished assets; requires ffmpeg only."""
from pathlib import Path
import subprocess
p=Path(__file__).parent/'refs';p.mkdir(exist_ok=True)
poses={'launch':[(348,230),(610,820),(235,1390),(840,1290),(155,725),(795,380)], 'stride':[(270,230),(568,820),(160,1420),(910,1110),(125,475),(835,790)]}
for name,(head,hip,frontfoot,backfoot,frontarm,backarm) in poses.items():
 shoulder=(head[0]+80,head[1]+240)
 segments=[(shoulder,hip,110),(shoulder,frontarm,55),(shoulder,backarm,55),(hip,frontfoot,90),(hip,backfoot,90)]
 lines=''.join(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#b2b2ae" stroke-width="{width}" stroke-linecap="round"/>' for a,b,width in segments)
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="#202225"/>{lines}<ellipse cx="{head[0]}" cy="{head[1]}" rx="115" ry="135" fill="#b1b1ad"/><path d="M{head[0]} {head[1]-100} Q790 420 1000 750" fill="none" stroke="#777b7e" stroke-width="42"/></svg>'
 src=p/f'{name}-guide.svg';src.write_text(svg)
 subprocess.run(['sips','-s','format','png',str(src),'--out',str(p/f'{name}-guide.png')],check=True)
 print(p/f'{name}-guide.png')
