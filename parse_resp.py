import json, sys

def main():
    raw = sys.stdin.read()
    d = json.loads(raw)
    if "event" in d:
        print(f"created: {d['event']['title']} id={d['event']['id']}")
        return
    if "events" in d:
        evs = d["events"]
        print(f"events count={len(evs)}")
        for e in evs[:8]:
            print(f"  - {e.get('title','?')} type={e.get('type','?')} color={e.get('color','?')} date={e.get('date','?')}")
    if "scripts" in d:
        scripts = d["scripts"]
        print(f"scripts count={len(scripts)}")
        for s in scripts:
            print(f"  - {s.get('title','?')} folder={s.get('folder','-')} status={s.get('status','-')} words={s.get('wordCount',0)}")

main()
