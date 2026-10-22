import sys, json
r = json.loads(sys.stdin.read())
for k, v in r.items():
    if isinstance(v, dict):
        print('==', k, 'vals', v.get('vals', v.get('rows')), 'ovf', v['overflowPx'], 'n', v['n'])
        if v['missing']: print('  missing', v['missing'])
        if v['extra']: print('  extra', v['extra'])
        for d in v['diffs'][:int(sys.argv[1]) if len(sys.argv) > 1 else 20]: print('   ', d)
    else: print(k, v)
