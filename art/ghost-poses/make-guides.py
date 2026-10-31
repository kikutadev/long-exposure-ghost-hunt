from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path(__file__).parent/'refs';p.mkdir(parents=True,exist_ok=True)
W,H=1024,1536
for name in ('recognition','attack'):
 im=Image.new('RGB',(W,H),(35,38,42));d=ImageDraw.Draw(im)
 # camera-centered loose anatomical sketch; not intended as final artwork
 d.ellipse((340,230,690,615),fill=(124,124,121),outline=(220,218,208),width=8)
 d.polygon([(380,580),(615,580),(765,1290),(270,1290)],fill=(93,95,98),outline=(210,210,204),width=9)
 # hair mass, distinct from blank guide face
 d.arc((305,190,700,680),180,345,fill=(219,219,208),width=38)
 d.line([(310,420),(275,900),(235,1220)],fill=(175,175,168),width=55)
 d.line([(695,410),(740,930),(770,1230)],fill=(174,175,168),width=55)
 if name=='recognition':
  d.ellipse((430,405,465,430),fill=(18,18,20));d.ellipse((568,405,601,430),fill=(18,18,20))
  d.line([(330,640),(235,850),(280,1030)],fill=(123,124,130),width=80)
  d.line([(663,640),(783,940),(754,1080)],fill=(123,124,130),width=80)
  d.ellipse((242,980,311,1085),fill=(155,156,155))
  d.ellipse((725,1035,804,1140),fill=(155,156,155))
 else:
  # Unnatural forced perspective: one extended forearm enters lower right,
  # raised palm and fingers dominate the front quarter of the frame.
  d.line([(665,672),(770,800),(790,820)],fill=(145,149,151),width=135)
  d.polygon([(585,730),(680,690),(950,800),(890,1280),(610,1180)],fill=(124,127,130),outline=(213,210,203),width=8)
  d.ellipse((525,520,990,1120),fill=(168,169,169),outline=(234,230,221),width=12)
  for x,y in [(565,390),(660,320),(772,337),(887,410)]:
   d.line([(x+32,700),(x,y)],fill=(172,174,172),width=76)
   d.ellipse((x-6,y-30,x+77,y+55),fill=(174,175,175),outline=(233,232,228),width=6)
  d.ellipse((445,395,474,421),fill=(14,15,17));d.ellipse((566,395,600,421),fill=(14,15,17))
 # No labels in guide: model is asked not to copy mannequin geometry.
 im.save(p/f'{name}-guide.png')
 print(p/f'{name}-guide.png')
