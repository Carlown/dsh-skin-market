import re, sys
p = r'C:\Users\Anthinr\Downloads\dsh-skin-market\registry\skins\carlown__majia7-dsh-skin.yml'
F = '4f3829544ecda2732a38c2db420adb26d8a62923'
s = open(p, encoding='utf8').read()
s = re.sub(r'#[0-9a-f]{40}', '#' + F, s)
s = re.sub(r'^  commit: [0-9a-f]{40}', '  commit: ' + F, s, flags=re.M)
s = re.sub(r'^  version: .*', '  version: 0.3.5', s, flags=re.M)
open(p, 'w', encoding='utf8').write(s)
print('updated', F[:10])
