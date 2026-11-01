from pathlib import Path
import subprocess
base=Path(__file__).parent/'refs'
base.mkdir(parents=True,exist_ok=True)
for name in ('reading','noticed'):
 headx,heady=(453,305) if name=='reading' else (496,240)
 eyes= '<circle cx="456" cy="260" r="7" fill="#17191b"/><circle cx="538" cy="260" r="7" fill="#17191b"/>' if name=='noticed' else ''
 spine=f'<path d="M{headx+34} {heady+105} Q530 505 527 815" fill="none" stroke="#9b9e9f" stroke-width="165" stroke-linecap="round"/>'
 arm='<path d="M455 490 L395 720 L302 1015" fill="none" stroke="#b5b7b6" stroke-width="64" stroke-linecap="round"/>'
 arm2='<path d="M600 493 L690 795 L714 1010" fill="none" stroke="#a6a7a6" stroke-width="66" stroke-linecap="round"/>'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="#1e2124"/><path d="M525 790 L410 1380 L670 1380 Z" fill="#757879"/>{spine}{arm}{arm2}<ellipse cx="{headx}" cy="{heady}" rx="145" ry="180" fill="#999b9c"/>{eyes}<path d="M315 220 Q450 150 680 580" fill="none" stroke="#6a7177" stroke-width="58"/></svg>'
 inp=base/f'{name}-guide.svg';inp.write_text(svg)
 subprocess.run(['sips','-s','format','png',str(inp),'--out',str(base/f'{name}-guide.png')],check=True,stdout=subprocess.DEVNULL)
