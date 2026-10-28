import re
from pathlib import Path

# Manual parsing from known visible page-1 text (this script encodes the extracted groups)
# Groups inferred from the attached page 1 image:
# Tower lifts:
# PL1-PL5 = 89,813
# PL6-PL8 = 100,805
# PL9-PL11 = 89,593
# SL1-SL4 = 106,606
# Commercial floors:
# PL12-PL15 = 23,516
# SL5-SL8 = 24,507

jobs = {}
for j in ['PL1','PL2','PL3','PL4','PL5']:
    jobs[j] = {'price': 89813.00, 'weight': 1400, 'floors': 35}
for j in ['PL6','PL7','PL8']:
    jobs[j] = {'price': 100805.00, 'weight': 1250, 'floors': 35}
for j in ['PL9','PL10','PL11']:
    jobs[j] = {'price': 89593.00, 'weight': 1400, 'floors': 35}
for j in ['SL1','SL2','SL3','SL4']:
    jobs[j] = {'price': 106606.00, 'weight': 1400, 'floors': 35}
for j in ['PL12','PL13','PL14','PL15']:
    jobs[j] = {'price': 23516.00, 'weight': 630, 'floors': 5}
for j in ['SL5','SL6','SL7','SL8']:
    jobs[j] = {'price': 24507.00, 'weight': 630, 'floors': 5}

print('COUNT', len(jobs))
for k in sorted(jobs):
    v = jobs[k]
    print(f"{k}\t{v['price']}\t{v['weight']}\t{v['floors']}")
